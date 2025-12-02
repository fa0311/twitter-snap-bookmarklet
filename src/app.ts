import { swaggerUI } from "@hono/swagger-ui";
import { z } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import pino from "pino";
import { getEnv } from "./env.js";
import { createLineNotifyClient } from "./utils/line.js";
import { createMutex } from "./utils/mutex.js";
import { createWebdavClient } from "./utils/storage.js";
import { createTwitterSnapClient, getExtByContentType } from "./utils/twitter-snap.js";

const env = await getEnv();

const log = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

const storage = createWebdavClient({
  url: env.WEBDAV_URL,
  username: env.WEBDAV_USERNAME,
  password: env.WEBDAV_PASSWORD,
  basePath: env.WEBDAV_BASE_PATH,
  baseShareUrl: env.WEBDAV_SHARE_BASE_URL,
});
const snap = await createTwitterSnapClient({
  baseurl: env.TWITTER_SNAP_API_BASEURL,
});
const linePush = createLineNotifyClient({
  token: env.LINE_PUSH_TOKEN,
  baseUrl: env.LINE_PUSH_BASE_URL,
});
const mutex = createMutex(1);

const ignoreError = (error: unknown) => log.error(error);

const checkStorage = async (name: string) => {
  const existsCheck = await Promise.all(
    ["png", "mp4"].map(async (ext) => {
      const path = storage.path(`${name}.${ext}`);
      const exists = await path.exists();
      return [path.url, exists] as const;
    }),
  );
  const exists = existsCheck.find(([_, exists]) => exists);
  return exists ? exists[0] : null;
};

export const createApp = async () => {
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());
  app.use("*", secureHeaders());
  app.use("*", prettyJSON());

  app.get("/docs", swaggerUI({ url: `/openapi.json` }));
  app.get("/openapi.json", openAPIRouteHandler(app));

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  app.get(
    "/api/snap/:dir/:id",

    describeRoute({
      description: "Say hello to the user",
      responses: {
        200: {
          description: "Successful response",
          content: {},
        },
      },
    }),
    zValidator(
      "param",

      z.object({
        id: z.string().regex(/^[0-9]{1,19}$/),
        dir: z.string().regex(/^[a-zA-Z0-9_]{1,100}$/),
      }),
    ),
    async (c) => {
      const id = c.req.valid("param").id;
      const storageDir = c.req.valid("param").dir;

      mutex.runExclusive(async () => {
        const exists = await checkStorage(`snap/${storageDir}/${id}`);
        if (exists) {
          return c.redirect(exists);
        } else {
          const res = await snap.twitter(id);
          const ext = getExtByContentType(res.contentType);
          const dir = storage.path(`snap/${storageDir}/${id}.${ext}`);
          const nodeReadable = Readable.fromWeb(res.body);
          const nodeWriteStream = await dir.createWriteStream({
            headers: {
              "Content-Type": res.contentType,
              "Content-Length": res.length,
            },
          });

          (async () => {
            await pipeline(nodeReadable, nodeWriteStream);
            await linePush.sendMessage(`スナップしました\n${dir.url}`);
          })().catch(ignoreError);

          return new Response(nodeReadable, {
            headers: {
              "Content-Type": res.contentType,
              "Content-Length": res.length,
            },
          });
        }
      });
    },
  );
  return app;
};

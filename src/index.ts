import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import * as dotenv from "dotenv";
import { Hono } from "hono";
import { promises as fs } from "node:fs";
import { getSnapAppRender } from "twitter-snap";
import * as webdav from "webdav";
import { z } from "zod";
import { makedirs } from "./webdav.js";

dotenv.config();
const app = new Hono();

export type FontOptions = Awaited<ReturnType<ReturnType<typeof getSnapAppRender>["getFont"]>>;
export type Session = Awaited<ReturnType<ReturnType<typeof getSnapAppRender>["login"]>>;
export type SnapApp = Awaited<ReturnType<typeof getSnapAppRender>>;

const [session, font] = await (async () => {
  const client = getSnapAppRender({ url: "https://x.com/elonmusk/status/1463584025822821890" });
  const font = await client.getFont();
  const session = await client.login({ sessionType: "file", cookiesFile: "cookies.json" });
  return [session, font] as const;
})();

const nextcloud = webdav.createClient(process.env.WEBDAV_URL!, {
  username: process.env.WEBDAV_USERNAME!,
  password: process.env.WEBDAV_PASSWORD!,
  maxBodyLength: Number.POSITIVE_INFINITY,
  maxContentLength: Number.POSITIVE_INFINITY,
});

const outputDir = process.env.WEBDAV_OUTPUT_DIR!;
const port = Number(process.env.PORT) || 3000;

app.get(
  "/api/snap/:dir/:id",
  zValidator(
    "param",
    z.object({
      id: z.string().regex(/^[0-9]{1,19}$/),
      dir: z.string().regex(/^[a-zA-Z0-9_]{1,100}$/),
    }),
  ),
  async (c) => {
    const id = c.req.valid("param").id;
    const dir = c.req.valid("param").dir;

    const client = getSnapAppRender({ url: `https://twitter.com/elonmusk/status/${id}` });
    const render = await client.getRender({ limit: 1, session });

    await client.run(render, async (run) => {
      const output = await run({
        ffmpegTimeout: 6000,
        output: `temp/${id}.{if-photo:png:mp4}`,
        theme: "RenderOceanBlueColor",
        scale: 2,
        width: 1440,
        font: font,
      });
      await output.file.tempCleanup();
    });

    console.log(`snap tweet id: ${id} done`);

    const files = (await fs.readdir("temp")).filter((file) => {
      return file.includes(id);
    });

    const file = files[0];
    const data = await fs.readFile(`temp/${file}`);
    await makedirs(nextcloud, `${outputDir}/${dir}`);
    await nextcloud.putFileContents(`${outputDir}/${dir}/${file}`, data);
    await fs.unlink(`temp/${file}`);

    if (file.endsWith(".png")) {
      c.header("Content-Type", "image/png");
    } else if (file.endsWith(".mp4")) {
      c.header("Content-Type", "video/mp4");
    }

    c.status(200);

    return new Response(data);
  },
);

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

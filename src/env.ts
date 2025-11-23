import z from "zod";
import { parseEnv } from "./utils/env.js";

const env = parseEnv(
  z.object({
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

    PORT: z.coerce.number().default(3000),
    ROUTE: z.string().default("/webhook"),

    WEBDAV_URL: z.string(),
    WEBDAV_USERNAME: z.string(),
    WEBDAV_PASSWORD: z.string(),
    WEBDAV_BASE_PATH: z.string().default("/"),
    WEBDAV_SHARE_BASE_URL: z.string(),

    LINE_PUSH_TOKEN: z.string(),
    LINE_PUSH_BASE_URL: z.string().default("https://notify-api.line.me/api/notify"),

    TWITTER_SNAP_API_BASEURL: z.string(),
  }),
);

export const getEnv = async () => await env;

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getEnv } from "./env.js";

const env = await getEnv();
const app = await createApp();

console.log(`Server is running on http://localhost:${env.PORT}`);

serve({
  fetch: app.fetch,
  port: env.PORT,
});

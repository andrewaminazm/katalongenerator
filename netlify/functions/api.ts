/**
 * Netlify serverless API — env must be set in Netlify UI (not committed .env files).
 * @see https://docs.netlify.com/environment-variables/overview/
 */
import { loadEnv } from "../../server/src/loadEnv.js";

process.env.NETLIFY = "1";
loadEnv();

import serverless from "serverless-http";
import { app } from "../../server/src/index.js";

export const handler = serverless(app);

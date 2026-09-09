import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type Express } from "express";
import type { Database } from "../db/index.js";
import type { Config } from "../config.js";
import type { IssueButlerGithubApp } from "../github/app.js";
import type { Logger } from "../logger.js";
import { createConfigRouter } from "./routes/config.js";
import { createReportsRouter } from "./routes/reports.js";
import { createGithubConnectRouter } from "./routes/githubConnect.js";
import { createGithubWebhookRouter } from "./routes/githubWebhook.js";
import { requireAdmin } from "./middleware/requireAdmin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CreateServerOptions {
  db: Database;
  adminToken: string | null;
  config: Config;
  githubApp: IssueButlerGithubApp | null;
  logger: Logger;
}

/**
 * Builds the Express app without starting it listening, so tests can drive it directly with
 * supertest. The admin API is mounted only when an admin token is configured, and the GitHub
 * routes only when the App integration is enabled; otherwise the deployment is bot-only.
 */
export function createServer({ db, adminToken, config, githubApp, logger }: CreateServerOptions): Express {
  const app = express();
  app.use(cors());

  // Must be registered before express.json() below: the webhook route needs the RAW body
  // for signature verification, and express.json() would otherwise consume the stream first.
  if (githubApp) {
    app.use(createGithubWebhookRouter(githubApp, logger));
  }

  app.use(express.json());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  if (githubApp) {
    app.use(createGithubConnectRouter({ db, app: githubApp, config, logger }));
  }

  if (adminToken) {
    const api = express.Router();
    api.use(requireAdmin(adminToken));
    api.use(createReportsRouter(db));
    api.use(createConfigRouter(db));
    app.use("/api", api);
  }

  const clientDist = path.resolve(__dirname, "../../../admin-client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // Exclude every backend route prefix, not just /api — otherwise this SPA fallback
    // masks a disabled/missing /connect or /webhooks route with a false 200 (the React
    // app's index.html) instead of a 404.
    app.get(/^(?!\/api|\/connect|\/webhooks).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  return app;
}

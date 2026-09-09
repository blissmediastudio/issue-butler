import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type Express } from "express";
import type { Database } from "../db/index.js";
import { createConfigRouter } from "./routes/config.js";
import { createReportsRouter } from "./routes/reports.js";
import { requireAdmin } from "./middleware/requireAdmin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CreateServerOptions {
  db: Database;
  adminToken: string | null;
}

/**
 * Builds the Express app without starting it listening, so tests can drive
 * it directly with supertest. The admin API is mounted only when an admin
 * token is configured; otherwise the deployment is bot-only.
 */
export function createServer({ db, adminToken }: CreateServerOptions): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

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
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  return app;
}

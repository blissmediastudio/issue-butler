import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { openDatabase, type Database } from "../src/db/index.js";
import { createReport } from "../src/db/reports.js";
import { createServer } from "../src/server/index.js";
import { loadConfig, type Config } from "../src/config.js";
import { createLogger } from "../src/logger.js";

const ADMIN_TOKEN = "test-admin-token-1234567890";
const logger = createLogger("error");
const baseConfig: Config = loadConfig({ DISCORD_BOT_TOKEN: "t", DISCORD_CLIENT_ID: "c" });

let db: Database;
let app: Express;

beforeEach(() => {
  db = openDatabase(":memory:");
  app = createServer({ db, adminToken: ADMIN_TOKEN, config: baseConfig, githubApp: null, logger });
});

afterEach(() => {
  db.close();
});

describe("GET /healthz", () => {
  it("responds without auth", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("admin API auth", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await request(app).get("/api/guilds/guild-1/config");
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong token", async () => {
    const res = await request(app).get("/api/guilds/guild-1/config").set("Authorization", "Bearer wrong-token");
    expect(res.status).toBe(401);
  });

  it("accepts requests with the correct token", async () => {
    const res = await request(app).get("/api/guilds/guild-1/config").set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(res.status).toBe(404); // not configured yet, but auth passed
  });
});

describe("config routes", () => {
  const auth = (req: request.Test) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

  it("creates config on first PUT and returns it on GET", async () => {
    const put = await auth(request(app).put("/api/guilds/guild-1/config")).send({ feedbackChannelId: "chan-1" });
    expect(put.status).toBe(200);
    expect(put.body.feedbackChannelId).toBe("chan-1");

    const get = await auth(request(app).get("/api/guilds/guild-1/config"));
    expect(get.status).toBe(200);
    expect(get.body.feedbackChannelId).toBe("chan-1");
  });

  it("rejects invalid payloads", async () => {
    const res = await auth(request(app).put("/api/guilds/guild-1/config")).send({ maxElaborationRounds: 99 });
    expect(res.status).toBe(400);
  });
});

describe("reports routes", () => {
  const auth = (req: request.Test) => req.set("Authorization", `Bearer ${ADMIN_TOKEN}`);

  it("lists reports for a guild", async () => {
    createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-1",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "It's broken",
      category: "bug",
      status: "open",
    });

    const res = await auth(request(app).get("/api/guilds/guild-1/reports"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe("bug");
  });

  it("validates the status query parameter", async () => {
    const res = await auth(request(app).get("/api/guilds/guild-1/reports?status=bogus"));
    expect(res.status).toBe(400);
  });
});

describe("without an admin token configured", () => {
  it("does not mount the admin API at all", async () => {
    const openApp = createServer({ db, adminToken: null, config: baseConfig, githubApp: null, logger });
    const res = await request(openApp).get("/api/guilds/guild-1/config");
    expect(res.status).toBe(404);
  });
});

describe("without the github app configured", () => {
  it("does not mount the connect or webhook routes", async () => {
    const res1 = await request(app).get("/connect/github/start?guildId=guild-1");
    const res2 = await request(app).post("/webhooks/github");
    expect(res1.status).toBe(404);
    expect(res2.status).toBe(404);
  });
});

import { createHmac, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { App } from "@octokit/app";
import { openDatabase, type Database } from "../src/db/index.js";
import { createServer } from "../src/server/index.js";
import { loadConfig, type Config } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import { signState } from "../src/server/state.js";

const WEBHOOK_SECRET = "test-webhook-secret";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const FAKE_PEM = privateKey.export({ type: "pkcs1", format: "pem" }).toString();

const config: Config = loadConfig({
  DISCORD_BOT_TOKEN: "t",
  DISCORD_CLIENT_ID: "c",
  GITHUB_APP_ID: "12345",
  GITHUB_APP_SLUG: "issue-butler-test",
  GITHUB_APP_PRIVATE_KEY: FAKE_PEM,
  GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET,
  SESSION_SECRET: "a".repeat(20),
  PUBLIC_BASE_URL: "https://bot.example.com",
});

const logger = createLogger("error");

function sign(body: string): string {
  return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
}

let db: Database;
let app: Express;

beforeEach(() => {
  db = openDatabase(":memory:");
  const githubApp = new App({
    appId: config.GITHUB_APP_ID!,
    privateKey: config.GITHUB_APP_PRIVATE_KEY!,
    webhooks: { secret: config.GITHUB_WEBHOOK_SECRET! },
  });
  app = createServer({ db, adminToken: null, config, githubApp, logger });
});

afterEach(() => {
  db.close();
});

describe("GET /connect/github/start", () => {
  it("redirects to the App's install URL with a signed state", async () => {
    const res = await request(app).get("/connect/github/start?guildId=guild-1");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("https://github.com/apps/issue-butler-test/installations/new?state=");
  });

  it("rejects a missing guildId", async () => {
    const res = await request(app).get("/connect/github/start");
    expect(res.status).toBe(400);
  });
});

describe("GET /connect/github/callback", () => {
  it("rejects a tampered state", async () => {
    const badState = signState("guild-1", "wrong-secret");
    const res = await request(app).get(`/connect/github/callback?installation_id=1&state=${badState}`);
    expect(res.status).toBe(400);
  });

  it("rejects a missing installation_id", async () => {
    const state = signState("guild-1", config.SESSION_SECRET!);
    const res = await request(app).get(`/connect/github/callback?state=${state}`);
    expect(res.status).toBe(400);
  });
});

describe("POST /webhooks/github", () => {
  it("rejects a request with no signature header", async () => {
    const res = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "d1")
      .set("x-github-event", "issues")
      .send({ action: "closed" });
    expect(res.status).toBe(400);
  });

  it("rejects a request with an invalid signature", async () => {
    const body = JSON.stringify({ action: "closed" });
    const res = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "d2")
      .set("x-github-event", "issues")
      .set("x-hub-signature-256", "sha256=deadbeef")
      .set("content-type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
  });

  it("accepts a request with a valid signature", async () => {
    const body = JSON.stringify({ action: "opened", issue: { number: 1 } });
    const res = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "d3")
      .set("x-github-event", "issues")
      .set("x-hub-signature-256", sign(body))
      .set("content-type", "application/json")
      .send(body);
    expect(res.status).toBe(200);
  });
});

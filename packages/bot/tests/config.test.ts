import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const BASE_ENV = {
  DISCORD_BOT_TOKEN: "token",
  DISCORD_CLIENT_ID: "client-id",
};

describe("loadConfig", () => {
  it("throws when required variables are missing", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("applies defaults for optional variables", () => {
    const config = loadConfig(BASE_ENV);
    expect(config.PORT).toBe(3001);
    expect(config.MAX_ELABORATION_ROUNDS).toBe(2);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.DATABASE_PATH).toBe("./data/issue-butler.sqlite");
  });

  const GITHUB_APP_ENV = {
    GITHUB_APP_ID: "123",
    GITHUB_APP_SLUG: "issue-butler",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN KEY-----abc-----END KEY-----",
    GITHUB_WEBHOOK_SECRET: "whsecret",
    SESSION_SECRET: "a".repeat(20),
    PUBLIC_BASE_URL: "https://bot.example.com",
  };

  it("disables the github app integration unless every required variable is present", () => {
    expect(loadConfig(BASE_ENV).githubAppEnabled).toBe(false);
    const { PUBLIC_BASE_URL: _unused, ...missingOne } = GITHUB_APP_ENV;
    expect(loadConfig({ ...BASE_ENV, ...missingOne }).githubAppEnabled).toBe(false);
    expect(loadConfig({ ...BASE_ENV, ...GITHUB_APP_ENV }).githubAppEnabled).toBe(true);
  });

  it("unescapes a literal \\n private key into real newlines", () => {
    const config = loadConfig({
      ...BASE_ENV,
      ...GITHUB_APP_ENV,
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN KEY-----\\nabc\\n-----END KEY-----",
    });
    expect(config.GITHUB_APP_PRIVATE_KEY).toBe("-----BEGIN KEY-----\nabc\n-----END KEY-----");
  });

  it("enables AI only when an Anthropic key is present", () => {
    expect(loadConfig(BASE_ENV).aiEnabled).toBe(false);
    expect(loadConfig({ ...BASE_ENV, ANTHROPIC_API_KEY: "sk-ant-x" }).aiEnabled).toBe(true);
  });

  it("rejects an admin token shorter than 16 characters", () => {
    expect(() => loadConfig({ ...BASE_ENV, ADMIN_TOKEN: "short" })).toThrow();
  });

  it("enables the admin API only when a valid token is present", () => {
    expect(loadConfig(BASE_ENV).adminApiEnabled).toBe(false);
    expect(loadConfig({ ...BASE_ENV, ADMIN_TOKEN: "a".repeat(20) }).adminApiEnabled).toBe(true);
  });
});

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

  it("disables the github pipeline unless all three variables are present", () => {
    expect(loadConfig(BASE_ENV).githubPipelineEnabled).toBe(false);
    expect(
      loadConfig({ ...BASE_ENV, GITHUB_TOKEN: "t", GITHUB_OWNER: "acme" }).githubPipelineEnabled,
    ).toBe(false);
    expect(
      loadConfig({ ...BASE_ENV, GITHUB_TOKEN: "t", GITHUB_OWNER: "acme", GITHUB_REPO: "repo" })
        .githubPipelineEnabled,
    ).toBe(true);
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

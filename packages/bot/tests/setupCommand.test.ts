import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type Database } from "../src/db/index.js";
import { getGuildConfig, ensureGuildConfig, updateGuildConfig } from "../src/db/guildConfig.js";
import { handleSetupCommand } from "../src/discord/commands/setup.js";
import type { ChatInputCommandInteraction } from "discord.js";
import type { Config } from "../src/config.js";

let db: Database;

beforeEach(() => {
  db = openDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

function createMockInteraction(
  guildId: string,
  subcommand: string,
  options: Record<string, string | number | null> = {},
): ChatInputCommandInteraction {
  return {
    inGuild: () => true,
    guildId,
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => (options[name] as string | null) ?? null,
      getInteger: (name: string) => (options[name] as number | null) ?? null,
      getChannel: vi.fn(),
      getRole: vi.fn(),
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
  } as unknown as ChatInputCommandInteraction;
}

// Matches the real Config shape (tests/ isn't included in the typechecked tsconfig, so a
// drifted mock here wouldn't be caught until something actually touched a missing field).
const mockConfig: Config = {
  DISCORD_BOT_TOKEN: "test-token",
  DISCORD_CLIENT_ID: "test-client-id",
  ANTHROPIC_MODEL: "claude-haiku-4-5",
  ADMIN_TOKEN: "test-admin-token-1234567890",
  PORT: 3000,
  DATABASE_PATH: ":memory:",
  MAX_ELABORATION_ROUNDS: 2,
  LOG_LEVEL: "info",
  PUBLIC_BASE_URL: "http://localhost:3000",
  githubAppEnabled: false,
  aiEnabled: false,
  adminApiEnabled: true,
};

describe("/setup labels", () => {
  it("rejects when neither backlog nor in_progress is supplied", async () => {
    const interaction = createMockInteraction("guild-1", "labels", {});

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "At least one of `backlog` or `in_progress` must be supplied.",
      ephemeral: true,
    });
  });

  it("updates only backlog labels when only backlog is supplied", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "todo, planned",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["todo", "planned"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["in-progress", "in progress", "wip"]);
  });

  it("updates only in_progress labels when only in_progress is supplied", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      in_progress: "doing, wip",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["backlog", "planned", "future-enhancement"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["doing", "wip"]);
  });

  it("updates both when both are supplied", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "someday",
      in_progress: "active",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["someday"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["active"]);
  });

  it("trims whitespace and drops empty entries", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: " backlog , planned , , someday ",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["backlog", "planned", "someday"]);
  });

  it("rejects when the same label appears in both lists (case-insensitive)", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "todo, Doing",
      in_progress: "doing, active",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Cannot have the same label in both lists: "Doing"',
      ephemeral: true,
    });
  });

  it("rejects when updating one list causes a conflict with the other", async () => {
    updateGuildConfig(db, "guild-1", {
      backlogLabels: ["backlog"],
      inProgressLabels: ["wip"],
    });
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "wip",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Cannot have the same label in both lists: "wip"',
      ephemeral: true,
    });
  });

  it("replies with the resulting label lists on success", async () => {
    ensureGuildConfig(db, "guild-1");
    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "todo",
      in_progress: "active",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "**Backlog labels:** todo\n**In-progress labels:** active",
      ephemeral: true,
    });
  });

  it("resets both lists to defaults when backlog is 'default' alone", async () => {
    updateGuildConfig(db, "guild-1", { backlogLabels: ["custom-backlog"], inProgressLabels: ["custom-wip"] });
    const interaction = createMockInteraction("guild-1", "labels", { backlog: "default" });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["backlog", "planned", "future-enhancement"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["in-progress", "in progress", "wip"]);
  });

  it("resets both lists to defaults when in_progress is 'default' alone", async () => {
    updateGuildConfig(db, "guild-1", { backlogLabels: ["custom-backlog"], inProgressLabels: ["custom-wip"] });
    const interaction = createMockInteraction("guild-1", "labels", { in_progress: "default" });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["backlog", "planned", "future-enhancement"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["in-progress", "in progress", "wip"]);
  });

  it("rejects 'default' combined with an explicit value for the other option instead of silently dropping it", async () => {
    updateGuildConfig(db, "guild-1", { backlogLabels: ["custom-backlog"], inProgressLabels: ["custom-wip"] });
    const interaction = createMockInteraction("guild-1", "labels", { backlog: "default", in_progress: "active" });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("can't be combined with an explicit value"),
      ephemeral: true,
    });
    // must not have changed anything
    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["custom-backlog"]);
    expect(config?.statusLabels.inProgressLabels).toEqual(["custom-wip"]);
  });

  it("creates a guild config if it doesn't exist", async () => {
    expect(getGuildConfig(db, "guild-1")).toBeNull();

    const interaction = createMockInteraction("guild-1", "labels", {
      backlog: "new",
    });

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    const config = getGuildConfig(db, "guild-1");
    expect(config?.statusLabels.backlogLabels).toEqual(["new"]);
  });
});

describe("/setup show", () => {
  it("displays backlog and in-progress labels", async () => {
    updateGuildConfig(db, "guild-1", {
      feedbackChannelId: "chan-1",
      backlogLabels: ["todo", "later"],
      inProgressLabels: ["doing"],
    });

    const interaction = createMockInteraction("guild-1", "show", {});

    await handleSetupCommand(interaction, { db, config: mockConfig, githubApp: null });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("**Backlog labels:** todo, later"),
      ephemeral: true,
    });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining("**In-progress labels:** doing"),
      ephemeral: true,
    });
  });
});

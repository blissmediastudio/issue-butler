import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "../src/db/index.js";
import { ensureGuildConfig, getGuildConfig, updateGuildConfig } from "../src/db/guildConfig.js";
import {
  addConversationMessage,
  attachThread,
  countReportsByCategory,
  createReport,
  getReportByMessageId,
  getReportByThreadId,
  getTranscript,
  incrementElaborationRound,
  listReports,
  setGithubIssueUrl,
  setReportStatus,
} from "../src/db/reports.js";

let db: Database;

beforeEach(() => {
  db = openDatabase(":memory:");
});

afterEach(() => {
  db.close();
});

describe("guild config", () => {
  it("returns null for an unconfigured guild", () => {
    expect(getGuildConfig(db, "guild-1")).toBeNull();
  });

  it("creates a default row on ensureGuildConfig", () => {
    const config = ensureGuildConfig(db, "guild-1");
    expect(config).toEqual({
      guildId: "guild-1",
      feedbackChannelId: null,
      moderatorRoleId: null,
      approvalEmoji: "👍",
      maxElaborationRounds: 2,
    });
  });

  it("is idempotent", () => {
    ensureGuildConfig(db, "guild-1");
    updateGuildConfig(db, "guild-1", { feedbackChannelId: "chan-1" });
    ensureGuildConfig(db, "guild-1");
    expect(getGuildConfig(db, "guild-1")?.feedbackChannelId).toBe("chan-1");
  });

  it("updates only the provided fields", () => {
    updateGuildConfig(db, "guild-1", { feedbackChannelId: "chan-1", maxElaborationRounds: 4 });
    const config = updateGuildConfig(db, "guild-1", { moderatorRoleId: "role-1" });
    expect(config).toMatchObject({
      feedbackChannelId: "chan-1",
      maxElaborationRounds: 4,
      moderatorRoleId: "role-1",
    });
  });
});

describe("reports", () => {
  it("creates and retrieves a report by message id", () => {
    const created = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-1",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "It's broken",
      category: "bug",
      status: "open",
    });

    expect(created.id).toBeGreaterThan(0);
    expect(getReportByMessageId(db, "msg-1")).toEqual(created);
  });

  it("enforces unique message ids", () => {
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

    expect(() =>
      createReport(db, {
        guildId: "guild-1",
        channelId: "chan-1",
        messageId: "msg-1",
        authorId: "user-2",
        authorTag: "user#0002",
        rawContent: "Also broken",
        category: "bug",
        status: "open",
      }),
    ).toThrow();
  });

  it("attaches a thread and moves status to elaborating", () => {
    const report = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-2",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "hmm",
      category: "general",
      status: "open",
    });

    attachThread(db, report.id, "thread-1");
    const found = getReportByThreadId(db, "thread-1");
    expect(found?.status).toBe("elaborating");
    expect(found?.threadId).toBe("thread-1");
  });

  it("tracks elaboration rounds and conversation transcript", () => {
    const report = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-3",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "hmm",
      category: "bug",
      status: "elaborating",
    });

    addConversationMessage(db, report.id, "bot", "What browser?");
    addConversationMessage(db, report.id, "reporter", "Chrome");
    incrementElaborationRound(db, report.id);

    const transcript = getTranscript(db, report.id);
    expect(transcript).toEqual([
      { role: "bot", content: "What browser?" },
      { role: "reporter", content: "Chrome" },
    ]);
    expect(getReportByMessageId(db, "msg-3")?.elaborationRound).toBe(1);
  });

  it("sets a github issue url and marks the report approved", () => {
    const report = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-4",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "hmm",
      category: "bug",
      status: "ready",
    });

    const updated = setGithubIssueUrl(db, report.id, "https://github.com/acme/repo/issues/42");
    expect(updated.githubIssueUrl).toBe("https://github.com/acme/repo/issues/42");
    expect(updated.status).toBe("approved");
  });

  it("filters reports by status and category", () => {
    createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-a",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "bug one",
      category: "bug",
      status: "open",
    });
    const ready = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-b",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "feature one",
      category: "feature",
      status: "ready",
    });

    const results = listReports(db, { guildId: "guild-1", status: "ready" });
    expect(results.map((r) => r.id)).toEqual([ready.id]);

    const bugResults = listReports(db, { guildId: "guild-1", category: "bug" });
    expect(bugResults).toHaveLength(1);
    expect(bugResults[0]!.category).toBe("bug");
  });

  it("counts reports by category, defaulting missing categories to zero", () => {
    createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-x",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "bug",
      category: "bug",
      status: "open",
    });
    createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-y",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "bug too",
      category: "bug",
      status: "open",
    });

    const counts = countReportsByCategory(db, "guild-1");
    expect(counts).toEqual({ bug: 2, feature: 0, "help-desk": 0, general: 0 });
  });

  it("rejects a report and leaves the github issue url unset", () => {
    const report = createReport(db, {
      guildId: "guild-1",
      channelId: "chan-1",
      messageId: "msg-z",
      authorId: "user-1",
      authorTag: "user#0001",
      rawContent: "spam",
      category: "general",
      status: "ready",
    });
    const updated = setReportStatus(db, report.id, "rejected");
    expect(updated.status).toBe("rejected");
    expect(updated.githubIssueUrl).toBeNull();
  });
});

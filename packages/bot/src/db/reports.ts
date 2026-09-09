import type { Category, ConversationTurn, ReportStatus } from "@issue-butler/core";
import type { Database } from "./index.js";
import { ensureGuildConfig } from "./guildConfig.js";

export interface Report {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  threadId: string | null;
  authorId: string;
  authorTag: string;
  rawContent: string;
  category: Category;
  status: ReportStatus;
  elaborationRound: number;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReportRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  thread_id: string | null;
  author_id: string;
  author_tag: string;
  raw_content: string;
  category: Category;
  status: ReportStatus;
  elaboration_round: number;
  github_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    threadId: row.thread_id,
    authorId: row.author_id,
    authorTag: row.author_tag,
    rawContent: row.raw_content,
    category: row.category,
    status: row.status,
    elaborationRound: row.elaboration_round,
    githubIssueUrl: row.github_issue_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateReportInput {
  guildId: string;
  channelId: string;
  messageId: string;
  authorId: string;
  authorTag: string;
  rawContent: string;
  category: Category;
  status: ReportStatus;
}

export function createReport(db: Database, input: CreateReportInput): Report {
  // reports.guild_id has a foreign key into guild_config; a report can arrive for a guild
  // the ready/guildCreate handlers haven't provisioned yet (e.g. a race on startup), so
  // guarantee the row exists here rather than relying on that ordering.
  ensureGuildConfig(db, input.guildId);

  const result = db
    .prepare(
      `INSERT INTO reports (guild_id, channel_id, message_id, author_id, author_tag, raw_content, category, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.guildId,
      input.channelId,
      input.messageId,
      input.authorId,
      input.authorTag,
      input.rawContent,
      input.category,
      input.status,
    );

  return getReportById(db, Number(result.lastInsertRowid))!;
}

export function getReportById(db: Database, id: number): Report | null {
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as ReportRow | undefined;
  return row ? toReport(row) : null;
}

export function getReportByMessageId(db: Database, messageId: string): Report | null {
  const row = db.prepare("SELECT * FROM reports WHERE message_id = ?").get(messageId) as ReportRow | undefined;
  return row ? toReport(row) : null;
}

export function getReportByThreadId(db: Database, threadId: string): Report | null {
  const row = db.prepare("SELECT * FROM reports WHERE thread_id = ?").get(threadId) as ReportRow | undefined;
  return row ? toReport(row) : null;
}

export interface ListReportsFilter {
  guildId: string;
  status?: ReportStatus;
  category?: Category;
  limit?: number;
}

export function listReports(db: Database, filter: ListReportsFilter): Report[] {
  const clauses = ["guild_id = ?"];
  const values: unknown[] = [filter.guildId];

  if (filter.status) {
    clauses.push("status = ?");
    values.push(filter.status);
  }
  if (filter.category) {
    clauses.push("category = ?");
    values.push(filter.category);
  }

  const limit = filter.limit ?? 100;
  const rows = db
    .prepare(`SELECT * FROM reports WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
    .all(...(values as never[]), limit) as unknown as ReportRow[];

  return rows.map(toReport);
}

export function countReportsByCategory(db: Database, guildId: string): Record<Category, number> {
  const rows = db
    .prepare("SELECT category, COUNT(*) as count FROM reports WHERE guild_id = ? GROUP BY category")
    .all(guildId) as { category: Category; count: number }[];

  const counts: Record<Category, number> = { bug: 0, feature: 0, "help-desk": 0, general: 0 };
  for (const row of rows) counts[row.category] = row.count;
  return counts;
}

export function attachThread(db: Database, reportId: number, threadId: string): void {
  db.prepare("UPDATE reports SET thread_id = ?, status = 'elaborating', updated_at = datetime('now') WHERE id = ?").run(
    threadId,
    reportId,
  );
}

export function setReportStatus(db: Database, reportId: number, status: ReportStatus): Report {
  db.prepare("UPDATE reports SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, reportId);
  return getReportById(db, reportId)!;
}

export function incrementElaborationRound(db: Database, reportId: number): Report {
  db.prepare(
    "UPDATE reports SET elaboration_round = elaboration_round + 1, updated_at = datetime('now') WHERE id = ?",
  ).run(reportId);
  return getReportById(db, reportId)!;
}

export function setGithubIssueUrl(db: Database, reportId: number, url: string): Report {
  db.prepare(
    "UPDATE reports SET github_issue_url = ?, status = 'approved', updated_at = datetime('now') WHERE id = ?",
  ).run(url, reportId);
  return getReportById(db, reportId)!;
}

export function addConversationMessage(
  db: Database,
  reportId: number,
  role: ConversationTurn["role"],
  content: string,
): void {
  db.prepare("INSERT INTO conversation_messages (report_id, role, content) VALUES (?, ?, ?)").run(
    reportId,
    role,
    content,
  );
}

export function getTranscript(db: Database, reportId: number): ConversationTurn[] {
  const rows = db
    .prepare("SELECT role, content FROM conversation_messages WHERE report_id = ? ORDER BY id ASC")
    .all(reportId) as { role: ConversationTurn["role"]; content: string }[];
  return rows;
}

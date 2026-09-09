import { DEFAULT_STATUS_LABELS, type StatusLabelConfig } from "@issue-butler/core";
import type { Database } from "./index.js";

export interface GuildConfig {
  guildId: string;
  feedbackChannelId: string | null;
  moderatorRoleId: string | null;
  approvalEmoji: string;
  maxElaborationRounds: number;
  githubInstallationId: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  statusLabels: StatusLabelConfig;
}

interface GuildConfigRow {
  guild_id: string;
  feedback_channel_id: string | null;
  moderator_role_id: string | null;
  approval_emoji: string;
  max_elaboration_rounds: number;
  github_installation_id: string | null;
  github_owner: string | null;
  github_repo: string | null;
  backlog_labels: string;
  in_progress_labels: string;
}

function splitLabels(csv: string): string[] {
  return csv
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
}

function joinLabels(labels: string[]): string {
  return labels.map((label) => label.trim()).filter(Boolean).join(",");
}

function toGuildConfig(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    feedbackChannelId: row.feedback_channel_id,
    moderatorRoleId: row.moderator_role_id,
    approvalEmoji: row.approval_emoji,
    maxElaborationRounds: row.max_elaboration_rounds,
    githubInstallationId: row.github_installation_id,
    githubOwner: row.github_owner,
    githubRepo: row.github_repo,
    statusLabels: {
      backlogLabels: splitLabels(row.backlog_labels),
      inProgressLabels: splitLabels(row.in_progress_labels),
    },
  };
}

export function getGuildConfig(db: Database, guildId: string): GuildConfig | null {
  const row = db.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId) as
    | GuildConfigRow
    | undefined;
  return row ? toGuildConfig(row) : null;
}

export function getGuildConfigByInstallationId(db: Database, installationId: string): GuildConfig | null {
  const row = db.prepare("SELECT * FROM guild_config WHERE github_installation_id = ?").get(installationId) as
    | GuildConfigRow
    | undefined;
  return row ? toGuildConfig(row) : null;
}

export function listGuildConfigs(db: Database): GuildConfig[] {
  const rows = db.prepare("SELECT * FROM guild_config ORDER BY guild_id").all() as unknown as GuildConfigRow[];
  return rows.map(toGuildConfig);
}

/** Ensures a config row exists for the guild, without overwriting existing values. */
export function ensureGuildConfig(db: Database, guildId: string): GuildConfig {
  db.prepare(
    "INSERT OR IGNORE INTO guild_config (guild_id, backlog_labels, in_progress_labels) VALUES (?, ?, ?)",
  ).run(guildId, joinLabels(DEFAULT_STATUS_LABELS.backlogLabels), joinLabels(DEFAULT_STATUS_LABELS.inProgressLabels));
  const config = getGuildConfig(db, guildId);
  if (!config) throw new Error(`Failed to create guild config for ${guildId}`);
  return config;
}

export interface GuildConfigUpdate {
  feedbackChannelId?: string | null;
  moderatorRoleId?: string | null;
  approvalEmoji?: string;
  maxElaborationRounds?: number;
  githubInstallationId?: string | null;
  githubOwner?: string | null;
  githubRepo?: string | null;
  backlogLabels?: string[];
  inProgressLabels?: string[];
}

export function updateGuildConfig(db: Database, guildId: string, update: GuildConfigUpdate): GuildConfig {
  ensureGuildConfig(db, guildId);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (update.feedbackChannelId !== undefined) {
    fields.push("feedback_channel_id = ?");
    values.push(update.feedbackChannelId);
  }
  if (update.moderatorRoleId !== undefined) {
    fields.push("moderator_role_id = ?");
    values.push(update.moderatorRoleId);
  }
  if (update.approvalEmoji !== undefined) {
    fields.push("approval_emoji = ?");
    values.push(update.approvalEmoji);
  }
  if (update.maxElaborationRounds !== undefined) {
    fields.push("max_elaboration_rounds = ?");
    values.push(update.maxElaborationRounds);
  }
  if (update.githubInstallationId !== undefined) {
    fields.push("github_installation_id = ?");
    values.push(update.githubInstallationId);
  }
  if (update.githubOwner !== undefined) {
    fields.push("github_owner = ?");
    values.push(update.githubOwner);
  }
  if (update.githubRepo !== undefined) {
    fields.push("github_repo = ?");
    values.push(update.githubRepo);
  }
  if (update.backlogLabels !== undefined) {
    fields.push("backlog_labels = ?");
    values.push(joinLabels(update.backlogLabels));
  }
  if (update.inProgressLabels !== undefined) {
    fields.push("in_progress_labels = ?");
    values.push(joinLabels(update.inProgressLabels));
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(guildId);
    db.prepare(`UPDATE guild_config SET ${fields.join(", ")} WHERE guild_id = ?`).run(...(values as never[]));
  }

  return getGuildConfig(db, guildId)!;
}

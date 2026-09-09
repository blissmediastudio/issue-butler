import type { Database } from "./index.js";

export interface GuildConfig {
  guildId: string;
  feedbackChannelId: string | null;
  moderatorRoleId: string | null;
  approvalEmoji: string;
  maxElaborationRounds: number;
}

interface GuildConfigRow {
  guild_id: string;
  feedback_channel_id: string | null;
  moderator_role_id: string | null;
  approval_emoji: string;
  max_elaboration_rounds: number;
}

function toGuildConfig(row: GuildConfigRow): GuildConfig {
  return {
    guildId: row.guild_id,
    feedbackChannelId: row.feedback_channel_id,
    moderatorRoleId: row.moderator_role_id,
    approvalEmoji: row.approval_emoji,
    maxElaborationRounds: row.max_elaboration_rounds,
  };
}

export function getGuildConfig(db: Database, guildId: string): GuildConfig | null {
  const row = db.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId) as
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
  db.prepare("INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)").run(guildId);
  const config = getGuildConfig(db, guildId);
  if (!config) throw new Error(`Failed to create guild config for ${guildId}`);
  return config;
}

export type GuildConfigUpdate = Partial<Omit<GuildConfig, "guildId">>;

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

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(guildId);
    db.prepare(`UPDATE guild_config SET ${fields.join(", ")} WHERE guild_id = ?`).run(...(values as never[]));
  }

  return getGuildConfig(db, guildId)!;
}

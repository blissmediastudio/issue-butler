export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  feedback_channel_id TEXT,
  moderator_role_id TEXT,
  approval_emoji TEXT NOT NULL DEFAULT '👍',
  max_elaboration_rounds INTEGER NOT NULL DEFAULT 2,
  github_installation_id TEXT,
  github_owner TEXT,
  github_repo TEXT,
  backlog_labels TEXT NOT NULL DEFAULT 'backlog,planned,future-enhancement',
  in_progress_labels TEXT NOT NULL DEFAULT 'in-progress,in progress,wip',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guild_config_installation ON guild_config(github_installation_id);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  thread_id TEXT,
  author_id TEXT NOT NULL,
  author_tag TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug','feature','help-desk','general')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','elaborating','ready','approved','rejected')),
  elaboration_round INTEGER NOT NULL DEFAULT 0,
  github_issue_url TEXT,
  github_issue_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (guild_id) REFERENCES guild_config(guild_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_guild_status ON reports(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_guild_issue_number ON reports(guild_id, github_issue_number);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('bot','reporter')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_report ON conversation_messages(report_id);
`;

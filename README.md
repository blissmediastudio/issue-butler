# Issue Butler

A self-hosted Discord bot that turns reports posted in a channel into well-formed GitHub
issues. It classifies each message (bug / feature / help-desk / general), asks a couple of
clarifying questions in a thread if the report is thin on detail, and — once a moderator
approves it — files a labeled GitHub issue with the full conversation folded in.

Self-hosted means **you** run it: invite your own Discord bot to your own server, point it
at your own GitHub repo, and everything (bot token, GitHub token, optional AI key) stays in
your own environment. There's no central service and no third party holding your secrets.

## How it works

```
message in the monitored channel
  └─ classified (bug/feature/help-desk/general), reacted with a category emoji
  └─ short on detail? → thread opened, up to N clarifying questions asked
       (reporter replies advance it; "done" or the round cap ends it)
  └─ enough detail → embed posted with Approve / Reject buttons

moderator clicks Approve
  └─ report + Q&A folded into a GitHub issue (labeled from-discord + category)
  └─ embed updated with the issue link
```

Classification and question-asking are pluggable:

- **Default: rule-based.** Keyword classification, a fixed question bank. No API key, no cost.
- **Optional: Claude.** Set `ANTHROPIC_API_KEY` and an Anthropic model drives both classification
  and the clarifying questions instead. Bring your own key — nothing is shared with anyone else.

## Setup

### 1. Discord application

1. Create an application at <https://discord.com/developers/applications> and add a Bot.
2. Under **Bot → Privileged Gateway Intents**, enable **Message Content Intent**.
3. Generate an invite URL (OAuth2 → URL Generator) with the `bot` and `applications.commands`
   scopes, and these bot permissions: View Channels, Send Messages, Create Public Threads,
   Send Messages in Threads, Manage Threads, Embed Links, Add Reactions, Read Message History.
4. Invite the bot to your server.
5. Copy the bot token and application (client) ID into your `.env` (see `.env.example`).

### 2. In-Discord configuration

Once the bot is running and in your server, an admin (anyone with Manage Server) runs:

```
/setup channel #your-feedback-channel
/setup moderator-role @Moderators
/setup rounds 2
/setup show
```

These are stored locally in the bot's SQLite database — nothing sensitive goes through Discord.

### 3. GitHub issue pipeline (optional)

1. Create a **fine-grained personal access token** scoped to a single repo with
   **Issues: Read and write** and nothing else.
2. Set `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` in your `.env`.

Without these three, the bot still classifies and elaborates reports — the Approve button just
tells the moderator the pipeline isn't configured instead of creating an issue.

### 4. AI-assisted triage (optional)

Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-haiku-4-5`) to switch
from keyword classification to Claude-driven classification and conversation. This is entirely
opt-in and uses your own key — the rule-based path costs nothing and needs no external service.

### 5. Admin dashboard (optional)

Set `ADMIN_TOKEN` to a long random string to expose the admin API and React dashboard, which
lists reports, lets you filter by status/category, and edit the channel/role/round settings
from a browser instead of Discord commands. Leave it unset to run bot-only.

## Running

```sh
npm install
cp .env.example .env   # then fill in DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID at minimum

# Dev: bot with hot reload
npm run dev:bot

# Dev: admin dashboard (proxies /api to the bot's port)
npm run dev:client

# Build everything
npm run build

# Run the built bot (also serves the built dashboard if ADMIN_TOKEN is set)
node packages/bot/dist/index.js

# Tests / typecheck / lint
npm test
npm run typecheck
npm run lint
```

No native dependencies: the database uses Node's built-in `node:sqlite` (Node 22.5+), so
`npm install` never compiles anything.

## Project structure

```
packages/
  core/            pure logic shared by the bot: classification, the elaboration state
                    machine, and GitHub issue drafting. No I/O — this is the most heavily
                    tested package and the one most worth reading first.
  bot/             the Discord bot, SQLite storage, GitHub client, AI provider abstraction,
                    and the admin Express API.
    src/db/          guild config + report + conversation storage
    src/discord/     client setup, slash commands, message/interaction listeners, embeds
    src/github/      Octokit wrapper
    src/ai/          TriageProvider interface + rule-based and Claude implementations
    src/server/      admin API (bearer-token auth) + serves the built dashboard
  admin-client/    React + Vite dashboard that talks to the bot's admin API.
```

## Design notes

- **Secrets vs. config.** Bot token, GitHub token, and AI key are environment variables set at
  deploy time — never collected through Discord. Non-secret settings (channel, moderator role,
  round count) are configured via `/setup` and stored in SQLite.
- **One deployment, any number of guilds.** The bot can be invited to multiple servers from a
  single deployment; each guild gets its own row in `guild_config` and its own reports.
- **Dedupe.** A report's `github_issue_url` is the durable "already filed" marker — re-clicking
  Approve on an already-approved report just replies with the existing link.
- **Elaboration threads survive restarts.** State lives in SQLite (`reports.thread_id`,
  `reports.elaboration_round`, `conversation_messages`), not in memory.

## License

MIT — see [LICENSE](LICENSE).

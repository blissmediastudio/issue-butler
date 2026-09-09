# Issue Butler

A Discord bot that turns reports posted in a channel into well-formed GitHub issues, and
reports back when they're resolved. It classifies each message (bug / feature / help-desk /
general), asks a couple of clarifying questions in a thread if the report is thin on detail,
and — once a moderator approves it — files a labeled GitHub issue with the full conversation
folded in. When that issue is later closed, labeled `backlog`, or marked `in-progress` on
GitHub, Issue Butler posts an update back into the original Discord thread.

One deployment (one Discord bot token, one GitHub App registration) serves any number of
Discord servers — a server admin installs the bot and connects a repo without ever handling a
raw GitHub token.

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

...later, on GitHub...
  issue closed as completed   → thread: "🎉 Fixed!" / "🎉 Implemented!"
  issue closed as not planned → thread: "This won't be addressed right now."
  issue labeled `backlog`     → thread: "📋 Added to the backlog for a future release."
  issue labeled `in-progress` → thread: "🔧 Work has started on this."
  issue reopened              → thread: "Reopened — back under consideration."
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
4. Copy the bot token and application (client) ID into your `.env` (see `.env.example`).

### 2. GitHub App (once, for the whole deployment)

Issue Butler needs a **hosted, publicly reachable HTTPS URL** (`PUBLIC_BASE_URL`) — GitHub
delivers webhooks and install-flow redirects to it. A local `npm run dev` process behind a
tunnel (e.g. smee.io, ngrok) works for testing; production needs a real host.

1. Create a GitHub App at <https://github.com/settings/apps/new>:
   - **Homepage URL**: anything, e.g. `PUBLIC_BASE_URL`.
   - **Callback URL**: `PUBLIC_BASE_URL/connect/github/callback`.
   - **Setup URL**: same as the callback URL, and check "Redirect on update".
   - **Webhook URL**: `PUBLIC_BASE_URL/webhooks/github`. Generate and save a **Webhook secret**.
   - **Permissions**: Repository → Issues: Read and write, Metadata: Read-only.
   - **Subscribe to events**: Issues.
   - **Where can this GitHub App be installed?**: Any account (so other servers can install it).
2. After creating it, generate a **private key** (downloads a `.pem` file) and note the **App
   ID** and the **App slug** (from the app's URL, `github.com/apps/<slug>`).
3. Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (the `.pem` contents, with
   newlines escaped as `\n`), `GITHUB_WEBHOOK_SECRET`, `SESSION_SECRET`, and `PUBLIC_BASE_URL`
   in your `.env`.

This is a one-time, deployment-wide setup. Individual servers connect a repo per-guild in the
next step — no further App configuration needed as new servers install the bot.

### 3. In-Discord configuration (per server, by a server admin)

Once the bot is running and invited to a server:

```
/setup channel #your-feedback-channel
/setup moderator-role @Moderators
/setup connect-github          → DMs an ephemeral link; click it, pick a repo on GitHub
/setup repo owner/name         → only needed if the install has access to more than one repo
/setup rounds 2
/setup show
```

Channel, role, and repo choice are stored in the bot's SQLite database. The GitHub connection
itself happens entirely on GitHub's install page — no token is ever typed into Discord.

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
                    machine, GitHub issue drafting, and the GitHub-event → Discord-message
                    mapping. No I/O — this is the most heavily tested package.
  bot/             the Discord bot, SQLite storage, GitHub App integration, AI provider
                    abstraction, and the admin Express API.
    src/db/          guild config + report + conversation storage
    src/discord/     client setup, slash commands, message/interaction listeners, embeds,
                     posting GitHub status updates back into threads
    src/github/      App auth, issue creation, webhook payload mapping, webhook handler
                     registration
    src/ai/          TriageProvider interface + rule-based and Claude implementations
    src/server/      admin API (bearer-token auth), the GitHub install flow, the webhook
                     receiver, and serving the built dashboard
  admin-client/    React + Vite dashboard that talks to the bot's admin API.
```

## Design notes

- **Secrets vs. config.** Bot token, GitHub App credentials, and AI key are environment
  variables set at deploy time — this deployment's operator holds them, not individual server
  admins. Per-server GitHub repo access flows through the App's own install/authorization
  page, so a raw token never passes through Discord or this bot's database. Non-secret settings
  (channel, moderator role, round count, connected repo) are configured via `/setup` and stored
  in SQLite.
- **One deployment, any number of guilds.** The bot can be invited to multiple servers from a
  single deployment; each guild gets its own row in `guild_config` (including its own GitHub
  App installation id and connected repo) and its own reports.
- **Dedupe.** A report's `github_issue_url` is the durable "already filed" marker — re-clicking
  Approve on an already-approved report just replies with the existing link.
- **Elaboration threads survive restarts.** State lives in SQLite (`reports.thread_id`,
  `reports.elaboration_round`, `conversation_messages`), not in memory.
- **Status labels are configurable, not fixed.** `backlog`/`planned`/`future-enhancement` and
  `in-progress`/`wip` are the defaults (`guild_config.backlog_labels` /
  `.in_progress_labels`), matched case-insensitively — label taxonomies vary a lot between
  repos, so these aren't hardcoded.
- **Webhook signature verification** happens via `@octokit/app`'s `webhooks.verifyAndReceive`,
  which needs the raw request body — the webhook route is mounted with `express.raw()` and
  registered *before* the global `express.json()` middleware so the body stream isn't already
  consumed by the time it gets there.

## License

MIT — see [LICENSE](LICENSE).

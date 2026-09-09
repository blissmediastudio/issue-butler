import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { openDatabase } from "./db/index.js";
import { createDiscordClient } from "./discord/client.js";
import { wireReadyHandlers } from "./discord/listeners/ready.js";
import { createMessageCreateHandler } from "./discord/listeners/messageCreate.js";
import { createInteractionCreateHandler } from "./discord/listeners/interactionCreate.js";
import { createTriageProvider } from "./ai/index.js";
import { createGithubApp } from "./github/app.js";
import { registerWebhookHandlers } from "./github/registerWebhookHandlers.js";
import { createServer } from "./server/index.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  const db = openDatabase(config.DATABASE_PATH);
  logger.info("Database ready", { path: config.DATABASE_PATH });

  const triageProvider = createTriageProvider(config);
  logger.info("Triage provider selected", { provider: triageProvider.name });

  const client = createDiscordClient();

  const githubApp = createGithubApp(config);
  if (githubApp) {
    registerWebhookHandlers(githubApp, db, client, logger);
    logger.info("GitHub App integration enabled", { appId: config.GITHUB_APP_ID });
  } else {
    logger.warn(
      "GitHub App integration disabled — set GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_PRIVATE_KEY, " +
        "GITHUB_WEBHOOK_SECRET, SESSION_SECRET, PUBLIC_BASE_URL to enable",
    );
  }

  wireReadyHandlers(client, db, config.DISCORD_BOT_TOKEN, config.DISCORD_CLIENT_ID, logger);
  client.on("messageCreate", createMessageCreateHandler({ db, triageProvider, logger }));
  client.on("interactionCreate", createInteractionCreateHandler({ db, config, githubApp, logger }));

  await client.login(config.DISCORD_BOT_TOKEN);

  const app = createServer({ db, adminToken: config.ADMIN_TOKEN ?? null, config, githubApp, logger });
  const server = app.listen(config.PORT, () => {
    logger.info("Admin API listening", { port: config.PORT, adminApiEnabled: config.adminApiEnabled });
  });

  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });
    server.close();
    client.destroy();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});

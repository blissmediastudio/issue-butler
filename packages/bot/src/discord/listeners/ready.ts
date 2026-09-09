import type { Client, Guild } from "discord.js";
import type { Database } from "../../db/index.js";
import { ensureGuildConfig } from "../../db/guildConfig.js";
import type { Logger } from "../../logger.js";
import { registerGuildCommands } from "../commands/index.js";

export function wireReadyHandlers(client: Client, db: Database, token: string, clientId: string, logger: Logger): void {
  client.once("ready", async (readyClient) => {
    logger.info("Logged in to Discord", { tag: readyClient.user.tag, guilds: readyClient.guilds.cache.size });
    for (const guild of readyClient.guilds.cache.values()) {
      await registerForGuild(guild, db, token, clientId, logger);
    }
  });

  client.on("guildCreate", async (guild) => {
    await registerForGuild(guild, db, token, clientId, logger);
  });
}

async function registerForGuild(guild: Guild, db: Database, token: string, clientId: string, logger: Logger): Promise<void> {
  ensureGuildConfig(db, guild.id);
  try {
    await registerGuildCommands(token, clientId, guild.id, logger);
  } catch (error) {
    logger.error("Failed to register commands for guild", { guildId: guild.id, error: String(error) });
  }
}

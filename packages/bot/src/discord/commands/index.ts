import { REST, Routes } from "discord.js";
import type { Logger } from "../../logger.js";
import { setupCommand } from "./setup.js";
import { statusCommand } from "./status.js";

export const commands = [setupCommand, statusCommand];

export async function registerGuildCommands(
  token: string,
  clientId: string,
  guildId: string,
  logger: Logger,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands.map((command) => command.toJSON()),
  });
  logger.info("Registered slash commands", { guildId, commands: commands.length });
}

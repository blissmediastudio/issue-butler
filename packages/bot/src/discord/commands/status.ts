import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { emojiForCategory } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { countReportsByCategory } from "../../db/reports.js";

export const statusCommand = new SlashCommandBuilder()
  .setName("status")
  .setDescription("Show report counts by category for this server");

export async function handleStatusCommand(interaction: ChatInputCommandInteraction, db: Database): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return;
  }

  const counts = countReportsByCategory(db, interaction.guildId!);
  const lines = (Object.keys(counts) as (keyof typeof counts)[]).map(
    (category) => `${emojiForCategory(category)} **${category}**: ${counts[category]}`,
  );

  await interaction.reply({ content: lines.join("\n"), ephemeral: true });
}

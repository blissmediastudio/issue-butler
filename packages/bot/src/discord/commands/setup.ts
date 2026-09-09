import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Database } from "../../db/index.js";
import { getGuildConfig, updateGuildConfig } from "../../db/guildConfig.js";

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure Issue Butler for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName("channel")
      .setDescription("Set the channel Issue Butler monitors for reports")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to monitor")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("moderator-role")
      .setDescription("Set the role allowed to approve reports")
      .addRoleOption((opt) => opt.setName("role").setDescription("Moderator role").setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName("rounds")
      .setDescription("Set the max clarifying-question rounds before a report is marked ready")
      .addIntegerOption((opt) =>
        opt.setName("count").setDescription("Max rounds (0-10)").setMinValue(0).setMaxValue(10).setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("show").setDescription("Show the current configuration"));

export async function handleSetupCommand(interaction: ChatInputCommandInteraction, db: Database): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;

  if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel", true);
    const config = updateGuildConfig(db, guildId, { feedbackChannelId: channel.id });
    await interaction.reply({
      content: `Monitoring <#${config.feedbackChannelId}> for reports.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "moderator-role") {
    const role = interaction.options.getRole("role", true);
    const config = updateGuildConfig(db, guildId, { moderatorRoleId: role.id });
    await interaction.reply({
      content: `<@&${config.moderatorRoleId}> can now approve reports.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "rounds") {
    const count = interaction.options.getInteger("count", true);
    const config = updateGuildConfig(db, guildId, { maxElaborationRounds: count });
    await interaction.reply({
      content: `Reports get up to ${config.maxElaborationRounds} clarifying question round(s).`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "show") {
    const config = getGuildConfig(db, guildId);
    if (!config) {
      await interaction.reply({ content: "Not configured yet. Start with `/setup channel`.", ephemeral: true });
      return;
    }
    const lines = [
      `**Feedback channel:** ${config.feedbackChannelId ? `<#${config.feedbackChannelId}>` : "not set"}`,
      `**Moderator role:** ${config.moderatorRoleId ? `<@&${config.moderatorRoleId}>` : "not set"}`,
      `**Max elaboration rounds:** ${config.maxElaborationRounds}`,
    ];
    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
  }
}

import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Database } from "../../db/index.js";
import { ensureGuildConfig, getGuildConfig, updateGuildConfig } from "../../db/guildConfig.js";
import type { Config } from "../../config.js";
import { listAccessibleRepos, type IssueButlerGithubApp } from "../../github/app.js";
import { DEFAULT_STATUS_LABELS } from "@issue-butler/core";

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
  .addSubcommand((sub) => sub.setName("connect-github").setDescription("Get a link to grant Issue Butler access to a GitHub repo"))
  .addSubcommand((sub) =>
    sub
      .setName("repo")
      .setDescription("Pick which accessible repo to file issues in (if more than one)")
      .addStringOption((opt) =>
        opt.setName("full_name").setDescription("owner/repo, must already be accessible to the GitHub App install").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("labels")
      .setDescription("Configure backlog and in-progress label mappings")
      .addStringOption((opt) =>
        opt.setName("backlog").setDescription("Comma-separated backlog labels, or 'default' to reset both lists").setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName("in_progress").setDescription("Comma-separated in-progress labels (e.g. in-progress, wip)").setRequired(false),
      ),
  )
  .addSubcommand((sub) => sub.setName("show").setDescription("Show the current configuration"));

export interface SetupCommandDeps {
  db: Database;
  config: Config;
  githubApp: IssueButlerGithubApp | null;
}

export async function handleSetupCommand(
  interaction: ChatInputCommandInteraction,
  { db, config, githubApp }: SetupCommandDeps,
): Promise<void> {
  console.log("[DEBUG] handleSetupCommand called");
  if (!interaction.inGuild()) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  console.log("[DEBUG] subcommand:", subcommand);
  const guildId = interaction.guildId!;

  if (subcommand === "channel") {
    const channel = interaction.options.getChannel("channel", true);
    const updated = updateGuildConfig(db, guildId, { feedbackChannelId: channel.id });
    await interaction.reply({
      content: `Monitoring <#${updated.feedbackChannelId}> for reports.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "moderator-role") {
    const role = interaction.options.getRole("role", true);
    const updated = updateGuildConfig(db, guildId, { moderatorRoleId: role.id });
    await interaction.reply({
      content: `<@&${updated.moderatorRoleId}> can now approve reports.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "rounds") {
    const count = interaction.options.getInteger("count", true);
    const updated = updateGuildConfig(db, guildId, { maxElaborationRounds: count });
    await interaction.reply({
      content: `Reports get up to ${updated.maxElaborationRounds} clarifying question round(s).`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "connect-github") {
    if (!config.githubAppEnabled) {
      await interaction.reply({
        content: "GitHub integration isn't configured on this deployment.",
        ephemeral: true,
      });
      return;
    }
    const url = `${config.PUBLIC_BASE_URL}/connect/github/start?guildId=${guildId}`;
    await interaction.reply({
      content: `Click to grant Issue Butler access to a repo: ${url}\nOnly server admins should use this link.`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "repo") {
    const fullName = interaction.options.getString("full_name", true);
    const current = getGuildConfig(db, guildId);
    if (!githubApp || !current?.githubInstallationId) {
      await interaction.reply({
        content: "Run `/setup connect-github` first to grant repo access.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const accessible = await listAccessibleRepos(githubApp, Number(current.githubInstallationId));
    const match = accessible.find((r) => `${r.owner}/${r.repo}`.toLowerCase() === fullName.toLowerCase());

    if (!match) {
      const list = accessible.map((r) => `${r.owner}/${r.repo}`).join(", ") || "none";
      await interaction.editReply(`"${fullName}" isn't accessible to this install. Accessible repos: ${list}`);
      return;
    }

    updateGuildConfig(db, guildId, { githubOwner: match.owner, githubRepo: match.repo });
    await interaction.editReply(`Now filing issues in ${match.owner}/${match.repo}.`);
    return;
  }

  if (subcommand === "labels") {
    try {
      const backlogInput = interaction.options.getString("backlog");
      const inProgressInput = interaction.options.getString("in_progress");

      if (!backlogInput && !inProgressInput) {
        await interaction.reply({
          content: "At least one of `backlog` or `in_progress` must be supplied.",
          ephemeral: true,
        });
        return;
      }

      if (backlogInput?.trim().toLowerCase() === "default") {
        const updated = updateGuildConfig(db, guildId, {
          backlogLabels: DEFAULT_STATUS_LABELS.backlogLabels,
          inProgressLabels: DEFAULT_STATUS_LABELS.inProgressLabels,
        });
        await interaction.reply({
          content: `Reset to defaults:\n**Backlog labels:** ${updated.statusLabels.backlogLabels.join(", ")}\n**In-progress labels:** ${updated.statusLabels.inProgressLabels.join(", ")}`,
          ephemeral: true,
        });
        return;
      }

      const current = ensureGuildConfig(db, guildId);
      const parseLabels = (input: string): string[] => {
        return input
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
      };

      const backlogLabels = backlogInput ? parseLabels(backlogInput) : current.statusLabels.backlogLabels;
      const inProgressLabels = inProgressInput ? parseLabels(inProgressInput) : current.statusLabels.inProgressLabels;

      const backlogLower = backlogLabels.map((label) => label.toLowerCase());
      const inProgressLower = inProgressLabels.map((label) => label.toLowerCase());
      const conflicts = backlogLower.filter((label) => inProgressLower.includes(label));

      if (conflicts.length > 0) {
        const conflictList = conflicts.map((label) => `"${label}"`).join(", ");
        await interaction.reply({
          content: `Cannot have the same label in both lists: ${conflictList}`,
          ephemeral: true,
        });
        return;
      }

      const update: { backlogLabels?: string[]; inProgressLabels?: string[] } = {};
      if (backlogInput) {
        update.backlogLabels = backlogLabels;
      }
      if (inProgressInput) {
        update.inProgressLabels = inProgressLabels;
      }

      const updated = updateGuildConfig(db, guildId, update);
      await interaction.reply({
        content: `**Backlog labels:** ${updated.statusLabels.backlogLabels.join(", ")}\n**In-progress labels:** ${updated.statusLabels.inProgressLabels.join(", ")}`,
        ephemeral: true,
      });
      return;
    } catch (error) {
      console.error("[ERROR] labels subcommand error:", error);
      await interaction.reply({
        content: "An error occurred while updating labels. Check the bot logs.",
        ephemeral: true,
      });
      return;
    }
  }

  if (subcommand === "show") {
    console.log("[DEBUG] show subcommand handler");
    const current = getGuildConfig(db, guildId);
    console.log("[DEBUG] current config:", current ? "found" : "null");
    if (!current) {
      await interaction.reply({ content: "Not configured yet. Start with `/setup channel`.", ephemeral: true });
      return;
    }
    const githubStatus =
      current.githubOwner && current.githubRepo ? `${current.githubOwner}/${current.githubRepo}` : "not connected";
    const lines = [
      `**Feedback channel:** ${current.feedbackChannelId ? `<#${current.feedbackChannelId}>` : "not set"}`,
      `**Moderator role:** ${current.moderatorRoleId ? `<@&${current.moderatorRoleId}>` : "not set"}`,
      `**Max elaboration rounds:** ${current.maxElaborationRounds}`,
      `**GitHub repo:** ${githubStatus}`,
      `**Backlog labels:** ${current.statusLabels.backlogLabels.join(", ")}`,
      `**In-progress labels:** ${current.statusLabels.inProgressLabels.join(", ")}`,
    ];
    console.log("[DEBUG] about to reply with:", lines.join("\n"));
    await interaction.reply({ content: lines.join("\n"), ephemeral: true });
    console.log("[DEBUG] reply sent");
    return;
  }
}

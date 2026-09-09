import { PermissionFlagsBits, type ButtonInteraction, type Interaction } from "discord.js";
import { buildIssueDraft } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { getGuildConfig } from "../../db/guildConfig.js";
import { getReportById, getTranscript, setGithubIssueUrl, setReportStatus } from "../../db/reports.js";
import type { GithubClient } from "../../github/client.js";
import type { Logger } from "../../logger.js";
import { buildApprovalRow, buildReportEmbed } from "../embeds.js";
import { handleSetupCommand } from "../commands/setup.js";
import { handleStatusCommand } from "../commands/status.js";

export interface InteractionCreateDeps {
  db: Database;
  githubClient: GithubClient | null;
  logger: Logger;
}

export function createInteractionCreateHandler({ db, githubClient, logger }: InteractionCreateDeps) {
  return async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "setup") return handleSetupCommand(interaction, db);
        if (interaction.commandName === "status") return handleStatusCommand(interaction, db);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("report_")) {
        await handleReportButton(interaction, { db, githubClient, logger });
      }
    } catch (error) {
      logger.error("Unhandled interaction error", { error: String(error) });
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.reply({ content: "Something went wrong handling that.", ephemeral: true }).catch(() => undefined);
      }
    }
  };
}

function isModerator(interaction: ButtonInteraction, moderatorRoleId: string | null): boolean {
  if (!interaction.inCachedGuild()) return false;
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!moderatorRoleId) return false;
  return interaction.member.roles.cache.has(moderatorRoleId);
}

async function handleReportButton(
  interaction: ButtonInteraction,
  { db, githubClient, logger }: InteractionCreateDeps,
): Promise<void> {
  const [, action, idStr] = interaction.customId.split("_");
  const reportId = Number(idStr);
  const report = getReportById(db, reportId);
  if (!report) {
    await interaction.reply({ content: "That report no longer exists.", ephemeral: true });
    return;
  }

  const guildConfig = getGuildConfig(db, report.guildId);
  if (!isModerator(interaction, guildConfig?.moderatorRoleId ?? null)) {
    await interaction.reply({ content: "You don't have permission to moderate reports.", ephemeral: true });
    return;
  }

  if (action === "reject") {
    const updated = setReportStatus(db, report.id, "rejected");
    const jumpUrl = `https://discord.com/channels/${updated.guildId}/${updated.channelId}/${updated.messageId}`;
    await interaction.update({ embeds: [buildReportEmbed(updated, jumpUrl)], components: [buildApprovalRow(updated.id, true)] });
    return;
  }

  if (action === "approve") {
    if (report.githubIssueUrl) {
      await interaction.reply({ content: `Already created: ${report.githubIssueUrl}`, ephemeral: true });
      return;
    }
    if (!githubClient) {
      await interaction.reply({
        content: "GitHub integration isn't configured on this deployment (GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO).",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    const jumpUrl = `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;
    const draft = buildIssueDraft({
      rawText: report.rawContent,
      category: report.category,
      authorTag: report.authorTag,
      sourceUrl: jumpUrl,
      transcript: getTranscript(db, report.id),
    });

    try {
      const issue = await githubClient.createIssue(draft);
      const updated = setGithubIssueUrl(db, report.id, issue.url);
      await interaction.editReply({ embeds: [buildReportEmbed(updated, jumpUrl)], components: [buildApprovalRow(updated.id, true)] });
    } catch (error) {
      logger.error("Failed to create GitHub issue", { reportId: report.id, error: String(error) });
      await interaction.followUp({ content: "Failed to create the GitHub issue. Check the bot logs.", ephemeral: true });
    }
  }
}

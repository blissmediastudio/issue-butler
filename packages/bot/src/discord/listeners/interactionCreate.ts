import { PermissionFlagsBits, type ButtonInteraction, type Interaction } from "discord.js";
import { buildIssueDraft } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { getGuildConfig } from "../../db/guildConfig.js";
import { getReportById, getTranscript, setGithubIssue, setReportStatus } from "../../db/reports.js";
import { createIssue } from "../../github/issues.js";
import type { IssueButlerGithubApp } from "../../github/app.js";
import type { Config } from "../../config.js";
import type { Logger } from "../../logger.js";
import { buildApprovalRow, buildReportEmbed } from "../embeds.js";
import { handleSetupCommand } from "../commands/setup.js";
import { handleStatusCommand } from "../commands/status.js";

export interface InteractionCreateDeps {
  db: Database;
  config: Config;
  githubApp: IssueButlerGithubApp | null;
  logger: Logger;
}

export function createInteractionCreateHandler({ db, config, githubApp, logger }: InteractionCreateDeps) {
  return async function handleInteractionCreate(interaction: Interaction): Promise<void> {
    try {
      console.log("[DEBUG] Interaction received:", interaction.type);
      if (interaction.isChatInputCommand()) {
        console.log("[DEBUG] Chat input command:", interaction.commandName);
        if (interaction.commandName === "setup") return handleSetupCommand(interaction, { db, config, githubApp });
        if (interaction.commandName === "status") return handleStatusCommand(interaction, db);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith("report_")) {
        await handleReportButton(interaction, { db, config, githubApp, logger });
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
  { db, githubApp, logger }: InteractionCreateDeps,
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
    if (!githubApp || !guildConfig?.githubInstallationId || !guildConfig.githubOwner || !guildConfig.githubRepo) {
      await interaction.reply({
        content: "GitHub isn't connected for this server. An admin can run `/setup connect-github`.",
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
      const octokit = await githubApp.getInstallationOctokit(Number(guildConfig.githubInstallationId));
      const issue = await createIssue(octokit, guildConfig.githubOwner, guildConfig.githubRepo, draft);
      const updated = setGithubIssue(db, report.id, issue.url, issue.number);
      await interaction.editReply({ embeds: [buildReportEmbed(updated, jumpUrl)], components: [buildApprovalRow(updated.id, true)] });
    } catch (error) {
      logger.error("Failed to create GitHub issue", { reportId: report.id, error: String(error) });
      await interaction.followUp({ content: "Failed to create the GitHub issue. Check the bot logs.", ephemeral: true });
    }
  }
}

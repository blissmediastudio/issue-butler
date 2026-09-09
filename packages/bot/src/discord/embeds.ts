import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { emojiForCategory } from "@issue-butler/core";
import type { Report } from "../db/reports.js";

const STATUS_COLOR: Record<Report["status"], number> = {
  open: 0xf1c40f,
  elaborating: 0x3498db,
  ready: 0x9b59b6,
  approved: 0x2ecc71,
  rejected: 0xe74c3c,
};

export function buildReportEmbed(report: Report, jumpUrl: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`${emojiForCategory(report.category)} ${report.category} — #${report.id}`)
    .setDescription(report.rawContent.slice(0, 500))
    .setColor(STATUS_COLOR[report.status])
    .addFields(
      { name: "Reporter", value: `<@${report.authorId}>`, inline: true },
      { name: "Status", value: report.status, inline: true },
      { name: "Source", value: `[jump](${jumpUrl})`, inline: true },
    )
    .setTimestamp(new Date(report.updatedAt));

  if (report.githubIssueUrl) {
    embed.addFields({ name: "GitHub Issue", value: report.githubIssueUrl });
  }

  return embed;
}

export function buildApprovalRow(reportId: number, disabled: boolean): ActionRowBuilder<ButtonBuilder> {
  const approve = new ButtonBuilder()
    .setCustomId(`report_approve_${reportId}`)
    .setLabel("Approve → Create Issue")
    .setStyle(ButtonStyle.Success)
    .setDisabled(disabled);

  const reject = new ButtonBuilder()
    .setCustomId(`report_reject_${reportId}`)
    .setLabel("Reject")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(approve, reject);
}

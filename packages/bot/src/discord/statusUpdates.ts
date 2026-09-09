import type { Client } from "discord.js";
import { messageForGithubEvent } from "@issue-butler/core";
import type { GuildConfig } from "../db/guildConfig.js";
import type { Report } from "../db/reports.js";
import type { IssuesWebhookPayload } from "../github/webhookEvents.js";
import { mapIssuesPayloadToEvent } from "../github/webhookEvents.js";
import type { Logger } from "../logger.js";

/**
 * Posts a GitHub status change back into the report's Discord thread (or, if the report
 * never got a thread, as a standalone update in its original channel). No-ops when the
 * event doesn't map to anything worth surfacing.
 */
export async function postGithubStatusUpdate(
  client: Client,
  report: Report,
  guildConfig: GuildConfig,
  payload: IssuesWebhookPayload,
  logger: Logger,
): Promise<void> {
  const event = mapIssuesPayloadToEvent(payload);
  if (!event) return;

  const message = messageForGithubEvent(event, report.category, guildConfig.statusLabels);
  if (!message) return;

  const targetChannelId = report.threadId ?? report.channelId;
  const channel = await client.channels.fetch(targetChannelId).catch(() => null);
  // Guild-only bot: excluding DM-based channels here (on top of isTextBased()) is what
  // narrows away PartialGroupDMChannel, which has no `.send()`.
  if (!channel?.isTextBased() || channel.isDMBased()) {
    logger.warn("Could not resolve channel for status update", { reportId: report.id, targetChannelId });
    return;
  }

  const body = report.threadId
    ? message
    : `**Update on report #${report.id}:** ${message}\nhttps://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;

  await channel.send(body);
}

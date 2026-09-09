import type { Client } from "discord.js";
import type { Database } from "../db/index.js";
import { getGuildConfigByInstallationId } from "../db/guildConfig.js";
import { getReportByIssueNumber } from "../db/reports.js";
import { postGithubStatusUpdate } from "../discord/statusUpdates.js";
import type { Logger } from "../logger.js";
import type { IssueButlerGithubApp } from "./app.js";
import type { IssuesWebhookPayload } from "./webhookEvents.js";

/**
 * Wires the `issues` webhook events this bot cares about to posting a status update back
 * into the originating Discord thread. Registered once at startup against the shared App
 * instance; the Express webhook route only handles signature verification and dispatch.
 */
export function registerWebhookHandlers(
  app: IssueButlerGithubApp,
  db: Database,
  discordClient: Client,
  logger: Logger,
): void {
  app.webhooks.on(["issues.closed", "issues.reopened", "issues.labeled", "issues.unlabeled"], async ({ payload }) => {
    const issuesPayload = payload as unknown as IssuesWebhookPayload;
    const installationId = issuesPayload.installation?.id;
    const issueNumber = issuesPayload.issue?.number;
    if (!installationId || !issueNumber) return;

    const guildConfig = getGuildConfigByInstallationId(db, String(installationId));
    if (!guildConfig) return;

    const report = getReportByIssueNumber(db, guildConfig.guildId, issueNumber);
    if (!report) return;

    try {
      await postGithubStatusUpdate(discordClient, report, guildConfig, issuesPayload, logger);
    } catch (error) {
      logger.error("Failed to post GitHub status update to Discord", {
        reportId: report.id,
        error: String(error),
      });
    }
  });

  app.webhooks.onError((error) => {
    logger.warn("GitHub webhook handler error", { error: String(error) });
  });
}

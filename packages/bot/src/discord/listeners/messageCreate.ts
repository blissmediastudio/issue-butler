import type { Message, TextChannel } from "discord.js";
import { advanceConversation, emojiForCategory, reporterSignalsDone, type ConversationState } from "@issue-butler/core";
import type { Database } from "../../db/index.js";
import { getGuildConfig } from "../../db/guildConfig.js";
import {
  addConversationMessage,
  attachThread,
  createReport,
  getReportById,
  getReportByThreadId,
  getTranscript,
  incrementElaborationRound,
  setReportStatus,
} from "../../db/reports.js";
import type { TriageProvider } from "../../ai/provider.js";
import type { Logger } from "../../logger.js";
import { buildReportEmbed, buildApprovalRow } from "../embeds.js";

export interface MessageCreateDeps {
  db: Database;
  triageProvider: TriageProvider;
  logger: Logger;
}

export function createMessageCreateHandler({ db, triageProvider, logger }: MessageCreateDeps) {
  return async function handleMessageCreate(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) return;

    if (message.channel.isThread()) {
      await handleThreadReply(message, { db, triageProvider, logger });
      return;
    }

    await handleNewReport(message, { db, triageProvider, logger });
  };
}

async function handleNewReport(message: Message, { db, triageProvider, logger }: MessageCreateDeps): Promise<void> {
  const config = getGuildConfig(db, message.guildId!);
  if (!config?.feedbackChannelId || config.feedbackChannelId !== message.channelId) return;
  if (!message.content.trim()) return;

  const classification = await triageProvider.classify(message.content);

  try {
    await message.react(emojiForCategory(classification.category));
  } catch (error) {
    logger.warn("Failed to react to report", { error: String(error) });
  }

  const report = createReport(db, {
    guildId: message.guildId!,
    channelId: message.channelId,
    messageId: message.id,
    authorId: message.author.id,
    authorTag: message.author.tag,
    rawContent: message.content,
    category: classification.category,
    status: "open",
  });

  const nextQuestion = await triageProvider.nextQuestion({
    category: report.category,
    rawText: report.rawContent,
    transcript: [],
    askedQuestions: [],
  });

  if (nextQuestion === null) {
    setReportStatus(db, report.id, "ready");
    await postApprovalMessage(message.channel as TextChannel, report.id, db);
    return;
  }

  const thread = await message.startThread({
    name: `${classification.category}: ${message.content.slice(0, 60)}`,
    reason: "Issue Butler elaboration thread",
  });
  attachThread(db, report.id, thread.id);
  addConversationMessage(db, report.id, "bot", nextQuestion);
  await thread.send(`Thanks for the report! ${nextQuestion}\n\n(Reply here, or say "done" to submit as-is.)`);
}

async function handleThreadReply(message: Message, { db, triageProvider, logger }: MessageCreateDeps): Promise<void> {
  if (!message.channel.isThread()) return; // re-narrow: type is lost across the function boundary
  const thread = message.channel;

  const report = getReportByThreadId(db, message.channelId);
  if (!report || report.status !== "elaborating") return;
  if (message.author.id !== report.authorId) return;
  if (!message.content.trim()) return;

  const config = getGuildConfig(db, report.guildId);
  const maxRounds = config?.maxElaborationRounds ?? 2;

  addConversationMessage(db, report.id, "reporter", message.content);
  const transcript = getTranscript(db, report.id);
  const askedQuestions = transcript.filter((turn) => turn.role === "bot").map((turn) => turn.content);

  const state: ConversationState = {
    round: report.elaborationRound,
    maxRounds,
    askedQuestions,
    complete: false,
    completionReason: "not-complete",
  };

  const nextQuestion = reporterSignalsDone(message.content)
    ? null
    : await triageProvider.nextQuestion({
        category: report.category,
        rawText: report.rawContent,
        transcript,
        askedQuestions,
      });

  const nextState = advanceConversation(state, message.content, nextQuestion);
  incrementElaborationRound(db, report.id);

  if (nextState.complete) {
    setReportStatus(db, report.id, "ready");
    try {
      await thread.send("Got it — that's enough detail. A moderator will review this shortly. 🏁");
      await thread.setLocked(true).catch(() => undefined);
      await thread.setArchived(true).catch(() => undefined);
    } catch (error) {
      logger.warn("Failed to close elaboration thread", { error: String(error) });
    }

    const channel = (await message.client.channels.fetch(report.channelId).catch(() => null)) as TextChannel | null;
    if (channel) await postApprovalMessage(channel, report.id, db);
    return;
  }

  addConversationMessage(db, report.id, "bot", nextQuestion!);
  await thread.send(nextQuestion!);
}

async function postApprovalMessage(channel: TextChannel, reportId: number, db: Database): Promise<void> {
  const report = getReportById(db, reportId);
  if (!report) return;

  const jumpUrl = `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;
  const embed = buildReportEmbed(report, jumpUrl);
  const row = buildApprovalRow(report.id, false);
  await channel.send({ embeds: [embed], components: [row] });
}

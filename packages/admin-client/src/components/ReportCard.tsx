import { useState } from "react";
import type { ConversationTurn } from "@issue-butler/core";
import type { ApiClient, Report } from "../api";
import { formatCategory, formatRelativeTime } from "../format";
import { StatusBadge } from "./StatusBadge";

export function ReportCard({ report, api }: { report: Report; api: ApiClient }) {
  const jumpUrl = `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;

  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState<ConversationTurn[] | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const toggleTranscript = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && transcript === null && !transcriptLoading) {
      setTranscriptLoading(true);
      setTranscriptError(null);
      api
        .getTranscript(report.id)
        .then(setTranscript)
        .catch((err: Error) => setTranscriptError(err.message))
        .finally(() => setTranscriptLoading(false));
    }
  };

  return (
    <div className="report-card">
      <div className="report-card-header">
        <span className="report-category">{formatCategory(report.category)}</span>
        <StatusBadge status={report.status} />
      </div>
      <p className="report-content">{report.rawContent}</p>
      <div className="report-meta">
        <span>{report.authorTag}</span>
        <span>{formatRelativeTime(report.createdAt)}</span>
        <a href={jumpUrl} target="_blank" rel="noreferrer">
          Jump to Discord
        </a>
        {report.githubIssueUrl && (
          <a href={report.githubIssueUrl} target="_blank" rel="noreferrer">
            View issue
          </a>
        )}
        <button type="button" className="transcript-toggle" onClick={toggleTranscript}>
          {expanded ? "Hide conversation" : "View conversation"}
        </button>
      </div>
      {expanded && (
        <div className="transcript">
          {transcriptLoading && <p>Loading…</p>}
          {transcriptError && <p className="error">{transcriptError}</p>}
          {!transcriptLoading && !transcriptError && transcript?.length === 0 && (
            <p className="transcript-empty">No clarifying conversation for this report.</p>
          )}
          {!transcriptLoading &&
            !transcriptError &&
            transcript?.map((turn, i) => (
              <div key={i} className={`transcript-turn transcript-turn-${turn.role}`}>
                <span className="transcript-role">{turn.role === "bot" ? "Issue Butler" : report.authorTag}</span>
                <span className="transcript-content">{turn.content}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

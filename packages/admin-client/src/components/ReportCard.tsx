import type { Report } from "../api";
import { formatCategory, formatRelativeTime } from "../format";
import { StatusBadge } from "./StatusBadge";

export function ReportCard({ report }: { report: Report }) {
  const jumpUrl = `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;

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
      </div>
    </div>
  );
}

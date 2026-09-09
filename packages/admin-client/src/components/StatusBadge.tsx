import type { ReportStatus } from "@issue-butler/core";
import { formatStatus, statusColor } from "../format";

export function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "#fff",
        background: statusColor(status),
      }}
    >
      {formatStatus(status)}
    </span>
  );
}

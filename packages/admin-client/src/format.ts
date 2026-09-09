import type { Category, ReportStatus } from "@issue-butler/core";

const CATEGORY_LABELS: Record<Category, string> = {
  bug: "🐛 Bug",
  feature: "💡 Feature",
  "help-desk": "🎫 Help desk",
  general: "💬 General",
};

export function formatCategory(category: Category): string {
  return CATEGORY_LABELS[category];
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Open",
  elaborating: "Elaborating",
  ready: "Ready for review",
  approved: "Approved",
  rejected: "Rejected",
};

export function formatStatus(status: ReportStatus): string {
  return STATUS_LABELS[status];
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  open: "#f1c40f",
  elaborating: "#3498db",
  ready: "#9b59b6",
  approved: "#2ecc71",
  rejected: "#e74c3c",
};

export function statusColor(status: ReportStatus): string {
  return STATUS_COLORS[status];
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(`${isoDate.replace(" ", "T")}Z`);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

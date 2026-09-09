import type { Category, GithubIssueEvent, StatusLabelConfig } from "./types.js";

function matchesLabel(label: string, configured: string[]): boolean {
  const normalized = label.trim().toLowerCase();
  return configured.some((candidate) => candidate.trim().toLowerCase() === normalized);
}

/**
 * Maps a GitHub issue webhook event to the message posted back into the report's Discord
 * thread, or null when the event isn't one we surface (e.g. an unrelated label). Pure
 * function so the mapping rules can be tested without a live webhook or Discord client.
 */
export function messageForGithubEvent(
  event: GithubIssueEvent,
  category: Category,
  labelConfig: StatusLabelConfig,
): string | null {
  switch (event.type) {
    case "closed":
      if (event.reason === "not_planned") {
        return "This won't be addressed right now.";
      }
      return category === "feature" ? "🎉 Implemented!" : "🎉 Fixed!";

    case "reopened":
      return "Reopened — back under consideration.";

    case "labeled":
      if (matchesLabel(event.label, labelConfig.backlogLabels)) {
        return "📋 Added to the backlog for a future release.";
      }
      if (matchesLabel(event.label, labelConfig.inProgressLabels)) {
        return "🔧 Work has started on this.";
      }
      return null;

    case "unlabeled":
      return null;
  }
}

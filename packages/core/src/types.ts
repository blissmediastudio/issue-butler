export type Category = "bug" | "feature" | "help-desk" | "general";

export type ReportStatus =
  | "open"
  | "elaborating"
  | "ready"
  | "approved"
  | "rejected";

export interface ClassificationResult {
  category: Category;
  confidence: number;
  matchedKeywords: string[];
}

export interface ConversationTurn {
  role: "bot" | "reporter";
  content: string;
}

export interface ConversationState {
  round: number;
  maxRounds: number;
  askedQuestions: string[];
  complete: boolean;
  completionReason: "not-complete" | "reporter-done" | "max-rounds" | "sufficient-detail";
}

export interface IssueDraft {
  title: string;
  body: string;
  category: Category;
  labels: string[];
}

/** GitHub's own reason for closing an issue (present on the `issues` webhook payload). */
export type GithubCloseReason = "completed" | "not_planned";

export type GithubIssueEvent =
  | { type: "closed"; reason: GithubCloseReason | null }
  | { type: "reopened" }
  | { type: "labeled"; label: string }
  | { type: "unlabeled"; label: string };

/**
 * Which label names count as "backlog" / "in progress" for this guild's repo. Label
 * taxonomies vary a lot between repos, so these are configurable per guild rather than
 * fixed — matching is case-insensitive.
 */
export interface StatusLabelConfig {
  backlogLabels: string[];
  inProgressLabels: string[];
}

export const DEFAULT_STATUS_LABELS: StatusLabelConfig = {
  backlogLabels: ["backlog", "planned", "future-enhancement"],
  inProgressLabels: ["in-progress", "in progress", "wip"],
};

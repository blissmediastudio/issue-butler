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

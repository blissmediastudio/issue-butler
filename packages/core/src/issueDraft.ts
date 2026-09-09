import type { Category, ConversationTurn, IssueDraft } from "./types.js";

const CATEGORY_LABELS: Record<Category, string[]> = {
  bug: ["bug"],
  feature: ["enhancement"],
  "help-desk": ["question"],
  general: [],
};

const MAX_TITLE_LENGTH = 80;

export function draftTitle(rawText: string): string {
  const firstLine = rawText.trim().split(/\r?\n/)[0] ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_TITLE_LENGTH) return collapsed || "Untitled report";
  return `${collapsed.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}

interface DraftIssueParams {
  rawText: string;
  category: Category;
  authorTag: string;
  sourceUrl: string;
  transcript: ConversationTurn[];
  extraLabels?: string[];
}

/**
 * Builds the GitHub issue body from the original report plus any
 * clarifying Q&A, always including a provenance footer so the report is
 * traceable back to the Discord message it came from.
 */
export function buildIssueDraft(params: DraftIssueParams): IssueDraft {
  const { rawText, category, authorTag, sourceUrl, transcript, extraLabels = [] } = params;

  const sections = [rawText.trim()];

  const qaTurns = transcript.filter((turn) => turn.role === "bot" || turn.role === "reporter");
  if (qaTurns.length > 0) {
    const qaLines: string[] = ["", "### Clarifying details"];
    for (let i = 0; i < qaTurns.length; i += 2) {
      const question = qaTurns[i];
      const answer = qaTurns[i + 1];
      if (!question || question.role !== "bot") continue;
      qaLines.push(`- **Q:** ${question.content}`);
      if (answer && answer.role === "reporter") {
        qaLines.push(`  **A:** ${answer.content}`);
      }
    }
    if (qaLines.length > 2) sections.push(qaLines.join("\n"));
  }

  sections.push("", "---", `Reported by ${authorTag} via Discord: ${sourceUrl}`);

  return {
    title: draftTitle(rawText),
    body: sections.join("\n"),
    category,
    labels: [...CATEGORY_LABELS[category], "from-discord", ...extraLabels],
  };
}

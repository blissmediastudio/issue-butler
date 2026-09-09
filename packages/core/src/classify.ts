import type { Category, ClassificationResult } from "./types.js";

interface KeywordRule {
  category: Category;
  weight: number;
  keywords: string[];
}

// Ordered by specificity: bug/help-desk phrasing is more distinctive than
// generic feature language, so bug and help-desk keywords carry more weight
// per match to avoid "can't" / "doesn't" style bug reports reading as generic.
const RULES: KeywordRule[] = [
  {
    category: "bug",
    weight: 2,
    keywords: [
      "bug",
      "broken",
      "crash",
      "crashes",
      "crashed",
      "error",
      "exception",
      "doesn't work",
      "does not work",
      "not working",
      "stopped working",
      "regression",
      "traceback",
      "stack trace",
      "reproduce",
      "steps to reproduce",
      "expected",
      "actual",
      "unexpected",
      "fails",
      "failing",
      "failed",
      "freeze",
      "freezes",
      "frozen",
      "glitch",
    ],
  },
  {
    category: "help-desk",
    weight: 2,
    keywords: [
      "how do i",
      "how can i",
      "how to",
      "where is",
      "where can i",
      "is there a way",
      "having trouble",
      "can't figure out",
      "cant figure out",
      "confused",
      "question",
      "help me",
      "need help",
      "help please",
      "what does",
      "why does",
      "why is",
    ],
  },
  {
    category: "feature",
    weight: 1,
    keywords: [
      "feature request",
      "would be nice",
      "would love",
      "it would be great",
      "please add",
      "can you add",
      "suggestion",
      "suggest",
      "enhancement",
      "improve",
      "improvement",
      "wish",
      "request",
      "consider adding",
      "what if",
      "idea:",
    ],
  },
];

const MIN_CONFIDENCE_TO_CLASSIFY = 0.15;

/**
 * Rule-based classifier: no API key required. Scores each category by
 * summing keyword-match weight, then normalizes against total possible
 * signal in the message so confidence stays comparable across message
 * lengths. Falls back to "general" when no rule clears the floor.
 */
export function classifyByKeywords(rawText: string): ClassificationResult {
  const text = rawText.toLowerCase();

  const scores = new Map<Category, { score: number; matched: string[] }>();

  for (const rule of RULES) {
    const matched = rule.keywords.filter((keyword) => text.includes(keyword));
    if (matched.length === 0) continue;

    const existing = scores.get(rule.category) ?? { score: 0, matched: [] };
    existing.score += matched.length * rule.weight;
    existing.matched.push(...matched);
    scores.set(rule.category, existing);
  }

  if (scores.size === 0) {
    return { category: "general", confidence: 0, matchedKeywords: [] };
  }

  let best: { category: Category; score: number; matched: string[] } | null = null;
  let totalScore = 0;
  for (const [category, { score, matched }] of scores) {
    totalScore += score;
    if (!best || score > best.score) {
      best = { category, score, matched };
    }
  }

  const confidence = totalScore === 0 ? 0 : best!.score / (totalScore + best!.score);

  if (confidence < MIN_CONFIDENCE_TO_CLASSIFY) {
    return { category: "general", confidence, matchedKeywords: best!.matched };
  }

  return {
    category: best!.category,
    confidence: Math.min(1, confidence),
    matchedKeywords: [...new Set(best!.matched)],
  };
}

const CATEGORY_EMOJI: Record<Category, string> = {
  bug: "🐛",
  feature: "💡",
  "help-desk": "🎫",
  general: "💬",
};

export function emojiForCategory(category: Category): string {
  return CATEGORY_EMOJI[category];
}

/**
 * Reports under this length rarely contain enough detail to file a useful
 * issue straight away (e.g. "the export button is broken") and benefit from
 * at least one clarifying round, regardless of classification confidence.
 */
const SHORT_REPORT_THRESHOLD = 40;

export function needsElaboration(rawText: string, classification: ClassificationResult): boolean {
  if (classification.category === "general") return false;
  const trimmed = rawText.trim();
  if (trimmed.length < SHORT_REPORT_THRESHOLD) return true;
  if (classification.category === "bug" && !/expected|actual|steps|reproduce/i.test(trimmed)) {
    return true;
  }
  return classification.confidence < 0.4;
}

import type { Category, ConversationState } from "./types.js";

const DONE_PHRASES = ["done", "that's all", "thats all", "nothing else", "no more", "that's it", "thats it"];

export function reporterSignalsDone(message: string): boolean {
  const normalized = message.trim().toLowerCase().replace(/[.!]+$/, "");
  return DONE_PHRASES.includes(normalized);
}

export function createConversationState(maxRounds: number): ConversationState {
  return {
    round: 0,
    maxRounds,
    askedQuestions: [],
    complete: false,
    completionReason: "not-complete",
  };
}

/**
 * Advances the elaboration state machine by one reporter reply. This is the
 * single source of truth for when a feedback thread stops asking questions,
 * shared by both the AI and fallback question paths so behavior is
 * consistent regardless of which one is generating the question text.
 */
export function advanceConversation(
  state: ConversationState,
  reporterReply: string,
  nextQuestion: string | null,
): ConversationState {
  if (state.complete) return state;

  if (reporterSignalsDone(reporterReply)) {
    return { ...state, complete: true, completionReason: "reporter-done" };
  }

  const round = state.round + 1;

  if (round >= state.maxRounds || nextQuestion === null) {
    return {
      ...state,
      round,
      complete: true,
      completionReason: nextQuestion === null ? "sufficient-detail" : "max-rounds",
    };
  }

  return {
    ...state,
    round,
    askedQuestions: [...state.askedQuestions, nextQuestion],
    complete: false,
    completionReason: "not-complete",
  };
}

const FALLBACK_QUESTIONS: Record<Category, string[]> = {
  bug: [
    "What steps reproduce this, from a fresh page load?",
    "What did you expect to happen, and what happened instead?",
    "Does this happen every time, or only sometimes?",
  ],
  feature: [
    "What problem would this solve for you day-to-day?",
    "Do you have an example of another tool or site that does this well?",
  ],
  "help-desk": [
    "What have you already tried?",
    "What are you trying to accomplish overall?",
  ],
  general: [],
};

/**
 * Picks the next fallback (non-AI) clarifying question for a category,
 * skipping any already asked this conversation. Returns null when the bank
 * is exhausted, which the state machine treats as "enough detail gathered".
 */
export function nextFallbackQuestion(category: Category, askedQuestions: string[]): string | null {
  const bank = FALLBACK_QUESTIONS[category];
  const remaining = bank.filter((question) => !askedQuestions.includes(question));
  return remaining[0] ?? null;
}

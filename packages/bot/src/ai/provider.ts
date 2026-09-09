import type { Category, ClassificationResult, ConversationTurn } from "@issue-butler/core";

export interface QuestionContext {
  category: Category;
  rawText: string;
  transcript: ConversationTurn[];
  askedQuestions: string[];
}

/**
 * A triage provider decides what category a report falls into and, when
 * more detail is needed, what to ask next. The rule-based implementation
 * needs no external key; the Claude implementation is opt-in and requires
 * the deployer's own API key.
 */
export interface TriageProvider {
  readonly name: string;
  classify(rawText: string): Promise<ClassificationResult>;
  /** Returns the next clarifying question, or null when enough detail has been gathered. */
  nextQuestion(context: QuestionContext): Promise<string | null>;
}

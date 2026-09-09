import { classifyByKeywords, needsElaboration, nextFallbackQuestion } from "@issue-butler/core";
import type { TriageProvider } from "./provider.js";

/** Zero-cost, zero-dependency default: keyword classification and a fixed question bank. */
export function createRuleBasedProvider(): TriageProvider {
  return {
    name: "rule-based",

    async classify(rawText) {
      return classifyByKeywords(rawText);
    },

    async nextQuestion({ category, rawText, askedQuestions }) {
      const classification = classifyByKeywords(rawText);
      if (askedQuestions.length === 0 && !needsElaboration(rawText, classification)) {
        return null;
      }
      return nextFallbackQuestion(category, askedQuestions);
    },
  };
}

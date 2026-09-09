import { describe, expect, it } from "vitest";
import { createRuleBasedProvider } from "../src/ai/ruleBasedProvider.js";

describe("rule-based triage provider", () => {
  it("classifies using the shared keyword classifier", async () => {
    const provider = createRuleBasedProvider();
    const result = await provider.classify("Feature request: please add dark mode");
    expect(result.category).toBe("feature");
  });

  it("asks a clarifying question for a short, vague report", async () => {
    const provider = createRuleBasedProvider();
    const question = await provider.nextQuestion({
      category: "bug",
      rawText: "app crashes",
      transcript: [],
      askedQuestions: [],
    });
    expect(typeof question).toBe("string");
  });

  it("does not ask a question for a detailed report", async () => {
    const provider = createRuleBasedProvider();
    const rawText =
      "Steps to reproduce: open settings, click save twice. Expected the form to submit once. Actual: it submits twice and errors.";
    const question = await provider.nextQuestion({
      category: "bug",
      rawText,
      transcript: [],
      askedQuestions: [],
    });
    expect(question).toBeNull();
  });

  it("exhausts the fallback question bank and then returns null", async () => {
    const provider = createRuleBasedProvider();
    const askedQuestions: string[] = [];
    let question = await provider.nextQuestion({ category: "bug", rawText: "x", transcript: [], askedQuestions });
    while (question) {
      askedQuestions.push(question);
      question = await provider.nextQuestion({ category: "bug", rawText: "x", transcript: [], askedQuestions });
    }
    expect(question).toBeNull();
  });
});

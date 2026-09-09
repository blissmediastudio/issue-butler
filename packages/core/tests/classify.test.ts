import { describe, expect, it } from "vitest";
import { classifyByKeywords, needsElaboration, emojiForCategory } from "../src/classify.js";

describe("classifyByKeywords", () => {
  it("classifies clear bug reports", () => {
    const result = classifyByKeywords(
      "The export button crashes the app. Steps to reproduce: click export twice quickly. Expected a file, got a crash.",
    );
    expect(result.category).toBe("bug");
    expect(result.confidence).toBeGreaterThan(0.4);
    expect(result.matchedKeywords).toContain("crashes");
  });

  it("classifies feature requests", () => {
    const result = classifyByKeywords("Feature request: it would be great if we could export to CSV.");
    expect(result.category).toBe("feature");
  });

  it("classifies help-desk questions", () => {
    const result = classifyByKeywords("How do I reset my password? I can't figure out where the settings are.");
    expect(result.category).toBe("help-desk");
  });

  it("falls back to general for unclassifiable text", () => {
    const result = classifyByKeywords("Hey everyone, hope you're having a good week!");
    expect(result.category).toBe("general");
    expect(result.confidence).toBe(0);
  });

  it("prefers bug over feature when both keyword families appear, given bug's higher weight", () => {
    const result = classifyByKeywords("It would be nice if the crash on export got fixed, it's broken.");
    expect(result.category).toBe("bug");
  });

  it("is case-insensitive", () => {
    const lower = classifyByKeywords("this is broken and crashes constantly");
    const upper = classifyByKeywords("THIS IS BROKEN AND CRASHES CONSTANTLY");
    expect(upper.category).toBe(lower.category);
  });

  it("never returns confidence above 1", () => {
    const result = classifyByKeywords(
      "bug broken crash crashes crashed error exception fails failing failed freeze freezes frozen glitch",
    );
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("needsElaboration", () => {
  it("flags short reports even with a confident classification", () => {
    const classification = classifyByKeywords("app crashes");
    expect(needsElaboration("app crashes", classification)).toBe(true);
  });

  it("flags bug reports missing repro details", () => {
    const text = "The dashboard has been broken for a while now and it's really frustrating to use every day.";
    const classification = classifyByKeywords(text);
    expect(needsElaboration(text, classification)).toBe(true);
  });

  it("does not require elaboration for detailed bug reports", () => {
    const text =
      "Steps to reproduce: open settings, click save twice. Expected the form to submit once. Actual: it submits twice and errors.";
    const classification = classifyByKeywords(text);
    expect(needsElaboration(text, classification)).toBe(false);
  });

  it("never requires elaboration for general messages", () => {
    const text = "Just saying hi to the team, this thread is a bit short though honestly";
    const classification = classifyByKeywords(text);
    expect(classification.category).toBe("general");
    expect(needsElaboration(text, classification)).toBe(false);
  });
});

describe("emojiForCategory", () => {
  it("returns a distinct emoji per category", () => {
    const emojis = new Set(
      (["bug", "feature", "help-desk", "general"] as const).map((category) => emojiForCategory(category)),
    );
    expect(emojis.size).toBe(4);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createClaudeProvider } from "../src/ai/claudeProvider.js";

function mockFetchOnce(text: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    text: async () => text,
    json: async () => ({ content: [{ type: "text", text }] }),
  });
}

describe("createClaudeProvider.classify", () => {
  it("parses a valid classification response", async () => {
    const fetchImpl = mockFetchOnce('{"category": "bug", "confidence": 0.9}');
    const provider = createClaudeProvider({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await provider.classify("the app crashes on save");
    expect(result).toEqual({ category: "bug", confidence: 0.9, matchedKeywords: [] });
  });

  it("falls back to general for an unrecognized category", async () => {
    const fetchImpl = mockFetchOnce('{"category": "spam", "confidence": 0.5}');
    const provider = createClaudeProvider({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await provider.classify("whatever");
    expect(result.category).toBe("general");
  });

  it("clamps out-of-range confidence values", async () => {
    const fetchImpl = mockFetchOnce('{"category": "bug", "confidence": 5}');
    const provider = createClaudeProvider({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await provider.classify("whatever");
    expect(result.confidence).toBe(1);
  });

  it("throws when the API responds with an error status", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: async () => "unauthorized" });
    const provider = createClaudeProvider({ apiKey: "bad", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(provider.classify("whatever")).rejects.toThrow(/401/);
  });
});

describe("createClaudeProvider.nextQuestion", () => {
  it("returns the question text when the model asks one", async () => {
    const fetchImpl = mockFetchOnce('{"question": "What browser are you using?"}');
    const provider = createClaudeProvider({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    const question = await provider.nextQuestion({
      category: "bug",
      rawText: "it crashes",
      transcript: [],
      askedQuestions: [],
    });
    expect(question).toBe("What browser are you using?");
  });

  it("returns null when the model decides enough detail exists", async () => {
    const fetchImpl = mockFetchOnce('{"question": null}');
    const provider = createClaudeProvider({ apiKey: "k", model: "claude-haiku-4-5", fetchImpl: fetchImpl as unknown as typeof fetch });

    const question = await provider.nextQuestion({
      category: "bug",
      rawText: "detailed report",
      transcript: [],
      askedQuestions: [],
    });
    expect(question).toBeNull();
  });
});

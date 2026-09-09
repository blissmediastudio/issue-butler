import type { Category, ClassificationResult } from "@issue-butler/core";
import type { QuestionContext, TriageProvider } from "./provider.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const VALID_CATEGORIES: Category[] = ["bug", "feature", "help-desk", "general"];

export interface ClaudeProviderOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

async function callClaude(options: ClaudeProviderOptions, system: string, userMessage: string): Promise<string> {
  const fetchFn = options.fetchImpl ?? fetch;
  const response = await fetchFn(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic API request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const textBlock = data.content?.find((block) => block.type === "text");
  if (!textBlock?.text) throw new Error("Anthropic API response contained no text content");
  return textBlock.text;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Expected JSON object in model response, got: ${text}`);
  return JSON.parse(match[0]);
}

const CLASSIFY_SYSTEM_PROMPT = `You triage messages posted in a software project's Discord feedback channel.
Classify the message into exactly one category: "bug", "feature", "help-desk", or "general".
Respond with ONLY a JSON object: {"category": "<category>", "confidence": <0-1 number>}.`;

const QUESTION_SYSTEM_PROMPT = `You help a Discord community member write a clear, actionable GitHub issue.
Given their report (and any Q&A so far), either ask ONE short, specific clarifying question, or decide the
report already has enough detail. Respond with ONLY a JSON object:
{"question": "<question text>"} or {"question": null} when no more detail is needed. Ask at most one
question at a time, and never repeat a question already asked.`;

export function createClaudeProvider(options: ClaudeProviderOptions): TriageProvider {
  return {
    name: "claude",

    async classify(rawText): Promise<ClassificationResult> {
      const text = await callClaude(options, CLASSIFY_SYSTEM_PROMPT, rawText);
      const parsed = extractJson(text) as { category?: string; confidence?: number };
      const category = VALID_CATEGORIES.includes(parsed.category as Category)
        ? (parsed.category as Category)
        : "general";
      const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
      return { category, confidence, matchedKeywords: [] };
    },

    async nextQuestion(context: QuestionContext): Promise<string | null> {
      const transcriptText = context.transcript
        .map((turn) => `${turn.role === "bot" ? "Bot" : "Reporter"}: ${turn.content}`)
        .join("\n");
      const prompt = [
        `Category: ${context.category}`,
        `Original report: ${context.rawText}`,
        context.askedQuestions.length > 0 ? `Already asked:\n${context.askedQuestions.join("\n")}` : null,
        transcriptText ? `Conversation so far:\n${transcriptText}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const text = await callClaude(options, QUESTION_SYSTEM_PROMPT, prompt);
      const parsed = extractJson(text) as { question?: string | null };
      return parsed.question ?? null;
    },
  };
}

import type { Config } from "../config.js";
import { createClaudeProvider } from "./claudeProvider.js";
import { createRuleBasedProvider } from "./ruleBasedProvider.js";
import type { TriageProvider } from "./provider.js";

export function createTriageProvider(config: Config): TriageProvider {
  if (config.aiEnabled && config.ANTHROPIC_API_KEY) {
    return createClaudeProvider({ apiKey: config.ANTHROPIC_API_KEY, model: config.ANTHROPIC_MODEL });
  }
  return createRuleBasedProvider();
}

export type { TriageProvider, QuestionContext } from "./provider.js";

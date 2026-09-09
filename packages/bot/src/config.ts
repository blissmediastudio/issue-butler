import { z } from "zod";

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_OWNER: z.string().min(1).optional(),
  GITHUB_REPO: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
  ADMIN_TOKEN: z.string().min(16, "ADMIN_TOKEN must be at least 16 characters").optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PATH: z.string().default("./data/issue-butler.sqlite"),
  MAX_ELABORATION_ROUNDS: z.coerce.number().int().min(0).max(10).default(2),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof envSchema> & {
  /** True when both GITHUB_TOKEN and a target repo are configured. */
  githubPipelineEnabled: boolean;
  /** True when an AI provider key is present; false falls back to rule-based triage. */
  aiEnabled: boolean;
  /** True when the admin HTTP API should be exposed at all. */
  adminApiEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);

  return {
    ...parsed,
    githubPipelineEnabled: Boolean(parsed.GITHUB_TOKEN && parsed.GITHUB_OWNER && parsed.GITHUB_REPO),
    aiEnabled: Boolean(parsed.ANTHROPIC_API_KEY),
    adminApiEnabled: Boolean(parsed.ADMIN_TOKEN),
  };
}

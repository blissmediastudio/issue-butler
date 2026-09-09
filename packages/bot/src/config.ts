import { z } from "zod";

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),

  // GitHub App: one App registration serves every guild. Per-guild repo access is granted
  // through the install flow (see server/routes/githubConnect.ts) and stored in guild_config,
  // not here — these five just describe the App itself.
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  PUBLIC_BASE_URL: z.string().url().optional(),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
  ADMIN_TOKEN: z.string().min(16, "ADMIN_TOKEN must be at least 16 characters").optional(),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_PATH: z.string().default("./data/issue-butler.sqlite"),
  MAX_ELABORATION_ROUNDS: z.coerce.number().int().min(0).max(10).default(2),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof envSchema> & {
  /** True when the deployment can run the GitHub App integration at all (install flow + webhooks). */
  githubAppEnabled: boolean;
  /** True when an AI provider key is present; false falls back to rule-based triage. */
  aiEnabled: boolean;
  /** True when the admin HTTP API should be exposed at all. */
  adminApiEnabled: boolean;
};

/**
 * GitHub App private keys are PEM blocks with real newlines, which most .env / host secret
 * stores can't hold literally — they're usually pasted with "\n" escape sequences instead.
 * Unescape those back into real newlines so the key parses.
 */
function normalizePrivateKey(key: string | undefined): string | undefined {
  return key?.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  const privateKey = normalizePrivateKey(parsed.GITHUB_APP_PRIVATE_KEY);

  const githubAppEnabled = Boolean(
    parsed.GITHUB_APP_ID &&
      parsed.GITHUB_APP_SLUG &&
      privateKey &&
      parsed.GITHUB_WEBHOOK_SECRET &&
      parsed.SESSION_SECRET &&
      parsed.PUBLIC_BASE_URL,
  );

  return {
    ...parsed,
    GITHUB_APP_PRIVATE_KEY: privateKey,
    githubAppEnabled,
    aiEnabled: Boolean(parsed.ANTHROPIC_API_KEY),
    adminApiEnabled: Boolean(parsed.ADMIN_TOKEN),
  };
}

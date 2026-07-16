import "server-only";
import { z } from "zod";

/**
 * Fail at boot with a readable message rather than at the first query with an
 * opaque driver error. Only ever imported from server code.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  BETTER_AUTH_URL: z.url(),
  DEEPSEEK_API_KEY: z.string().default(""),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

function loadEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();

/** GitHub OAuth is only wired up when both halves of the credential exist. */
export const isGithubOAuthEnabled = Boolean(
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET,
);

/** Generation and short-answer grading are disabled without a key. */
export const isDeepSeekEnabled = Boolean(env.DEEPSEEK_API_KEY);

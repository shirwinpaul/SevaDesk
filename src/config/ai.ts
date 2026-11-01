// ALL AI model IDs and provider settings live in this one file.
// Model IDs checked against the official docs on 2026-10-30:
//   Gemini: https://ai.google.dev/gemini-api/docs/models  (free tier: /pricing)
//   Groq:   https://console.groq.com/docs/models
// Note: free tiers may use submitted (masked) text to improve the provider's models.

export const AI_CONFIG = {
  primary: {
    provider: "gemini" as const,
    model: "gemini-3.8-flash",
    /** Keep "thinking" tokens to a minimum — we only need short structured JSON. */
    thinkingLevel: "MINIMAL" as const,
  },
  fallback: {
    provider: "groq" as const,
    model: "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  },
  /** Cap output tokens: drafts are short. */
  maxOutputTokens: 1200,
  temperature: 0.4,
  /** Abort a provider call after this many ms and fall back. */
  timeoutMs: 25_000,
  /** On Gemini 429, wait at most this long (respecting retry-after) before one retry. */
  maxRetryAfterMs: 10_000,
  /** Per-IP limit on AI routes (best-effort: in-memory on serverless). */
  rateLimit: { max: 60, windowMs: 60 * 60 * 1000 },
  /** Hard cap on request body size accepted by AI routes (bytes). */
  maxBodyBytes: 32_000,
} as const;

/** Vercel Hobby allows up to 60s for functions; we stay below that. */
export const AI_ROUTE_MAX_DURATION = 60;

export type ProviderName = "gemini" | "groq" | "mock";

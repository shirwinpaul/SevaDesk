// Server-side request handling for /api/ai, kept separate from the route file so it
// can be unit-tested. Order of checks: rate limit → size → JSON/Zod → PII guard → AI.
// Request bodies are NEVER logged.

import { AI_CONFIG } from "@/config/ai";
import { payloadIsSafe } from "@/lib/mask/guard";
import { mockProvider } from "./mock";
import { geminiProvider, groqProvider, type Provider } from "./providers";
import { RateLimiter } from "./ratelimit";
import { runAiTask, type RunDeps } from "./run";
import { AiRequestSchema, type AiResponse } from "./schemas";

export interface AiEnv {
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  MOCK_AI?: string;
  NODE_ENV?: string;
}

const limiter = new RateLimiter(AI_CONFIG.rateLimit.max, AI_CONFIG.rateLimit.windowMs);

const json = (body: AiResponse, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra } });

/** MOCK_AI only works outside production builds. */
export const mockEnabled = (env: AiEnv) => env.MOCK_AI === "true" && env.NODE_ENV !== "production";

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function handleAiRequest(
  req: Request,
  env: AiEnv,
  opts: { limiter?: RateLimiter; providers?: Pick<RunDeps, "gemini" | "groq">; log?: RunDeps["log"] } = {},
): Promise<Response> {
  const wait = (opts.limiter ?? limiter).check(clientIp(req));
  if (wait) return json({ ok: false, error: "rateLimit", retryAfterSec: wait }, 429, { "retry-after": String(wait) });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > AI_CONFIG.maxBodyBytes) return json({ ok: false, error: "invalid" }, 413);
  const text = await req.text();
  if (text.length > AI_CONFIG.maxBodyBytes) return json({ ok: false, error: "invalid" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "invalid" }, 400);
  }
  const parsed = AiRequestSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid" }, 400);

  // Defence in depth: refuse anything that still looks like a phone, ID or email.
  if (!payloadIsSafe(parsed.data.input).safe) return json({ ok: false, error: "rejected" }, 422);

  // BYOK: the user's own Gemini key, sent per request, never stored or logged.
  const byok = req.headers.get("x-gemini-key")?.trim();
  const geminiKey = byok && /^[\w-]{20,200}$/.test(byok) ? byok : env.GEMINI_API_KEY;

  const providers: { gemini: Provider | null; groq: Provider | null } = opts.providers
    ? { gemini: opts.providers.gemini, groq: opts.providers.groq }
    : mockEnabled(env)
      ? { gemini: mockProvider, groq: null }
      : { gemini: geminiProvider(geminiKey), groq: groqProvider(env.GROQ_API_KEY) };

  const log =
    opts.log ??
    ((e: { provider: string; status: number; errorType: string; retryAfterMs?: number }) =>
      console.warn(`[ai] provider=${e.provider} status=${e.status} error=${e.errorType}${e.retryAfterMs !== undefined ? ` retryAfterMs=${e.retryAfterMs}` : ""}`));

  const result = await runAiTask(parsed.data.task, parsed.data.input, { ...providers, log });
  if (result.ok) return json(result);
  const status = result.error === "rateLimit" ? 429 : result.error === "invalid" ? 400 : 503;
  return json(result, status, result.retryAfterSec ? { "retry-after": String(result.retryAfterSec) } : {});
}

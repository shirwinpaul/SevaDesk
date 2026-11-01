// AI orchestration: Gemini first, Groq fallback, strict Zod-validated JSON.
//  - Gemini 429 (per-minute): respect retry-after if ≤ ~10s, wait, retry ONCE; then Groq.
//  - Gemini daily quota, 5xx, timeout (> 25s), network error → Groq.
//  - Invalid JSON / schema → retry once with the validation error appended → then Groq.
//  - Groq per-minute limit → tell the client to count down (text is preserved client-side).
//  - Anything else → "unavailable" (templates still work).
// Logs contain ONLY: provider, HTTP status, error type, retry-after.

import { AI_CONFIG } from "@/config/ai";
import { buildPrompt } from "./prompts";
import { AiInputSchemas, AiOutputSchemas, type AiOutput, type AiResponse, type AiTask } from "./schemas";
import { ProviderError, type Provider } from "./providers";

export interface RunDeps {
  gemini: Provider | null;
  groq: Provider | null;
  sleep?: (ms: number) => Promise<void>;
  log?: (entry: { provider: string; status: number; errorType: string; retryAfterMs?: number }) => void;
  timeoutMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function callWithTimeout(p: Provider, call: { system: string; user: string }, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await Promise.race([
      p(call, ctrl.signal),
      new Promise<never>((_, reject) => ctrl.signal.addEventListener("abort", () => reject(new ProviderError("timeout", 0)))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function parseOutput<T extends AiTask>(task: T, raw: string): { ok: true; data: unknown } | { ok: false; error: string } {
  let json: unknown;
  try {
    // Some models wrap JSON in ```json fences — strip them.
    json = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    return { ok: false, error: "not valid JSON" };
  }
  const parsed = AiOutputSchemas[task].safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, data: parsed.data };
}

type Attempt = { ok: true; data: unknown } | { ok: false; err: ProviderError | null };

/** One provider: a call, plus at most one JSON-repair retry. */
async function tryProvider<T extends AiTask>(name: string, p: Provider, task: T, input: unknown, deps: Required<Pick<RunDeps, "log" | "timeoutMs">>): Promise<Attempt> {
  let validationError: string | undefined;
  for (let i = 0; i < 2; i++) {
    try {
      const raw = await callWithTimeout(p, buildPrompt(task, input, validationError), deps.timeoutMs);
      const out = parseOutput(task, raw);
      if (out.ok) return out;
      validationError = out.error;
      deps.log({ provider: name, status: 200, errorType: "invalidJson" });
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError("network", 0);
      deps.log({ provider: name, status: err.status, errorType: err.kind, retryAfterMs: err.retryAfterMs });
      return { ok: false, err };
    }
  }
  return { ok: false, err: null };
}

export async function runAiTask<T extends AiTask>(task: T, input: unknown, deps: RunDeps): Promise<AiResponse<T>> {
  const parsedInput = AiInputSchemas[task].safeParse(input);
  if (!parsedInput.success) return { ok: false, error: "invalid" };
  const sleep = deps.sleep ?? defaultSleep;
  const d = { log: deps.log ?? (() => {}), timeoutMs: deps.timeoutMs ?? AI_CONFIG.timeoutMs };

  if (deps.gemini) {
    let r = await tryProvider("gemini", deps.gemini, task, parsedInput.data, d);
    if (!r.ok && r.err?.kind === "rateLimit") {
      const wait = r.err.retryAfterMs ?? 0;
      if (wait <= AI_CONFIG.maxRetryAfterMs) {
        await sleep(wait);
        r = await tryProvider("gemini", deps.gemini, task, parsedInput.data, d);
      }
    }
    if (r.ok) return { ok: true, data: r.data as AiOutput<T>, provider: "gemini" };
  }

  if (deps.groq) {
    const r = await tryProvider("groq", deps.groq, task, parsedInput.data, d);
    if (r.ok) return { ok: true, data: r.data as AiOutput<T>, provider: "groq" };
    if (r.err?.kind === "rateLimit") {
      return { ok: false, error: "rateLimit", retryAfterSec: Math.max(1, Math.ceil((r.err.retryAfterMs ?? 30_000) / 1000)) };
    }
  }
  return { ok: false, error: "unavailable" };
}

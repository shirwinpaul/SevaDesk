// Server-only provider adapters. They return raw model text or throw ProviderError.
// Nothing here logs prompts, inputs or outputs.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AI_CONFIG } from "@/config/ai";

export type ProviderErrorKind = "rateLimit" | "quota" | "server" | "timeout" | "network" | "auth" | "badRequest";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(kind);
    this.name = "ProviderError";
  }
}

export interface ProviderCall {
  system: string;
  user: string;
}

export type Provider = (call: ProviderCall, signal: AbortSignal) => Promise<string>;

/** Parse Retry-After header (seconds or HTTP date) or Gemini's "retryDelay": "7s". */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const delay = /retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/.exec(value);
  if (delay) return Math.round(Number(delay[1]) * 1000);
  if (/^\d+(\.\d+)?$/.test(value.trim())) return Math.round(Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function classify(status: number, message: string, retryAfterMs?: number): ProviderError {
  if (status === 429) {
    // Daily quota exhausted → no point retrying soon.
    const daily = /per\s*day|PerDay|daily/i.test(message);
    return new ProviderError(daily ? "quota" : "rateLimit", status, retryAfterMs);
  }
  if (status === 401 || status === 403) return new ProviderError("auth", status);
  if (status >= 500) return new ProviderError("server", status);
  return new ProviderError("badRequest", status);
}

const isPlaceholder = (key: string | undefined) => !key || key.startsWith("PASTE_");

export function geminiProvider(apiKey: string | undefined): Provider | null {
  if (isPlaceholder(apiKey)) return null;
  const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  return async ({ system, user }, signal) => {
    try {
      const res = await ai.models.generateContent({
        model: AI_CONFIG.primary.model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          maxOutputTokens: AI_CONFIG.maxOutputTokens,
          temperature: AI_CONFIG.temperature,
          thinkingConfig: { thinkingLevel: ThinkingLevel[AI_CONFIG.primary.thinkingLevel] },
          abortSignal: signal,
        },
      });
      return res.text ?? "";
    } catch (e) {
      if (signal.aborted) throw new ProviderError("timeout", 0);
      const status = typeof (e as { status?: unknown }).status === "number" ? (e as { status: number }).status : 0;
      const message = e instanceof Error ? e.message : "";
      if (!status) throw new ProviderError("network", 0);
      throw classify(status, message, parseRetryAfter(message));
    }
  };
}

export function groqProvider(apiKey: string | undefined, fetchImpl: typeof fetch = fetch): Provider | null {
  if (isPlaceholder(apiKey)) return null;
  return async ({ system, user }, signal) => {
    let res: Response;
    try {
      res = await fetchImpl(AI_CONFIG.fallback.endpoint, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: AI_CONFIG.fallback.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: AI_CONFIG.temperature,
          max_completion_tokens: AI_CONFIG.maxOutputTokens,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      throw new ProviderError(signal.aborted ? "timeout" : "network", 0);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw classify(res.status, text, parseRetryAfter(res.headers.get("retry-after")));
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? "";
  };
}

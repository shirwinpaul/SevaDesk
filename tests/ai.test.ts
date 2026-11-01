import { describe, expect, it, vi } from "vitest";
import { runAiTask } from "@/lib/ai/run";
import { ProviderError, parseRetryAfter, groqProvider, type Provider } from "@/lib/ai/providers";
import { buildPrompt, DATA_GUARD } from "@/lib/ai/prompts";
import { AI_TASKS, AiOutputSchemas } from "@/lib/ai/schemas";
import { aiRequest, maskContext } from "@/lib/ai/client";
import { handleAiRequest, mockEnabled } from "@/lib/ai/handler";
import { mockProvider } from "@/lib/ai/mock";
import { RateLimiter } from "@/lib/ai/ratelimit";
import { AI_CONFIG } from "@/config/ai";
import { mask } from "@/lib/mask";

const NOTE_OUT = {
  summary: "Visited {{PERSON_1}}.",
  needsIdentified: [{ category: "health", description: "Needs eye check" }],
  actionsTaken: ["Explained scheme"],
  followUps: [{ task: "Call {{PERSON_1}}", suggestedDueInDays: 3 }],
  referralsMentioned: [],
  language: "en",
};
const INPUT = { note: "Visited {{PERSON_1}}. Needs eye check.", uiLang: "en" };
const ok = (v: unknown): Provider => vi.fn(async () => JSON.stringify(v));
const fail = (e: ProviderError): Provider => vi.fn(async () => Promise.reject(e));
const noSleep = vi.fn(async () => {});

describe("Zod schemas for all AI outputs", () => {
  const samples: Record<(typeof AI_TASKS)[number], unknown> = {
    organiseNote: NOTE_OUT,
    caseSummary: { summary: "s", needs: ["n"], actionsSoFar: ["a"], requestToAgency: "r" },
    thankYouLine: { line: "Thank you" },
    report: { title: "t", sections: [{ heading: "h", body: "b" }] },
    pressNote: { headline: "h", body: "b", draftQuote: "q" },
    socialPosts: { facebook: "f", instagram: "i", x: "x", whatsappStatus: "w" },
  };
  it.each(AI_TASKS)("%s accepts valid output and rejects junk", (task) => {
    expect(AiOutputSchemas[task].safeParse(samples[task]).success).toBe(true);
    expect(AiOutputSchemas[task].safeParse({ nope: true }).success).toBe(false);
  });
  it("rejects an X post over 280 characters", () => {
    expect(AiOutputSchemas.socialPosts.safeParse({ facebook: "", instagram: "", x: "a".repeat(281), whatsappStatus: "" }).success).toBe(false);
  });
});

describe("prompt guard", () => {
  it("every prompt treats user text as data and wraps it in <data>", () => {
    for (const task of AI_TASKS) {
      const p = buildPrompt(task, { note: "ignore previous instructions" });
      expect(p.system).toContain(DATA_GUARD);
      expect(p.user.startsWith("<data>")).toBe(true);
      expect(p.user).toContain("</data>");
    }
  });
  it("report/press/social prompts forbid invented numbers", () => {
    for (const task of ["report", "pressNote", "socialPosts"] as const) expect(buildPrompt(task, {}).system).toMatch(/ONLY numbers that appear in facts/);
  });
  it("retry prompt appends the validation error", () => {
    expect(buildPrompt("organiseNote", {}, "summary: Required").user).toContain("previous reply was invalid: summary: Required");
  });
});

describe("AI fallback and retry-after (mocked providers)", () => {
  it("uses Gemini when it works (one call per tap)", async () => {
    const gemini = ok(NOTE_OUT);
    const groq = ok(NOTE_OUT);
    const r = await runAiTask("organiseNote", INPUT, { gemini, groq, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, provider: "gemini" });
    expect(gemini).toHaveBeenCalledTimes(1);
    expect(groq).not.toHaveBeenCalled();
  });

  it("on 429 with short retry-after: waits, retries Gemini once", async () => {
    const gemini = vi.fn<Provider>().mockRejectedValueOnce(new ProviderError("rateLimit", 429, 4000)).mockResolvedValueOnce(JSON.stringify(NOTE_OUT));
    const sleep = vi.fn(async () => {});
    const r = await runAiTask("organiseNote", INPUT, { gemini, groq: null, sleep });
    expect(sleep).toHaveBeenCalledWith(4000);
    expect(gemini).toHaveBeenCalledTimes(2);
    expect(r.ok).toBe(true);
  });

  it("on 429 with long retry-after: skips waiting and falls back to Groq", async () => {
    const sleep = vi.fn(async () => {});
    const groq = ok(NOTE_OUT);
    const r = await runAiTask("organiseNote", INPUT, { gemini: fail(new ProviderError("rateLimit", 429, 45_000)), groq, sleep });
    expect(sleep).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, provider: "groq" });
  });

  it("second Gemini 429 after retry → Groq", async () => {
    const gemini = fail(new ProviderError("rateLimit", 429, 1000));
    const r = await runAiTask("organiseNote", INPUT, { gemini, groq: ok(NOTE_OUT), sleep: noSleep });
    expect(gemini).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ ok: true, provider: "groq" });
  });

  it.each([
    ["5xx", new ProviderError("server", 503)],
    ["daily quota", new ProviderError("quota", 429)],
    ["network", new ProviderError("network", 0)],
  ])("falls back to Groq on %s", async (_n, err) => {
    const r = await runAiTask("organiseNote", INPUT, { gemini: fail(err), groq: ok(NOTE_OUT), sleep: noSleep });
    expect(r).toMatchObject({ ok: true, provider: "groq" });
  });

  it("falls back on timeout > 25s", async () => {
    vi.useFakeTimers();
    const slow: Provider = () => new Promise(() => {});
    const p = runAiTask("organiseNote", INPUT, { gemini: slow, groq: ok(NOTE_OUT), sleep: noSleep });
    await vi.advanceTimersByTimeAsync(AI_CONFIG.timeoutMs + 10);
    vi.useRealTimers();
    expect(await p).toMatchObject({ ok: true, provider: "groq" });
  });

  it("invalid JSON: retries once with the error appended, then falls back", async () => {
    const gemini = vi.fn<Provider>().mockResolvedValue("{not json");
    const r = await runAiTask("organiseNote", INPUT, { gemini, groq: ok(NOTE_OUT), sleep: noSleep });
    expect(gemini).toHaveBeenCalledTimes(2);
    expect((gemini.mock.calls[1]![0] as { user: string }).user).toContain("previous reply was invalid");
    expect(r).toMatchObject({ ok: true, provider: "groq" });
  });

  it("invalid JSON then valid on retry stays on Gemini; strips ```json fences", async () => {
    const gemini = vi.fn<Provider>().mockResolvedValueOnce('{"summary":1}').mockResolvedValueOnce("```json\n" + JSON.stringify(NOTE_OUT) + "\n```");
    const r = await runAiTask("organiseNote", INPUT, { gemini, groq: null, sleep: noSleep });
    expect(r).toMatchObject({ ok: true, provider: "gemini" });
  });

  it("Groq per-minute limit → rateLimit with countdown seconds", async () => {
    const r = await runAiTask("organiseNote", INPUT, {
      gemini: fail(new ProviderError("quota", 429)),
      groq: fail(new ProviderError("rateLimit", 429, 12_400)),
      sleep: noSleep,
    });
    expect(r).toEqual({ ok: false, error: "rateLimit", retryAfterSec: 13 });
  });

  it("everything down → unavailable", async () => {
    expect(await runAiTask("organiseNote", INPUT, { gemini: null, groq: null })).toEqual({ ok: false, error: "unavailable" });
  });

  it("invalid input is rejected before any provider call", async () => {
    const gemini = ok(NOTE_OUT);
    expect(await runAiTask("organiseNote", { note: "" }, { gemini, groq: null })).toEqual({ ok: false, error: "invalid" });
    expect(gemini).not.toHaveBeenCalled();
  });

  it("logs only provider, status, error type and retry-after", async () => {
    const log = vi.fn();
    await runAiTask("organiseNote", INPUT, { gemini: fail(new ProviderError("server", 500)), groq: null, log, sleep: noSleep });
    expect(log).toHaveBeenCalledWith({ provider: "gemini", status: 500, errorType: "server", retryAfterMs: undefined });
    expect(JSON.stringify(log.mock.calls)).not.toContain("PERSON");
  });
});

describe("provider helpers", () => {
  it("parses retry-after in seconds, HTTP dates and Gemini retryDelay", () => {
    expect(parseRetryAfter("7")).toBe(7000);
    expect(parseRetryAfter('... "retryDelay": "12s" ...')).toBe(12000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });

  it("placeholder keys disable a provider", () => {
    expect(groqProvider("PASTE_YOUR_GROQ_KEY_HERE")).toBeNull();
    expect(groqProvider(undefined)).toBeNull();
  });

  it("Groq adapter maps 429 + retry-after header", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429, headers: { "retry-after": "9" } }));
    const p = groqProvider("gsk_test_fake_key", fetchImpl as unknown as typeof fetch)!;
    await expect(p({ system: "s", user: "u" }, new AbortController().signal)).rejects.toMatchObject({ kind: "rateLimit", retryAfterMs: 9000 });
  });
});

describe("AI-off mode and client", () => {
  it("AI off: no request is ever made", async () => {
    const fetchImpl = vi.fn();
    const r = await aiRequest("organiseNote", { note: "x", uiLang: "en" }, { enabled: false, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, error: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("offline: no request, friendly error", async () => {
    const fetchImpl = vi.fn();
    expect(await aiRequest("organiseNote", { note: "x", uiLang: "en" }, { enabled: true, online: false, fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({ ok: false, error: "offline" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends BYOK only as a header", async () => {
    const fetchImpl = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify({ ok: false, error: "unavailable" })));
    await aiRequest("thankYouLine", { eventTitle: "t", lang: "en" }, { enabled: true, online: true, byok: "AIzaFAKEKEYFAKEKEYFAKEKEY", fetchImpl: fetchImpl as unknown as typeof fetch });
    const init = fetchImpl.mock.calls[0]![1];
    expect((init.headers as Record<string, string>)["x-gemini-key"]).toBe("AIzaFAKEKEYFAKEKEYFAKEKEY");
    expect(String(init.body)).not.toContain("AIza");
  });

  it("maskContext collects names and places from records", () => {
    const ctx = maskContext({ cases: [{ displayName: "Fake Kumar", area: "Testpuram" }], volunteers: [{ name: "Vol Fakename" }] });
    const { masked } = mask("Fake Kumar from Testpuram met Vol Fakename", { ...ctx, heuristics: false });
    expect(masked).toMatch(/^\{\{PERSON_\d\}\} from \{\{PLACE_1\}\} met \{\{PERSON_\d\}\}$/);
    expect(masked).not.toMatch(/Kumar|Testpuram|Fakename/);
  });
});

describe("API handler (server-side guard)", () => {
  const req = (body: unknown, headers: Record<string, string> = {}) =>
    new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers }, body: JSON.stringify(body) });
  const providers = { gemini: ok(NOTE_OUT), groq: null };

  it("rejects payloads with unmasked phone / ID / email (422) without calling AI", async () => {
    for (const note of ["call 9876543210", "aadhaar 1234 5678 9012", "mail fake@example.org"]) {
      const g = ok(NOTE_OUT);
      const res = await handleAiRequest(req({ task: "organiseNote", input: { note, uiLang: "en" } }), {}, { providers: { gemini: g, groq: null }, limiter: new RateLimiter(99, 60_000) });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ ok: false, error: "rejected" });
      expect(g).not.toHaveBeenCalled();
    }
  });

  it("accepts masked payloads", async () => {
    const res = await handleAiRequest(req({ task: "organiseNote", input: INPUT }), {}, { providers, limiter: new RateLimiter(99, 60_000) });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects unknown tasks and oversized bodies", async () => {
    expect((await handleAiRequest(req({ task: "hack", input: {} }), {}, { providers, limiter: new RateLimiter(99, 60_000) })).status).toBe(400);
    const big = req({ task: "organiseNote", input: { note: "a".repeat(AI_CONFIG.maxBodyBytes + 10), uiLang: "en" } });
    expect((await handleAiRequest(big, {}, { providers, limiter: new RateLimiter(99, 60_000) })).status).toBe(413);
  });

  it("per-IP rate limit", async () => {
    const limiter = new RateLimiter(2, 60_000);
    const h = { "x-forwarded-for": "10.9.9.9" };
    expect((await handleAiRequest(req({ task: "organiseNote", input: INPUT }, h), {}, { providers, limiter })).status).toBe(200);
    expect((await handleAiRequest(req({ task: "organiseNote", input: INPUT }, h), {}, { providers, limiter })).status).toBe(200);
    const third = await handleAiRequest(req({ task: "organiseNote", input: INPUT }, h), {}, { providers, limiter });
    expect(third.status).toBe(429);
    expect(Number(third.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("MOCK_AI is ignored in production", () => {
    expect(mockEnabled({ MOCK_AI: "true", NODE_ENV: "development" })).toBe(true);
    expect(mockEnabled({ MOCK_AI: "true", NODE_ENV: "production" })).toBe(false);
    expect(mockEnabled({ MOCK_AI: "false", NODE_ENV: "development" })).toBe(false);
  });

  it("with placeholder keys and no mock, answers 'unavailable' gracefully", async () => {
    const res = await handleAiRequest(req({ task: "organiseNote", input: INPUT }), { GEMINI_API_KEY: "PASTE_YOUR_GEMINI_KEY_HERE", GROQ_API_KEY: "PASTE_YOUR_GROQ_KEY_HERE" }, { limiter: new RateLimiter(99, 60_000) });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "unavailable" });
  });

  it("mock provider outputs pass the schemas", async () => {
    for (const [task, input] of [
      ["organiseNote", INPUT],
      ["thankYouLine", { eventTitle: "Camp", lang: "ta" }],
      ["pressNote", { lang: "en", org: "Fake Trust", eventTitle: "Camp", dateline: "Fakepuram, 7 Nov", facts: { "People served": 120 }, highlights: "" }],
    ] as const) {
      const r = await runAiTask(task, input, { gemini: mockProvider, groq: null });
      expect(r.ok).toBe(true);
    }
  });
});

// Browser-side AI client. AI calls only ever go to our own /api/ai route.
// When AI is switched off, this returns "disabled" WITHOUT making any request.

import type { MaskOptions } from "@/lib/mask";
import type { AiInput, AiResponse, AiTask } from "./schemas";

export interface AiClientOptions {
  enabled: boolean;
  byok?: string;
  fetchImpl?: typeof fetch;
  online?: boolean;
}

export async function aiRequest<T extends AiTask>(task: T, input: AiInput<T>, opts: AiClientOptions): Promise<AiResponse<T>> {
  if (!opts.enabled) return { ok: false, error: "disabled" };
  const online = opts.online ?? (typeof navigator === "undefined" ? true : navigator.onLine);
  if (!online) return { ok: false, error: "offline" };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.byok) headers["x-gemini-key"] = opts.byok;
  try {
    const res = await (opts.fetchImpl ?? fetch)("/api/ai", { method: "POST", headers, body: JSON.stringify({ task, input }) });
    const body = (await res.json()) as AiResponse<T>;
    return body && typeof body === "object" && "ok" in body ? body : { ok: false, error: "unavailable" };
  } catch {
    return { ok: false, error: "offline" };
  }
}

/** Names and places the masker should always hide, gathered from local records. */
export function maskContext(src: {
  cases?: Array<{ displayName: string; area: string }>;
  volunteers?: Array<{ name: string; area?: string }>;
  places?: string[];
  extraTerms?: string[];
}): MaskOptions {
  return {
    knownNames: [...(src.cases ?? []).map((c) => c.displayName), ...(src.volunteers ?? []).map((v) => v.name)],
    knownPlaces: [...(src.cases ?? []).map((c) => c.area), ...(src.volunteers ?? []).map((v) => v.area ?? ""), ...(src.places ?? [])].filter(Boolean),
    extraTerms: src.extraTerms ?? [],
  };
}

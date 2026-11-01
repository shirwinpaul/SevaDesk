// Zod schemas for every AI task: what the browser may send (already masked) and what
// the model must return. Shared by the API route and the client.

import { z } from "zod";
import { OrganisedNoteSchema } from "@/types/models";

const lang = z.enum(["en", "ta"]);
const short = (max: number) => z.string().max(max);

export const AI_TASKS = ["organiseNote", "caseSummary", "thankYouLine", "report", "pressNote", "socialPosts"] as const;
export type AiTask = (typeof AI_TASKS)[number];

/** Inputs. All free text inside has already been masked in the browser. */
export const AiInputSchemas = {
  organiseNote: z.object({ note: short(8000).min(1), uiLang: lang }),
  caseSummary: z.object({
    categories: z.array(short(40)).max(10),
    status: short(20),
    notes: z.array(short(2000)).max(10),
    referrals: z.array(short(300)).max(10),
    purpose: short(200),
    lang,
  }),
  thankYouLine: z.object({ eventTitle: short(120), lang }),
  report: z.object({
    kind: z.enum(["monthly", "quarterly", "annual", "event", "donorThanks", "grantOutline"]),
    lang: z.enum(["en", "ta", "both"]),
    tone: z.enum(["formal", "warm", "newsy"]),
    org: short(120),
    period: short(60),
    /** Code-provided facts: label → value. The AI may only use these numbers. */
    facts: z.record(short(80), z.union([z.number(), short(200)])),
    highlights: short(2000),
  }),
  pressNote: z.object({
    lang: z.enum(["en", "ta"]),
    org: short(120),
    eventTitle: short(120),
    dateline: short(80),
    facts: z.record(short(80), z.union([z.number(), short(200)])),
    highlights: short(2000),
  }),
  socialPosts: z.object({
    lang: z.enum(["en", "ta"]),
    org: short(120),
    eventTitle: short(120),
    facts: z.record(short(80), z.union([z.number(), short(200)])),
    highlights: short(1000),
  }),
} satisfies Record<AiTask, z.ZodType>;

export type AiInput<T extends AiTask> = z.infer<(typeof AiInputSchemas)[T]>;

export const CaseSummaryOutput = z.object({
  summary: short(2000),
  needs: z.array(short(300)).max(10),
  actionsSoFar: z.array(short(300)).max(10),
  requestToAgency: short(1000),
});

export const ReportOutput = z.object({
  title: short(200),
  sections: z.array(z.object({ heading: short(120), body: short(3000) })).min(1).max(12),
});

export const PressNoteOutput = z.object({
  headline: short(200),
  body: short(4000),
  /** Always shown as "Draft quote — confirm with the person before publishing". */
  draftQuote: short(400),
});

export const SocialPostsOutput = z.object({
  facebook: short(1200),
  instagram: short(1200),
  x: short(280),
  whatsappStatus: short(400),
});

export const AiOutputSchemas = {
  organiseNote: OrganisedNoteSchema,
  caseSummary: CaseSummaryOutput,
  thankYouLine: z.object({ line: short(300) }),
  report: ReportOutput,
  pressNote: PressNoteOutput,
  socialPosts: SocialPostsOutput,
} satisfies Record<AiTask, z.ZodType>;

export type AiOutput<T extends AiTask> = z.infer<(typeof AiOutputSchemas)[T]>;

export const AiRequestSchema = z.object({ task: z.enum(AI_TASKS), input: z.unknown() });

export type AiErrorCode = "rateLimit" | "unavailable" | "offline" | "disabled" | "rejected" | "invalid";

export type AiResponse<T extends AiTask = AiTask> =
  | { ok: true; data: AiOutput<T>; provider: string }
  | { ok: false; error: AiErrorCode; retryAfterSec?: number };

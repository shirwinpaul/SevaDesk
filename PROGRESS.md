# SevaDesk — Progress

Spec: `SEVADESK_PROJECT_SPEC.md` (the spec calls it `PROJECT_SPEC.md`; it is the same
single source of truth and is kept unchanged).

Checks after every phase: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Decisions
- Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 strict (TS 7 is too new
  for the Next/ESLint toolchain), Tailwind 4, ESLint 9 flat config, Vitest 5.
- AI models (checked 2026-10-30 against official docs, see `src/config/ai.ts`):
  Gemini `gemini-3.8-flash` (free tier, thinking level MINIMAL) → Groq `llama-3.3-70b-versatile`.
- UI preferences (language, theme, large text) are non-sensitive and stored in
  localStorage so the lock screen renders before decryption. Everything else is encrypted.
- Vitest runs single-worker (`maxWorkers: 1`) to stay light on memory.

## Phase log
### Phase 1 — Setup ✅
Config (tsconfig strict, next.config security headers, eslint, vitest), `.env.example` +
`.env.local` (placeholders only, git-ignored), theme tokens (teal/leaf/saffron, dark +
large text + print + reduced-motion), Inter + Noto Sans Tamil, i18n EN/TA with
compile-time key parity, layout + footer, landing page, original SVG illustrations,
`src/config/ai.ts`. Tests: i18n parity.

### Phase 2 — Security core ✅
`src/lib/secure/`: `crypto.ts` (PBKDF2-SHA256 600k iterations, random 16-byte salt,
non-extractable AES-GCM-256 key, fresh 12-byte IV per write, AAD = `collection/id` so
records can't be swapped), `store.ts` (encrypted IndexedDB via `idb`; only collection, id
and updatedAt in the clear; passphrase check value; erase = deleteDB), `backup.ts`
(encrypted `.sevadesk` file with its own salt; main or separate passphrase; decrypt
before replace), `autolock.ts` (pure timing logic: idle + hidden-tab), `session.ts`
(singleton, decrypted cache cleared on lock, Zod validation on read/write),
`strength.ts`. UI: onboarding (language, org, privacy + no-recovery acknowledgement,
passphrase with meter, AI on/off, auto-lock), lock screen, app shell (Lock now always
visible, bottom nav on mobile, side nav on desktop), settings (backup/restore, erase
with double confirmation, BYOK stored encrypted). Tests: 23 security tests.

### Phase 3 — Masking, payload guard, validator ✅
`src/lib/mask/patterns.ts` (shared regexes: email, Aadhaar-like 12-digit, PAN/voter-like,
Indian mobile + landline, long digit runs, PIN in address context, DOB after keywords,
addresses incl. Tamil street words, honorifics), `src/lib/mask/index.ts` (`mask` →
`{{KIND_n}}` tokens, same value = same token; known names/places/extra terms incl.
Tamil script; capitalised-word heuristics with common-word list and sentence-start
verb rule; `restore` incl. brace-less tokens + unknown-token report; `restoreDeep`),
`src/lib/mask/guard.ts` (server-side reject of unmasked phone/ID/email in any JSON),
`src/lib/validate/numbers.ts` (Indian formatting + Tamil digits, allowed set from code
values incl. date parts, flags unverified numbers, unknown tokens, titled names).
Decision: masking errs towards over-masking; the preview screen lets users add terms.
Tests: 35 masking/guard/validator tests (61 total).

### Phase 4 — Home + Cases & Follow-ups ✅
Models: Case (auto number `#0001` from an encrypted counter, display name/initials,
optional phone, area, categories, status, required consent yes/verbal/no with reminder,
assigned volunteer, documents checklist tick-only, referrals), Task, Volunteer.
`src/lib/tasks.ts`: Today/This week/Overdue/Later in a time zone (default Asia/Kolkata),
ICS export with masked titles ("Follow-up: Case #0123") via `ics`. Pages: `/home`
(quick actions, today + overdue, counts, backup reminder after 7 days, Field mode hides
task titles), `/cases` (search, filters by category/status/area/owner, status counts),
`/cases/[id]` (details, follow-ups, documents, referrals, delete), `/tasks` (tabs + .ics).
Placeholders filled later: `CaseNotes` (P5), `UpcomingEvents` (P6), `CaseSummary` (P8).
Tests: 7 task/ICS tests (68 total).

### Phase 5 — Field Notes ✅
Model FieldNote (case or general visit, date, time, place, text, manual template
saw/needs/actions/next steps, organised note in the AI shape, append-only `history`).
`src/lib/notes.ts` (`reviseNote` pushes the previous version on every content change,
next-steps → follow-up suggestions). `useSpeech` (Web Speech API, feature-detected,
ta-IN/en-IN, no audio recording) + `VoiceButton` (only if enabled in Settings; disclosure
modal before first use per session; typing is the default). Follow-ups become tasks only
after the user confirms each one (`FollowUpSuggestions`). `/notes` page with case filter,
notes section on case page; deleting a case removes its notes and tasks.
Placeholder `OrganiseNoteButton` filled in P8. Tests: 3 note tests (71 total).

### Phase 6 — Volunteers & Events ✅
Models: Volunteer (skills, languages, available weekdays + time slots, hours log, active),
Event (shifts with role/slot/times/required count/skills, assignments, link to camp).
`src/lib/assign`: `autoAssign` (availability + skills, no overlap incl. other events the
same day, fair load incl. prior load from other events, scarcest shifts first, keeps
manual assignments, reports unfilled), `checkManualAssignment`, `shiftHours`.
`src/lib/whatsapp.ts`: wa.me links (Indian number normalisation, UTF-8 encoding for
Tamil), call-for-volunteers / confirmation / reminder messages in EN + TA, https-only map
links. Pages: `/volunteers` (roster, hours log, call/WhatsApp), `/events`, `/events/[id]`
(shift editor, roster board with drag-and-drop + accessible "Move to" select, auto-assign,
WhatsApp tools, QR code to map, one-tap hours logging, batch certificate printing via
`printScoped()` one per page). Home shows upcoming events.
Placeholder `ThankYouAiButton` filled in P8. Tests: 14 assignment + 5 WhatsApp (90 total).

### Phase 7 — Camps & Drives Planner ✅
`src/data/camps/` — 10 templates (blood, medical/eye, ration, flood relief collection,
school kit, rally/street play, tree plantation, elder-care day, hygiene workshop, custom)
with bilingual checklists across T-30/T-14/T-7/T-1/day/after, roles, supplies and
schedule; permission items always say "check local requirements". Models: Camp
(checklist, supplies with override, budget lines, sponsors cash/in-kind, schedule,
after-event numbers + category), Resource (used by run sheets now, page in P10).
`src/lib/camps.ts` (supplies calculator rounding up with buffer, budget summary incl.
net cost after cash sponsors, stage dates, INR formatting). Pages: `/camps` (template
picker), `/camps/[id]` (tabs: checklist & timeline, supplies calculator, budget + Recharts
chart + sponsors, printable run sheet with roles/contacts/emergency numbers from the
Resource Directory, after-event form → impact reports). "Create volunteer event with
these roles" links a camp to an event. Tests: 9 camp tests (99 total).

### Phase 8 — AI layer ✅
`src/lib/ai/`: `schemas.ts` (Zod inputs + outputs for organiseNote, caseSummary,
thankYouLine, report, pressNote, socialPosts), `prompts.ts` (compact prompts; DATA guard:
user text in `<data>`, never instructions; keep tokens; facts-only numbers),
`providers.ts` (Gemini via @google/genai with JSON mode, MINIMAL thinking, capped tokens,
SDK retries disabled; Groq via fetch with json_object; placeholder keys = disabled;
retry-after parsing incl. Gemini `retryDelay`), `run.ts` (Gemini → wait ≤10s on 429 and
retry once → Groq; fallback on quota/5xx/timeout 25s/network; invalid JSON retried once
with the error appended; Groq 429 → client countdown; logs only provider/status/error
type/retry-after), `mock.ts` (MOCK_AI dev-only; press note deliberately contains an
invented "500" for the validator check), `ratelimit.ts` (60/hour/IP, best-effort),
`handler.ts` (rate limit → 32 KB cap → Zod → PII guard 422 → BYOK header → run; no-store),
`client.ts` (no request at all when AI is off or offline; BYOK only in a header).
Route `/api/ai` (`maxDuration = 60`). UI: `AiButton` (hidden entirely when AI is off;
"What the AI will see" preview before first use per module, with extra words to hide;
live countdown; friendly unavailable/offline messages), connected to Organise note,
Case summary (masked draft → "Create final copy" restores names locally) and certificate
thank-you line. Tests: 38 AI tests (137 total).

### Phase 9 — Impact dashboard, reports, press notes, social posts, cards, PDF ✅
Donation model added. `src/lib/reports/metrics.ts` (month/quarter/year periods; cases
opened/closed, follow-ups done, completed camps + people served, reach by category,
volunteer hours, donations, area breakdown; 12-month series). `src/data/reports/`
(EN + TA code templates for all 6 report kinds — work with AI off).
`src/lib/reports/generate.ts` (facts from code, template fill with ₹ Indian grouping,
`checkNumbers` against code values + the user's own text, grant budget table from camp
budgets). `/reports` tabs: Dashboard (stats, Recharts trend + category charts, area
table), Report generator (kind / language incl. bilingual / tone; template or AI wording;
⚠️ banner + highlighted unverified numbers; print → PDF with Noto Sans Tamil; plain-text
copy), Press note (EN + TA side by side, one AI call per language; user-written quotes;
AI quote boxed as "Draft quote — confirm with the person before publishing"; contact
block; WhatsApp / email), Social posts (4 platforms, X ≤ 280, consent tick), Impact card
(canvas PNG using the page's Tamil-capable fonts). Camps link to reports via `?camp=`.
Tests: 7 metrics + 6 report tests (150 total).

### Phase 10 — Media Archive, Donations Log, Resource Directory ✅
Model MediaItem (outlet, type, language, date, headline, http(s)-only link, compressed
clipping photo stored encrypted in the record, tags, related camp, featured).
`src/lib/media.ts` (RFC-4180 CSV parser incl. quotes/newlines/BOM; import with DD/MM/YYYY
dates, type aliases, per-line error report; counts by year/outlet/language/type).
`/media` (timeline, filters, counts, CSV import, printable media coverage summary).
`/donations` ("not an accounting or tax system" + "consult your accountant" notice,
cash/in-kind, anonymous donors, totals + monthly chart, EN/TA thank-you letter that is
explicitly not a tax receipt). `/resources` (categories, emergency flag → run sheets,
call/WhatsApp, empty by default with an "add your local resources" guide; example
national helplines only on request, flagged "Verify this number on the official website
before use" until the user confirms). Case referrals suggest names from the directory.
Tests: 7 media tests (157 total).

### Phase 11 — PWA, offline, Field mode, polish, README ✅
`src/app/manifest.ts` (standalone, start `/home`, 192/512 + maskable PNG icons generated
from original artwork, SVG icon). `public/sw.js` (network-first pages with cached
fallback, cache-first hashed assets, never touches `/api/*`, caches code only — user data
stays encrypted in IndexedDB). SW registered in production only. Offline banner
("everything works except AI drafting"); AI buttons already report "needs internet".
Field mode (Settings) hides case details on Home. Polish: skip link, Framer Motion
`reducedMotion="user"`, large text, dark mode, focus rings, 48px targets, status badges
with text labels. Production CSP (`connect-src 'self'` — the page can only talk to its own
server). README with privacy design, limitations, DPDP note, setup, keys, Vercel steps.
Smoke-tested on `next start`: all 20 routes 200, CSP present, unmasked phone → 422,
placeholder keys → graceful 503 "unavailable", no request content in server logs.

### Phase 12 — End-to-end check ✅
Real browser (headless Microsoft Edge via playwright-core, run from a temp folder — not
a project dependency), 360px width, fake data only, `MOCK_AI=true` set only on the dev
server process (`.env.local` stays `MOCK_AI=false`). 58 checks, all passing:
(a) onboarding, lock/unlock, wrong passphrase, auto-lock after 5 min, IndexedDB holds
ciphertext only, encrypted backup → delete → restore; (b) 3 cases with consent and
follow-ups, Today/Week/Overdue = 1/1/1, .ics titles masked; (c) typed note → Organise:
preview and actual network payload contain only tokens (no name/phone/Aadhaar/email/DOB/
address), names restored locally, follow-up created only on confirm; (d) blood camp
template, supplies 120→180, budget, 10 volunteers auto-assigned with no double-booking,
Tamil WhatsApp links encoded, QR, hours, 9 certificates; (e) after-event numbers, EN + TA
press notes, mock invented "500" flagged, template version passes; (f) media entry + CSV
import + coverage summary; (g) offline on production build (opens, unlocks, creates a
case, AI says "needs internet"), Field mode, Tamil UI, no horizontal scroll on any page.
Bugs found and fixed: duplicate accessible name on backup file input; budget showed
"₹-500" and squeezed item names at 360px; stat tiles overflowed in Tamil on Donations.

## Status
All 12 phases complete. 157 unit tests, typecheck, lint and build pass.
Possible next steps: real-device testing on Android Chrome; add screenshots to README.

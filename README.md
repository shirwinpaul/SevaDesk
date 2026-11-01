# SevaDesk 🤝

**Less paperwork. More people helped.**

SevaDesk is a calm, mobile-first, installable web app (PWA) for social workers,
volunteers and small NGOs in India. It keeps field notes, cases and follow-ups,
volunteers and events, camps and drives, impact reports and press notes (Tamil +
English), a media archive, a simple donations log and a resource directory — all on
your own device, encrypted.

> Screenshots: _add screenshots of Home, Field notes, Camp planner and Reports here._
> `docs/screenshot-home.png` · `docs/screenshot-notes.png` · `docs/screenshot-camp.png` · `docs/screenshot-reports.png`

## Modules

| Module | What it does |
| --- | --- |
| 🗒️ Field notes | Typed (or opt-in voice) visit notes → structured case notes; version history |
| 📁 Cases & follow-ups | Minimal case records with consent; Today / This week / Overdue; `.ics` export with masked titles |
| 🙋 Volunteers & events | Roster, skills, availability, fair auto-assign, WhatsApp messages, QR code, hours, certificates |
| ⛺ Camps & drives | 10 templates, timelines, supplies calculator, budget, printable run sheet, after-event numbers |
| 📰 Impact & reports | Dashboard, reports, press notes, social posts, impact card — numbers always from your records |
| 🗞️ Media archive | Coverage log, timeline, counts, CSV import, printable summary |
| 💰 Donations log | Simple register and thank-you letters (not an accounting or tax system) |
| 📚 Resource directory | Your own verified contacts, used by run sheets and referrals |

## Privacy & security design

- **Local-first.** All data is stored only in this browser (IndexedDB). No account, no
  server database.
- **Encrypted at rest.** Every record is encrypted with AES-GCM-256. The key is derived
  from your passphrase with PBKDF2-SHA-256 (600,000 iterations, random salt) and never
  leaves memory. Each record has its own random IV.
- **Auto-lock.** Locks after inactivity (default 5 minutes) and when the tab is hidden
  for a while. Locking clears decrypted data from memory. "Lock now" is always visible.
- **No recovery.** If you forget your passphrase, the data **cannot** be recovered. Write
  it down and keep it safe.
- **Encrypted backups.** Export everything as an encrypted `.sevadesk` file (main or a
  separate backup passphrase). Import it on this or another device. Back up weekly.
- **The AI never sees identities.** Before any AI request, names, phone numbers,
  Aadhaar-like and other ID numbers, emails, addresses, PIN codes and dates of birth are
  replaced with tokens like `{{PERSON_1}}`. Real values are restored only on your device.
  A **"What the AI will see"** preview is shown before the first AI use in each module.
  The server **rejects** any request that still contains a phone number, ID-like number
  or email, and never logs request bodies.
- **Facts come from you.** Report numbers are inserted by code. A validator flags any
  number in AI-written text that isn't in your records: "⚠️ Unverified number — check
  before sharing".
- **AI is optional.** Switch it off in Settings and no AI request is ever made;
  templates work for everything.
- **Free AI tiers:** free tiers of AI services may use submitted (masked) text to improve
  their models. Masking is why identities are never sent.
- **Voice input disclosure.** Browser speech recognition (e.g. in Chrome) sends audio to
  the browser vendor's servers to turn it into text. It is off by default, shown with a
  clear notice before use, and SevaDesk never records or stores audio. Typing is safer
  for sensitive notes.
- **Content-Security-Policy** in production restricts the page to talking only to its own
  server.

## Limitations

- **Single device.** Data lives in one browser on one device. Share with team members
  only through encrypted backup files.
- **Not a system of record.** SevaDesk is not a full case-management, accounting or tax
  system, and it does not make decisions about people (no risk scores or eligibility
  verdicts).
- **Clearing browser data deletes your SevaDesk data.** Keep backups.
- **Rate limits are best-effort.** The per-IP AI limit (60 calls/hour) is kept in memory,
  so on serverless hosting each instance counts separately.

Please follow the data-protection rules that apply to you (for example India's
**Digital Personal Data Protection (DPDP) Act, 2023**) and your organisation's own
policies. Collect only what you need and explain to people why you record their details.

## Tech stack

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Framer Motion · Zod · IndexedDB
(`idb`) + Web Crypto · Web Speech API · Recharts · `ics` · `qrcode` · Vitest · PWA.

AI: Google Gemini (`gemini-3.8-flash`, free tier) with Groq (`llama-3.3-70b-versatile`)
as fallback. All model settings are in `src/config/ai.ts`.

## Setup (Windows, step by step)

1. Install **Node.js 20 or newer** from <https://nodejs.org> (choose "LTS").
2. Open the project folder in **VS Code**, then open a terminal (**Terminal → New Terminal**).
3. Install packages:
   ```powershell
   npm.cmd install
   ```
   (If PowerShell blocks `npm`, always type `npm.cmd` instead of `npm`.)
4. Add your free AI keys (optional — the app works without AI):
   - Gemini key: <https://aistudio.google.com/apikey>
   - Groq key: <https://console.groq.com/keys>
   - Open the file **`.env.local`** in VS Code and replace
     `PASTE_YOUR_GEMINI_KEY_HERE` and `PASTE_YOUR_GROQ_KEY_HERE` with your keys. Save.
   - Never share this file or paste keys into chats. It is already ignored by git.
5. Start the app:
   ```powershell
   npm.cmd run dev
   ```
   Open <http://localhost:3000>.

### Environment variables

| Name | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Primary AI (server-side only) |
| `GROQ_API_KEY` | Fallback AI (server-side only) |
| `MOCK_AI` | `true` = canned AI answers for testing, development only (ignored in production) |

Users can also add their own Gemini key in **Settings** (stored encrypted on their device
and sent only with their own requests, never stored or logged on the server).

### Useful commands

```powershell
npm.cmd run dev        # start for development
npm.cmd run test       # unit tests (Vitest)
npm.cmd run typecheck  # TypeScript checks
npm.cmd run lint       # ESLint
npm.cmd run build      # production build
npm.cmd run start      # run the production build
```

## Deploy to Vercel (free Hobby plan)

1. Push the project to a GitHub repository (the `.env.local` file is never uploaded).
2. Sign in at <https://vercel.com> with GitHub → **Add New… → Project** → import the repo.
3. In **Settings → Environment Variables**, add `GEMINI_API_KEY` and `GROQ_API_KEY`.
   Do **not** add `MOCK_AI=true` in production (it is ignored there anyway).
4. Click **Deploy**. AI routes use `maxDuration = 60` (allowed on Hobby). Only small,
   masked JSON is ever sent to the API (capped at 32 KB, far below Vercel's ~4.5 MB limit).
5. On a phone, open the site in Chrome → menu ⋮ → **Add to Home screen** / **Install app**.

## Testing safely

Use only **fake** people, places and phone numbers until you have tested everything.
Set `MOCK_AI=true` in `.env.local` while testing AI features without using your quota,
then set it back to `false`.

## Credits

Built by Anand Raj. Original illustrations; no stock photos, no real people.

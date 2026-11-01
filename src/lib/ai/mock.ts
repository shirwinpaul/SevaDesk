// Development-only mock provider (MOCK_AI=true, never in production builds).
// Returns canned JSON built from the masked input so the whole flow can be tested
// without keys. The press note DELIBERATELY includes an invented number ("500") so
// the end-to-end check can confirm the validator flags it.

import type { Provider } from "./providers";

function inputOf(user: string): Record<string, unknown> {
  const m = /<data>([\s\S]*)<\/data>/.exec(user);
  try {
    return m ? (JSON.parse(m[1]!) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const tokens = (s: string) => [...new Set(s.match(/\{\{[A-Z]+_\d+\}\}/g) ?? [])];

export const mockProvider: Provider = async ({ system, user }) => {
  const input = inputOf(user);
  const ta = input.lang === "ta" || input.uiLang === "ta";
  if (system.includes("field visit note")) {
    const note = String(input.note ?? "");
    const person = tokens(note).find((t) => t.startsWith("{{PERSON")) ?? "the family";
    return JSON.stringify({
      summary: `(Mock) Visited ${person}. ${note.slice(0, 160)}`,
      needsIdentified: [{ category: "documentation", description: "Needs help with ration card renewal (mock)" }],
      actionsTaken: ["Explained the application process (mock)"],
      followUps: [
        { task: `Call ${person} about documents`, suggestedDueInDays: 3 },
        { task: "Check with taluk office (mock)", suggestedDueInDays: 7 },
      ],
      referralsMentioned: [],
      language: ta ? "ta" : "en",
    });
  }
  if (system.includes("referral letter")) {
    return JSON.stringify({
      summary: "(Mock) This person has been supported by our team. Details below are drawn from field notes.",
      needs: ["Documentation support (mock)"],
      actionsSoFar: ["Home visit and follow-up calls (mock)"],
      requestToAgency: "We request your kind support and assessment. (mock)",
    });
  }
  if (system.includes("thank-you line")) {
    return JSON.stringify({ line: ta ? "உங்கள் அன்பான சேவைக்கு மனமார்ந்த நன்றி. (mock)" : "Thank you for giving your time and heart to the community. (mock)" });
  }
  const facts = (input.facts ?? {}) as Record<string, unknown>;
  const factLine = Object.entries(facts)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  if (system.includes("press note")) {
    return JSON.stringify({
      headline: ta ? `${input.eventTitle} — வெற்றிகரமாக நடைபெற்றது (mock)` : `${input.eventTitle} held successfully (mock)`,
      body: ta
        ? `${input.dateline}: ${input.org} நடத்திய ${input.eventTitle} நிகழ்வு நடைபெற்றது. ${factLine}. 500 க்கும் மேற்பட்டோர் பாராட்டினர். (mock)`
        : `${input.dateline}: ${input.org} organised ${input.eventTitle}. ${factLine}. Over 500 residents praised the effort. (mock)`,
      draftQuote: ta ? "“இது சமூகத்தின் வெற்றி.” (mock)" : "“This is a success for the whole community.” (mock)",
    });
  }
  if (system.includes("social media")) {
    return JSON.stringify({
      facebook: `${input.eventTitle}: ${factLine}. Thank you all! (mock)`,
      instagram: `${input.eventTitle} 💚 ${factLine} (mock)`,
      x: `${input.eventTitle}: ${factLine} (mock)`.slice(0, 270),
      whatsappStatus: `${input.eventTitle} 🙏 (mock)`,
    });
  }
  return JSON.stringify({
    title: `(Mock) ${String(input.kind ?? "Report")} — ${String(input.period ?? "")}`,
    sections: [
      { heading: "Overview", body: `${input.org} continued its work. ${factLine}. (mock)` },
      { heading: "Highlights", body: `${String(input.highlights ?? "").slice(0, 300)} (mock)` },
    ],
  });
};

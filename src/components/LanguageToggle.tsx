"use client";

import { useUiPrefs } from "@/hooks/useUiPrefs";

export function LanguageToggle() {
  const { prefs, setPrefs } = useUiPrefs();
  return (
    <div role="group" aria-label="Language / மொழி" className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        className={`px-3 min-h-[48px] ${prefs.lang === "en" ? "bg-teal-700 text-white" : ""}`}
        aria-pressed={prefs.lang === "en"}
        onClick={() => setPrefs({ lang: "en" })}
      >
        English
      </button>
      <button
        type="button"
        lang="ta"
        className={`px-3 min-h-[48px] ${prefs.lang === "ta" ? "bg-teal-700 text-white" : ""}`}
        aria-pressed={prefs.lang === "ta"}
        onClick={() => setPrefs({ lang: "ta" })}
      >
        தமிழ்
      </button>
    </div>
  );
}

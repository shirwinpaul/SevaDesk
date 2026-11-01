"use client";

import { useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { useSpeech } from "@/hooks/useSpeech";
import { Modal } from "./ui";

// The disclosure must be acknowledged once per unlocked session before the mic starts.
let acknowledgedThisSession = false;

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const { t, prefs } = useUiPrefs();
  const { settings } = useSettings();
  const { supported, listening, error, start, stop } = useSpeech(onText);
  const [disclosure, setDisclosure] = useState(false);
  const [lang, setLang] = useState<"ta-IN" | "en-IN">(prefs.lang === "ta" ? "ta-IN" : "en-IN");

  if (!settings.voiceEnabled) return <p className="text-sm muted">🎤 {t.notes.voice.disabled}</p>;
  if (!supported) return <p className="text-sm muted">🎤 {t.notes.voice.unsupported}</p>;

  const begin = () => {
    if (!acknowledgedThisSession) setDisclosure(true);
    else start(lang);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="speech-lang">
        {t.notes.voice.language}
      </label>
      <select id="speech-lang" className="field w-auto" value={lang} onChange={(e) => setLang(e.target.value as "ta-IN" | "en-IN")} disabled={listening}>
        <option value="ta-IN">தமிழ்</option>
        <option value="en-IN">English</option>
      </select>
      {listening ? (
        <button type="button" className="btn btn-accent" onClick={stop}>
          {t.notes.voice.stop}
        </button>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={begin}>
          {t.notes.voice.button}
        </button>
      )}
      <span aria-live="polite" className="text-sm">
        {listening ? t.notes.voice.listening : error ? fmt(t.notes.voice.error, { error }) : ""}
      </span>
      <Modal open={disclosure} title={t.notes.voice.disclosureTitle} onClose={() => setDisclosure(false)}>
        <p>{t.notes.voice.disclosure}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setDisclosure(false)}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              acknowledgedThisSession = true;
              setDisclosure(false);
              start(lang);
            }}
          >
            {t.notes.voice.agree}
          </button>
        </div>
      </Modal>
    </div>
  );
}

"use client";

// Opt-in voice input via the Web Speech API. Principle 5: in Chrome, speech is sent to
// the browser vendor's servers for recognition — the UI must disclose this before use.
// We never create or store audio recordings; only the recognised text is kept.

import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => RecognitionLike;

function getCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(onText: (finalText: string) => void) {
  const [supported] = useState(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef<RecognitionLike | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback((lang: "ta-IN" | "en-IN") => {
    const C = getCtor();
    if (!C) return;
    const rec = new C();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r?.isFinal) cb.current(r[0].transcript.trim());
      }
    };
    rec.onerror = (e) => setError(e.error);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError("");
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, error, start, stop };
}

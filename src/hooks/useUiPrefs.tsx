"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, type Dict, type Lang } from "@/i18n";

// Non-sensitive display preferences only. These live in localStorage so the lock
// screen can be shown in the right language before the encrypted store is opened.
export interface UiPrefs {
  lang: Lang;
  theme: "light" | "dark";
  largeText: boolean;
}

const KEY = "sevadesk.ui";
const DEFAULTS: UiPrefs = { lang: "en", theme: "light", largeText: false };

function readPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      lang: p.lang === "ta" ? "ta" : "en",
      theme: p.theme === "dark" ? "dark" : "light",
      largeText: p.largeText === true,
    };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  prefs: UiPrefs;
  t: Dict;
  setPrefs: (patch: Partial<UiPrefs>) => void;
}

const UiPrefsContext = createContext<Ctx | null>(null);

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<UiPrefs>(DEFAULTS);

  useEffect(() => {
    // Hydrate from storage after mount (avoids server/client mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readPrefs());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", prefs.theme === "dark");
    root.classList.toggle("large-text", prefs.largeText);
    root.lang = prefs.lang;
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<UiPrefs>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in memory */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, t: dictionaries[prefs.lang], setPrefs }), [prefs, setPrefs]);
  return <UiPrefsContext.Provider value={value}>{children}</UiPrefsContext.Provider>;
}

export function useUiPrefs(): Ctx {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error("useUiPrefs must be used inside UiPrefsProvider");
  return ctx;
}

export function useT(): Dict {
  return useUiPrefs().t;
}

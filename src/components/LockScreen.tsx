"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useVault } from "@/hooks/useVault";
import { LanguageToggle } from "./LanguageToggle";
import { NotebookIllustration } from "./Illustrations";
import { LiveMessage, TextInput } from "./ui";
import { EraseDialog } from "./EraseDialog";

export function LockScreen() {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [eraseOpen, setEraseOpen] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const ok = await session.unlock(pass).catch(() => false);
    setPass("");
    if (!ok) {
      setError(t.lock.wrong);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 space-y-6">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <NotebookIllustration className="mx-auto w-28 h-auto" />
      <h1 className="text-2xl font-bold text-center">🔒 {t.lock.title}</h1>
      <form onSubmit={onSubmit} className="card space-y-4">
        <TextInput
          label={t.lock.label}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !pass}>
          {busy ? t.lock.unlocking : t.lock.unlock}
        </button>
        <LiveMessage message={error} tone="error" />
      </form>
      <details className="card">
        <summary className="cursor-pointer min-h-[48px] flex items-center">{t.lock.forgot.split("?")[0]}?</summary>
        <p className="muted my-3">{t.lock.forgot}</p>
        <button type="button" className="btn btn-danger" onClick={() => setEraseOpen(true)}>
          {t.lock.eraseAndRestart}
        </button>
      </details>
      <EraseDialog open={eraseOpen} onClose={() => setEraseOpen(false)} />
    </main>
  );
}

"use client";

import { useRef, useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings, useVault } from "@/hooks/useVault";
import { exportBackup, importBackup } from "@/lib/secure/backup";
import { EraseDialog } from "@/components/EraseDialog";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LiveMessage, PageHeader, Select, TextInput, Toggle, downloadFile } from "@/components/ui";

export default function SettingsPage() {
  const { t, prefs, setPrefs } = useUiPrefs();
  const { session } = useVault();
  const { settings, update } = useSettings();
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" }>({ text: "", tone: "success" });
  const [separate, setSeparate] = useState(false);
  const [backupPass, setBackupPass] = useState("");
  const [importPass, setImportPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const minuteOpts = (list: number[]) => list.map((m) => ({ value: String(m), label: m === 0 ? "—" : fmt(t.onboarding.minutes, { n: m }) }));

  async function doExport() {
    setBusy(true);
    try {
      // The backup is always protected by a passphrase the user types now; for "main"
      // we verify it matches the vault passphrase first.
      if (!separate && !(await session.store.verify(backupPass))) throw new Error("bad");
      if (backupPass.length < 10) throw new Error("short");
      const file = await exportBackup(session.store, backupPass);
      downloadFile(`sevadesk-backup-${new Date().toISOString().slice(0, 10)}.sevadesk`, file, "application/json");
      await update({ lastBackupAt: new Date().toISOString() });
      setMsg({ text: t.settings.exportDone, tone: "success" });
      setBackupPass("");
    } catch {
      setMsg({ text: separate ? t.onboarding.passTooShort : t.lock.wrong, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await importBackup(session.store, await file.text(), importPass);
      session.invalidateAll();
      setMsg({ text: t.settings.importDone, tone: "success" });
      setImportPass("");
    } catch {
      setMsg({ text: t.settings.importFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t.settings.title} icon="⚙️" />
      <LiveMessage message={msg.text} tone={msg.tone} />

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">{t.settings.general}</h2>
        <div>
          <p className="font-medium mb-1">{t.settings.language}</p>
          <LanguageToggle />
        </div>
        <TextInput label={t.settings.orgName} key={`o${settings.orgName}`} defaultValue={settings.orgName} maxLength={120} onBlur={(e) => void update({ orgName: e.target.value.trim() })} />
        <TextInput label={t.settings.workerName} key={`w${settings.workerName}`} defaultValue={settings.workerName} maxLength={80} onBlur={(e) => void update({ workerName: e.target.value.trim() })} />
        <Select
          label={t.settings.theme}
          value={prefs.theme}
          onChange={(e) => setPrefs({ theme: e.target.value === "dark" ? "dark" : "light" })}
          options={[
            { value: "light", label: `☀️ ${t.settings.light}` },
            { value: "dark", label: `🌙 ${t.settings.dark}` },
          ]}
        />
        <Toggle label={t.settings.largeText} checked={prefs.largeText} onChange={(v) => setPrefs({ largeText: v })} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">🔒 {t.settings.security}</h2>
        <Select
          label={t.settings.autoLock}
          value={String(settings.autoLockMin)}
          onChange={(e) => void update({ autoLockMin: Number(e.target.value) })}
          options={minuteOpts([1, 2, 5, 10, 15, 30, 60])}
        />
        <Select
          label={t.settings.hiddenLock}
          value={String(settings.hiddenLockMin)}
          onChange={(e) => void update({ hiddenLockMin: Number(e.target.value) })}
          options={minuteOpts([0, 1, 2, 5, 10, 30])}
        />
        <Toggle label={t.settings.fieldMode} checked={settings.fieldMode} onChange={(v) => void update({ fieldMode: v })} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">✨ {t.settings.ai}</h2>
        <Toggle
          label={settings.aiEnabled ? t.settings.aiEnabled : t.settings.aiDisabled}
          checked={settings.aiEnabled}
          onChange={(v) => void update({ aiEnabled: v })}
        />
        <p className="text-sm muted">{t.settings.aiNote}</p>
        {settings.aiEnabled && (
          <TextInput
            label={t.settings.byok}
            help={t.settings.byokHelp}
            type="password"
            autoComplete="off"
            defaultValue={settings.byokGemini}
            maxLength={200}
            onBlur={(e) => void update({ byokGemini: e.target.value.trim() })}
          />
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">🎤 {t.settings.voice}</h2>
        <p className="text-sm muted">{t.settings.voiceHelp}</p>
        <Toggle label={t.settings.voiceEnabled} checked={settings.voiceEnabled} onChange={(v) => void update({ voiceEnabled: v })} />
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">💾 {t.settings.backup}</h2>
        <p className="muted">{t.settings.backupHelp}</p>
        <p className="text-sm">
          {settings.lastBackupAt
            ? fmt(t.settings.lastBackup, { date: new Date(settings.lastBackupAt).toLocaleDateString() })
            : t.settings.neverBackedUp}
        </p>
        <fieldset className="space-y-1">
          <label className="flex items-center gap-3 min-h-[48px]">
            <input type="radio" className="w-5 h-5" checked={!separate} onChange={() => setSeparate(false)} />
            {t.settings.backupUseMain}
          </label>
          <label className="flex items-center gap-3 min-h-[48px]">
            <input type="radio" className="w-5 h-5" checked={separate} onChange={() => setSeparate(true)} />
            {t.settings.backupUseSeparate}
          </label>
        </fieldset>
        <TextInput
          label={separate ? t.settings.backupPass : t.lock.label}
          type="password"
          autoComplete={separate ? "new-password" : "current-password"}
          value={backupPass}
          onChange={(e) => setBackupPass(e.target.value)}
        />
        <button type="button" className="btn btn-primary" disabled={busy || !backupPass} onClick={doExport}>
          ⬇️ {t.settings.exportBackup}
        </button>

        <hr className="border-[var(--border)]" />
        <h3 className="font-semibold">{t.settings.importBackup}</h3>
        <p className="text-sm text-saffron-700 dark:text-saffron-100">⚠️ {t.settings.importWarning}</p>
        <input ref={fileRef} type="file" accept=".sevadesk,application/json" className="field" aria-label={t.settings.backupFile} />
        <TextInput label={t.settings.importPass} type="password" autoComplete="off" value={importPass} onChange={(e) => setImportPass(e.target.value)} />
        <button type="button" className="btn btn-ghost" disabled={busy || !importPass} onClick={doImport}>
          ⬆️ {t.settings.importBackup}
        </button>
      </section>

      <section className="card space-y-3 border-red-300">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">{t.settings.erase}</h2>
        <p className="muted">{t.settings.eraseHelp}</p>
        <button type="button" className="btn btn-danger" onClick={() => setEraseOpen(true)}>
          🗑️ {t.settings.erase}
        </button>
      </section>
      <EraseDialog open={eraseOpen} onClose={() => setEraseOpen(false)} />
    </div>
  );
}

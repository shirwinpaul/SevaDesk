"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useVault } from "@/hooks/useVault";
import { MIN_PASSPHRASE, passphraseStrength } from "@/lib/secure/strength";
import { SettingsSchema } from "@/types/models";
import { LanguageToggle } from "./LanguageToggle";
import { HandsLeafIllustration } from "./Illustrations";
import { LiveMessage, Select, TextInput, Toggle } from "./ui";

const TOTAL = 5;
const STRENGTH_COLORS = ["bg-red-600", "bg-orange-500", "bg-yellow-500", "bg-leaf-600", "bg-teal-700"];

export function Onboarding() {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const [step, setStep] = useState(1);
  const [org, setOrg] = useState("");
  const [ack, setAck] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [ai, setAi] = useState(false);
  const [lockMin, setLockMin] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const strength = passphraseStrength(pass);
  const passOk = pass.length >= MIN_PASSPHRASE && pass === pass2;

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await session.create(pass);
      await session.save("settings", SettingsSchema, { id: "main", orgName: org.trim(), aiEnabled: ai, autoLockMin: lockMin });
      setPass("");
      setPass2("");
    } catch {
      setError(t.common.error);
      setBusy(false);
    }
  }

  const canNext = step === 3 ? ack : step === 4 ? passOk : true;

  return (
    <main className="mx-auto max-w-xl px-4 py-8 space-y-6">
      <HandsLeafIllustration className="mx-auto w-40 h-auto" />
      <h1 className="text-2xl font-bold text-center">{t.onboarding.title}</h1>
      <p className="text-center muted">{fmt(t.onboarding.step, { n: step, total: TOTAL })}</p>
      <div className="h-2 rounded-full bg-[var(--surface-2)]" aria-hidden="true">
        <div className="h-2 rounded-full bg-teal-600 transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      <motion.section key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="card space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-xl font-semibold">{t.onboarding.languageTitle}</h2>
            <LanguageToggle />
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="text-xl font-semibold">{t.onboarding.orgTitle}</h2>
            <TextInput label={t.onboarding.orgLabel} help={t.onboarding.orgHelp} value={org} maxLength={120} onChange={(e) => setOrg(e.target.value)} />
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="text-xl font-semibold">🔒 {t.onboarding.privacyTitle}</h2>
            <ul className="list-disc pl-5 space-y-2">
              {t.onboarding.privacyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="rounded-xl border border-saffron-500 bg-saffron-100 text-saffron-700 dark:bg-transparent dark:text-saffron-100 p-3 font-medium">
              ⚠️ {t.onboarding.noRecovery}
            </p>
            <Toggle label={t.onboarding.noRecoveryAck} checked={ack} onChange={setAck} />
          </>
        )}
        {step === 4 && (
          <>
            <h2 className="text-xl font-semibold">{t.onboarding.passTitle}</h2>
            <p className="muted">{t.onboarding.passHelp}</p>
            <TextInput label={t.onboarding.passLabel} type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <div>
              <div className="flex gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-2 flex-1 rounded ${i <= strength && pass ? STRENGTH_COLORS[strength] : "bg-[var(--surface-2)]"}`} />
                ))}
              </div>
              <p className="text-sm mt-1" aria-live="polite">
                {t.onboarding.strength}: {pass ? t.onboarding.strengthLevels[strength] : "—"}
              </p>
            </div>
            <TextInput label={t.onboarding.passConfirm} type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
            {pass && pass.length < MIN_PASSPHRASE && <p className="text-sm text-red-700 dark:text-red-300">{t.onboarding.passTooShort}</p>}
            {pass2 && pass !== pass2 && <p className="text-sm text-red-700 dark:text-red-300">{t.onboarding.passMismatch}</p>}
          </>
        )}
        {step === 5 && (
          <>
            <h2 className="text-xl font-semibold">✨ {t.onboarding.aiTitle}</h2>
            <fieldset className="space-y-1">
              <legend className="sr-only">{t.onboarding.aiTitle}</legend>
              <label className="flex items-center gap-3 min-h-[48px]">
                <input type="radio" name="ai" className="w-5 h-5" checked={!ai} onChange={() => setAi(false)} />
                {t.onboarding.aiOff}
              </label>
              <label className="flex items-center gap-3 min-h-[48px]">
                <input type="radio" name="ai" className="w-5 h-5" checked={ai} onChange={() => setAi(true)} />
                {t.onboarding.aiOn}
              </label>
            </fieldset>
            <p className="text-sm muted">{t.settings.aiNote}</p>
            <h2 className="text-xl font-semibold">⏱️ {t.onboarding.lockTitle}</h2>
            <Select
              label={t.onboarding.lockLabel}
              value={String(lockMin)}
              onChange={(e) => setLockMin(Number(e.target.value))}
              options={[2, 5, 10, 15, 30].map((m) => ({ value: String(m), label: fmt(t.onboarding.minutes, { n: m }) }))}
            />
          </>
        )}
      </motion.section>

      <LiveMessage message={error} tone="error" />

      <div className="flex justify-between gap-3">
        <button type="button" className="btn btn-ghost" disabled={step === 1 || busy} onClick={() => setStep((s) => s - 1)}>
          {t.common.back}
        </button>
        {step < TOTAL ? (
          <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            {t.common.next}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy || !passOk || !ack} onClick={finish}>
            {busy ? t.onboarding.creating : t.onboarding.finish}
          </button>
        )}
      </div>
    </main>
  );
}

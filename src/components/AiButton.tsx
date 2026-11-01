"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/i18n";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { aiRequest } from "@/lib/ai/client";
import type { AiInput, AiOutput, AiTask } from "@/lib/ai/schemas";
import { restoreDeep, type MaskMap } from "@/lib/mask";
import { LiveMessage, Modal, TextInput } from "./ui";

export interface Prepared<T extends AiTask> {
  input: AiInput<T>;
  map: MaskMap;
}

interface Props<T extends AiTask> {
  task: T;
  /** Preview gate key: the preview is shown before the first AI use of each module. */
  module: string;
  label: string;
  /** Builds the MASKED request. Called with extra words the user asked to hide. */
  prepare: (extraTerms: string[]) => Prepared<T>;
  /** Receives the output; restored to real values unless `keepTokens`. */
  onResult: (data: AiOutput<T>, meta: { map: MaskMap; unknownTokens: string[] }) => void;
  keepTokens?: boolean;
  disabled?: boolean;
}

/** Renders nothing at all when AI is switched off (no AI calls possible). */
export function AiButton<T extends AiTask>({ task, module, label, prepare, onResult, keepTokens = false, disabled }: Props<T>) {
  const { t } = useUiPrefs();
  const { settings, update } = useSettings();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [prepared, setPrepared] = useState<Prepared<T> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [warning, setWarning] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  if (!settings.aiEnabled) return null;

  const extraTerms = () => extra.split(",").map((s) => s.trim()).filter(Boolean);

  function openPreview() {
    setPrepared(prepare(extraTerms()));
    setPreviewOpen(true);
  }

  async function send(p: Prepared<T>) {
    setPreviewOpen(false);
    setBusy(true);
    setError("");
    setWarning("");
    if (!settings.aiPreviewSeen.includes(module)) await update({ aiPreviewSeen: [...settings.aiPreviewSeen, module] });
    const res = await aiRequest(task, p.input, { enabled: settings.aiEnabled, byok: settings.byokGemini || undefined });
    setBusy(false);
    if (!res.ok) {
      if (res.error === "rateLimit") {
        setCountdown(res.retryAfterSec ?? 30);
        return;
      }
      setError(t.ai[res.error === "disabled" ? "unavailable" : res.error]);
      return;
    }
    const unknown = new Set<string>();
    const data = keepTokens ? res.data : restoreDeep(res.data, p.map, unknown);
    if (unknown.size) setWarning(fmt(t.ai.unknownTokens, { list: [...unknown].join(", ") }));
    onResult(data as AiOutput<T>, { map: p.map, unknownTokens: [...unknown] });
  }

  function click() {
    const p = prepare(extraTerms());
    if (!settings.aiPreviewSeen.includes(module)) {
      setPrepared(p);
      setPreviewOpen(true);
    } else void send(p);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-accent" disabled={disabled || busy || countdown > 0} onClick={click}>
          {busy ? t.ai.working : label}
        </button>
        <button type="button" className="btn btn-ghost" disabled={disabled || busy} onClick={openPreview}>
          {t.ai.previewSeeAgain}
        </button>
      </div>
      <div aria-live="polite">
        {countdown > 0 && <p className="text-saffron-700 dark:text-saffron-100">⏳ {fmt(t.ai.rateLimit, { n: countdown })}</p>}
      </div>
      <LiveMessage message={error} tone="error" />
      <LiveMessage message={warning} tone="info" />
      <Modal open={previewOpen} title={t.ai.previewTitle} onClose={() => setPreviewOpen(false)}>
        <p className="text-sm">{t.ai.previewHelp}</p>
        {prepared && (
          <>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--surface-2)] p-3 text-sm max-h-72 overflow-y-auto">
              {JSON.stringify(prepared.input, null, 2)}
            </pre>
            {Object.keys(prepared.map).length > 0 && (
              <details>
                <summary className="cursor-pointer min-h-[40px] flex items-center font-medium">🔒 {t.ai.tokensTitle} ({Object.keys(prepared.map).length})</summary>
                <ul className="text-sm">
                  {Object.entries(prepared.map).map(([tok, val]) => (
                    <li key={tok}>
                      <code>{tok}</code> → {val}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <TextInput label={t.ai.extraHide} value={extra} onChange={(e) => setExtra(e.target.value)} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setPrepared(prepare(extraTerms()))}>
            {t.ai.updatePreview}
          </button>
          <button type="button" className="btn btn-primary" disabled={!prepared} onClick={() => prepared && void send(prepare(extraTerms()))}>
            {t.ai.send}
          </button>
        </div>
        <p className="text-xs muted">{t.settings.aiNote}</p>
      </Modal>
    </div>
  );
}

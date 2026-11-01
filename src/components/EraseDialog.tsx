"use client";

import { useState } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useVault } from "@/hooks/useVault";
import { Modal, TextInput } from "./ui";

/** Double confirmation: a warning step, then typing ERASE. */
export function EraseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useUiPrefs();
  const { session } = useVault();
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  function close() {
    setStep(1);
    setTyped("");
    onClose();
  }

  async function erase() {
    setBusy(true);
    await session.erase();
    setBusy(false);
    close();
  }

  return (
    <Modal open={open} title={t.settings.erase} onClose={close}>
      {step === 1 ? (
        <>
          <p className="font-medium">⚠️ {t.settings.eraseConfirm1}</p>
          <p className="muted">{t.settings.eraseHelp}</p>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-ghost" onClick={close}>
              {t.common.cancel}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setStep(2)}>
              {t.common.next}
            </button>
          </div>
        </>
      ) : (
        <>
          <TextInput label={t.settings.eraseConfirm2} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-ghost" onClick={close}>
              {t.common.cancel}
            </button>
            <button type="button" className="btn btn-danger" disabled={typed !== "ERASE" || busy} onClick={erase}>
              {t.settings.erase}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

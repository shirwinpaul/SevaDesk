"use client";

import { useUiPrefs } from "@/hooks/useUiPrefs";
import { mask } from "@/lib/mask";
import { AiButton } from "./AiButton";

/** Suggests a certificate thank-you line. No personal data is sent — only the masked event title. */
export function ThankYouAiButton({ eventTitle, lang, onResult }: { eventTitle: string; lang: "en" | "ta"; onResult: (line: string) => void }) {
  const { t } = useUiPrefs();
  return (
    <AiButton
      task="thankYouLine"
      module="volunteers"
      label={t.ai.thankYouAi}
      prepare={(extraTerms) => {
        const { masked, map } = mask(eventTitle, { extraTerms });
        return { input: { eventTitle: masked, lang }, map };
      }}
      onResult={(o) => onResult(o.line)}
    />
  );
}

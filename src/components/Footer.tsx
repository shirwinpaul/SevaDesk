"use client";

import { useT } from "@/hooks/useUiPrefs";

export function Footer() {
  const t = useT();
  return (
    <footer className="no-print border-t border-[var(--border)] px-4 py-4 pb-24 md:pb-4 text-center text-sm muted">
      <p>
        {t.footer.builtBy} · 🔒 {t.footer.privacy}
      </p>
    </footer>
  );
}

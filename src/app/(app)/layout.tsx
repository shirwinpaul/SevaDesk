"use client";

import { useEffect, type ReactNode } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useVault } from "@/hooks/useVault";
import { AppShell } from "@/components/AppShell";
import { LockScreen } from "@/components/LockScreen";
import { Onboarding } from "@/components/Onboarding";
import { Spinner } from "@/components/ui";

/** Gate: onboarding (no vault) → lock screen (locked) → app (unlocked). */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useUiPrefs();
  const { session, status } = useVault();

  useEffect(() => {
    if (status === "loading") void session.init();
  }, [session, status]);

  if (status === "loading") return <Spinner label={t.common.loading} />;
  if (status === "none") return <Onboarding />;
  if (status === "locked") return <LockScreen />;
  return <AppShell>{children}</AppShell>;
}

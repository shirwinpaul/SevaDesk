"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings, useVault } from "@/hooks/useVault";
import { AutoLock } from "@/lib/secure/autolock";
import { OfflineBanner } from "./Pwa";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** Wires browser activity/visibility events to the pure AutoLock logic. */
function AutoLockWatcher() {
  const { session } = useVault();
  const { settings } = useSettings();
  const ref = useRef<AutoLock | null>(null);
  const idleMs = settings.autoLockMin * 60_000;
  const hiddenMs = settings.hiddenLockMin * 60_000;

  useEffect(() => {
    const al = new AutoLock({ idleMs, hiddenMs, onLock: () => session.lock() });
    ref.current = al;
    const onActivity = () => al.activity();
    const onVis = () => (document.hidden ? al.hidden() : al.visible());
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    const timer = window.setInterval(() => al.tick(), 5_000);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(timer);
    };
    // Recreated only when the session changes; timing updates are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    ref.current?.update(idleMs, hiddenMs === 0 ? Number.MAX_SAFE_INTEGER : hiddenMs);
  }, [idleMs, hiddenMs]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t, prefs } = useUiPrefs();
  const { session } = useVault();
  const pathname = usePathname();

  const bottom = [
    { href: "/home", icon: "🏠", label: t.nav.home },
    { href: "/notes", icon: "🗒️", label: t.nav.notes },
    { href: "/cases", icon: "📁", label: t.nav.cases },
    { href: "/events", icon: "🙋", label: t.nav.events },
    { href: "/more", icon: "☰", label: t.nav.more },
  ];
  const side = [
    ...bottom.slice(0, 4),
    { href: "/volunteers", icon: "🤝", label: t.nav.volunteers },
    { href: "/camps", icon: "⛺", label: t.nav.camps },
    { href: "/reports", icon: "📰", label: t.nav.reports },
    { href: "/media", icon: "🗞️", label: t.nav.media },
    { href: "/donations", icon: "💰", label: t.nav.donations },
    { href: "/resources", icon: "📚", label: t.nav.resources },
    { href: "/settings", icon: "⚙️", label: t.nav.settings },
  ];
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div lang={prefs.lang} className="min-h-dvh">
      <AutoLockWatcher />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn btn-accent">
        {t.pwa.skip}
      </a>
      <OfflineBanner />
      <header className="no-print sticky top-0 z-30 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-2 px-4 h-14">
          <Link href="/home" className="font-bold text-teal-700 dark:text-teal-100 text-lg">
            🤝 {t.common.appName}
          </Link>
          <button type="button" className="btn btn-ghost" onClick={() => session.lock()}>
            🔒 {t.common.lockNow}
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl md:flex md:gap-6 md:px-4">
        <nav aria-label={t.nav.mainNav} className="no-print hidden md:block w-56 shrink-0 py-4">
          <ul className="space-y-1 sticky top-18">
            {side.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-xl px-3 min-h-[44px] ${
                    active(l.href) ? "bg-teal-100 text-teal-800 font-semibold dark:bg-teal-800 dark:text-white" : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span aria-hidden="true">{l.icon}</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="flex-1 min-w-0 px-4 py-4 pb-28 md:pb-8">
          {children}
        </main>
      </div>
      <nav
        aria-label={t.nav.mainNav}
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--surface)] border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {bottom.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`flex flex-col items-center justify-center min-h-[60px] text-xs ${
                  active(l.href) ? "text-teal-700 dark:text-teal-100 font-bold" : "muted"
                }`}
              >
                <span aria-hidden="true" className="text-xl">
                  {l.icon}
                </span>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

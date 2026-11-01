"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { useT } from "@/hooks/useUiPrefs";

/** Registers the service worker in production builds only (dev reloads stay simple). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus — never break the app */
    });
  }, []);
  return null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

export function OfflineBanner() {
  const online = useOnline();
  const t = useT();
  if (online) return null;
  return (
    <p role="status" className="no-print bg-saffron-100 text-saffron-700 border-b border-saffron-500 px-4 py-2 text-center text-sm font-medium">
      📴 {t.pwa.offline}
    </p>
  );
}

/** Respect the user's "reduce motion" setting in every Framer Motion animation. */
export function Motion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

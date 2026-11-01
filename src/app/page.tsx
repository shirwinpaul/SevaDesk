"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useT, useUiPrefs } from "@/hooks/useUiPrefs";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CommunityIllustration, HandsLeafIllustration } from "@/components/Illustrations";

export default function LandingPage() {
  const t = useT();
  const { prefs } = useUiPrefs();
  return (
    <main lang={prefs.lang} className="mx-auto max-w-3xl px-4 py-8 space-y-10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-bold text-teal-700 dark:text-teal-100">🤝 {t.common.appName}</span>
        <LanguageToggle />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-5"
      >
        <HandsLeafIllustration className="mx-auto w-56 h-auto" />
        <h1 className="text-3xl md:text-4xl font-bold leading-tight">{t.landing.tagline}</h1>
        <p className="text-lg muted">{t.landing.intro}</p>
        <Link href="/home" className="btn btn-primary text-lg px-8">
          {t.landing.getStarted}
        </Link>
      </motion.section>

      <section aria-labelledby="what" className="card space-y-3">
        <h2 id="what" className="text-xl font-semibold">{t.landing.whatTitle}</h2>
        <ul className="space-y-2">
          {t.landing.what.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="privacy" className="card space-y-3 border-teal-600">
        <h2 id="privacy" className="text-xl font-semibold">🔒 {t.landing.privacyTitle}</h2>
        <p className="font-medium">{t.landing.privacy}</p>
        <ul className="list-disc pl-5 space-y-1">
          {t.landing.privacyPoints.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <CommunityIllustration className="mx-auto w-full max-w-md h-auto" />
    </main>
  );
}

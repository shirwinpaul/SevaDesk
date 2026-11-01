"use client";

import Link from "next/link";
import { useT } from "@/hooks/useUiPrefs";
import { PageHeader } from "@/components/ui";

export default function MorePage() {
  const t = useT();
  const links = [
    { href: "/volunteers", icon: "🤝", label: t.nav.volunteers },
    { href: "/camps", icon: "⛺", label: t.nav.camps },
    { href: "/reports", icon: "📰", label: t.nav.reports },
    { href: "/media", icon: "🗞️", label: t.nav.media },
    { href: "/donations", icon: "💰", label: t.nav.donations },
    { href: "/resources", icon: "📚", label: t.nav.resources },
    { href: "/settings", icon: "⚙️", label: t.nav.settings },
  ];
  return (
    <div>
      <PageHeader title={t.nav.more} />
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card flex flex-col items-center gap-2 py-6 hover:border-teal-600">
              <span aria-hidden="true" className="text-3xl">
                {l.icon}
              </span>
              <span className="font-medium text-center">{l.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

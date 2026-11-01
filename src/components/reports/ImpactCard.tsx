"use client";

import { useEffect, useMemo, useRef } from "react";
import { useUiPrefs } from "@/hooks/useUiPrefs";
import { useSettings } from "@/hooks/useVault";
import { formatINR } from "@/lib/camps";
import { computeImpact, type ImpactData, type Period } from "@/lib/reports/metrics";

const W = 1080;
const H = 1080;

/** Canvas "impact card": key numbers only — never personal data. */
export function ImpactCard({ data, period }: { data: ImpactData; period: Period }) {
  const { t, prefs } = useUiPrefs();
  const { settings } = useSettings();
  const ref = useRef<HTMLCanvasElement>(null);
  const m = useMemo(() => computeImpact(data, period), [data, period]);
  const stats = useMemo(
    () => [
      [t.reports.metric.peopleReached, String(m.peopleReached)],
      [t.reports.metric.campsHeld, String(m.campsHeld)],
      [t.reports.metric.volunteerHours, String(m.volunteerHours)],
      [t.reports.metric.followUpsDone, String(m.followUpsDone)],
      [t.reports.metric.donationsCash, `₹${formatINR(m.donationsCash)}`],
      [t.reports.metric.casesClosed, String(m.casesClosed)],
    ],
    [m, t],
  );

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    // Use the page's loaded fonts (Inter + Noto Sans Tamil) so Tamil renders correctly.
    const family = getComputedStyle(document.body).fontFamily;
    const draw = () => {
      ctx.fillStyle = "#fbfaf7";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#17645c";
      ctx.fillRect(0, 0, W, 230);
      ctx.fillStyle = "#e8891c";
      ctx.fillRect(0, 230, W, 12);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 60px ${family}`;
      ctx.fillText(settings.orgName || "SevaDesk", 70, 115, W - 140);
      ctx.font = `500 40px ${family}`;
      ctx.fillText(`${t.reports.cardTitle} · ${period.label}`, 70, 185, W - 140);
      stats.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 70 + col * 490;
        const y = 300 + row * 230;
        ctx.fillStyle = "#e3f3dc";
        ctx.beginPath();
        ctx.roundRect(x, y, 450, 200, 28);
        ctx.fill();
        ctx.fillStyle = "#124f49";
        ctx.font = `800 76px ${family}`;
        ctx.fillText(value ?? "", x + 32, y + 100, 390);
        ctx.fillStyle = "#326423";
        ctx.font = `500 32px ${family}`;
        ctx.fillText(label ?? "", x + 32, y + 160, 390);
      });
      ctx.fillStyle = "#55625f";
      ctx.font = `500 30px ${family}`;
      ctx.fillText(t.landing.tagline, 70, H - 50, W - 140);
    };
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
  }, [stats, settings.orgName, period.label, t, prefs.lang]);

  function download() {
    const url = ref.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `impact-card-${period.label}.png`;
    a.click();
  }

  return (
    <div className="space-y-3">
      <p className="muted">{t.reports.cardHelp}</p>
      <canvas ref={ref} width={W} height={H} className="w-full max-w-md rounded-xl border border-[var(--border)]" role="img" aria-label={`${t.reports.cardTitle}: ${stats.map((s) => s.join(" ")).join(", ")}`} />
      <button type="button" className="btn btn-primary" onClick={download}>
        {t.reports.downloadCard}
      </button>
    </div>
  );
}

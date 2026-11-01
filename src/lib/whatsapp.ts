// WhatsApp helpers: prefilled wa.me links (the user presses Send in WhatsApp
// themselves — nothing is sent automatically) and bilingual message templates.

import type { SevaEvent, Shift } from "@/types/models";

/** Normalise an Indian number to wa.me format (country code, digits only). */
export function waPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d;
}

/** wa.me link with UTF-8 percent-encoded text (works for Tamil). */
export function waLink(text: string, phone?: string): string {
  const p = phone ? waPhone(phone) : "";
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function mapLink(event: Pick<SevaEvent, "mapUrl" | "location">): string {
  if (event.mapUrl && /^https:\/\//.test(event.mapUrl)) return event.mapUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
}

type Lang = "en" | "ta";
interface Ctx {
  org: string;
  event: Pick<SevaEvent, "title" | "date" | "location" | "mapUrl">;
}

export function callForVolunteersMessage(ctx: Ctx, openRoles: Array<{ role: string; missing: number; start: string; end: string }>, lang: Lang): string {
  const roles = openRoles.map((r) => `• ${r.role} (${r.start}–${r.end}) × ${r.missing}`).join("\n");
  const map = mapLink(ctx.event);
  return lang === "ta"
    ? `🙏 தன்னார்வலர்கள் தேவை!\n\n*${ctx.event.title}*\n📅 ${ctx.event.date}\n📍 ${ctx.event.location}\n${map}\n\nதேவையான பணிகள்:\n${roles}\n\nஉதவ முடிந்தால் பதில் அனுப்புங்கள்.${ctx.org ? `\n— ${ctx.org}` : ""}`
    : `🙏 Volunteers needed!\n\n*${ctx.event.title}*\n📅 ${ctx.event.date}\n📍 ${ctx.event.location}\n${map}\n\nOpen roles:\n${roles}\n\nPlease reply if you can help.${ctx.org ? `\n— ${ctx.org}` : ""}`;
}

export function shiftConfirmationMessage(ctx: Ctx, name: string, shifts: Shift[], lang: Lang): string {
  const list = shifts.map((s) => `• ${s.role}: ${s.start}–${s.end}`).join("\n");
  const map = mapLink(ctx.event);
  return lang === "ta"
    ? `வணக்கம் ${name} 🙏\n\n*${ctx.event.title}* (${ctx.event.date}) நிகழ்வில் உங்கள் பணி:\n${list}\n📍 ${ctx.event.location}\n${map}\n\nஉறுதிப்படுத்த “சரி” என்று பதில் அனுப்புங்கள். நன்றி!${ctx.org ? `\n— ${ctx.org}` : ""}`
    : `Hello ${name} 🙏\n\nYour shift for *${ctx.event.title}* on ${ctx.event.date}:\n${list}\n📍 ${ctx.event.location}\n${map}\n\nPlease reply “OK” to confirm. Thank you!${ctx.org ? `\n— ${ctx.org}` : ""}`;
}

export function reminderMessage(ctx: Ctx, name: string, shifts: Shift[], lang: Lang): string {
  const first = [...shifts].sort((a, b) => a.start.localeCompare(b.start))[0];
  const when = first ? `${first.start}` : "";
  return lang === "ta"
    ? `நினைவூட்டல் ⏰ ${name}, நாளை (${ctx.event.date}) ${when} மணிக்கு *${ctx.event.title}* — ${ctx.event.location}. சந்திப்போம்! 🙏`
    : `Reminder ⏰ ${name}, see you on ${ctx.event.date} at ${when} for *${ctx.event.title}* — ${ctx.event.location}. Thank you! 🙏`;
}

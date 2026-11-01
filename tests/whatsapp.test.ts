import { describe, expect, it } from "vitest";
import { callForVolunteersMessage, mapLink, shiftConfirmationMessage, waLink, waPhone } from "@/lib/whatsapp";
import { ShiftSchema } from "@/types/models";

const event = { title: "Fake Blood Camp", date: "2026-11-07", location: "Test Hall, Fakepuram", mapUrl: "" };

describe("WhatsApp helpers", () => {
  it("normalises Indian phone numbers", () => {
    expect(waPhone("98765 43210")).toBe("919876543210");
    expect(waPhone("098765-43210")).toBe("919876543210");
    expect(waPhone("+91 98765 43210")).toBe("919876543210");
  });

  it("encodes Tamil text so it round-trips through the URL", () => {
    const text = "வணக்கம் 🙏 நாளை சந்திப்போம் & நன்றி";
    const url = waLink(text, "9876543210");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(url).not.toMatch(/[஀-௿ ]/); // no raw Tamil or spaces in the URL
    expect(url).toContain("%26"); // & is encoded
    expect(decodeURIComponent(new URL(url).searchParams.get("text")!)).toBe(text);
    expect(new URL(url).searchParams.get("text")).toBe(text);
  });

  it("works without a phone (choose contact in WhatsApp)", () => {
    expect(waLink("hi")).toBe("https://wa.me/?text=hi");
  });

  it("builds bilingual messages", () => {
    const s = ShiftSchema.parse({ id: "s", role: "Registration", slot: "morning", start: "08:00", end: "12:00", required: 1 });
    expect(shiftConfirmationMessage({ org: "Fake Trust", event }, "Fake Volunteer", [s], "ta")).toContain("வணக்கம் Fake Volunteer");
    const call = callForVolunteersMessage({ org: "", event }, [{ role: "First aid", missing: 2, start: "08:00", end: "12:00" }], "en");
    expect(call).toContain("First aid (08:00–12:00) × 2");
    expect(call).toContain("https://www.google.com/maps/search/?api=1&query=Test%20Hall%2C%20Fakepuram");
  });

  it("only uses https map URLs supplied by the user", () => {
    expect(mapLink({ mapUrl: "javascript:alert(1)", location: "X" })).toContain("google.com/maps");
    expect(mapLink({ mapUrl: "https://maps.example/x", location: "X" })).toBe("https://maps.example/x");
  });
});

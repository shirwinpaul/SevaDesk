import type { Volunteer } from "@/types/models";

export const totalHours = (v: Volunteer) => Math.round(v.hoursLog.reduce((s, h) => s + h.hours, 0) * 100) / 100;

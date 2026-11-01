import { z } from "zod";

// Zod schemas for every stored record. Records are validated on read and write.

export const id = () => z.string().min(1);
export const isoDate = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

export const SettingsSchema = z.object({
  id: z.literal("main"),
  orgName: z.string().max(120).default(""),
  workerName: z.string().max(80).default(""),
  aiEnabled: z.boolean().default(false),
  autoLockMin: z.number().int().min(1).max(120).default(5),
  hiddenLockMin: z.number().int().min(0).max(120).default(2),
  fieldMode: z.boolean().default(false),
  voiceEnabled: z.boolean().default(false),
  byokGemini: z.string().max(200).default(""),
  lastBackupAt: z.string().nullable().default(null),
  /** Modules for which the user has seen the "What the AI will see" preview. */
  aiPreviewSeen: z.array(z.string()).default([]),
  /** Running counter for human-friendly case IDs (#0001). */
  caseCounter: z.number().int().min(0).default(0),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const defaultSettings = (): Settings => SettingsSchema.parse({ id: "main" });

// ---------- Cases & follow-ups ----------
export const CASE_CATEGORIES = [
  "education",
  "health",
  "elderCare",
  "disability",
  "livelihood",
  "womenChild",
  "housing",
  "documentation",
  "relief",
  "other",
] as const;
export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CASE_STATUSES = ["new", "active", "referred", "closed"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CONSENT_VALUES = ["yes", "verbal", "no"] as const;

export const CaseSchema = z.object({
  id: id(),
  number: z.number().int().positive(),
  displayName: z.string().trim().min(1).max(80),
  phone: z.string().max(20).default(""),
  area: z.string().max(80).default(""),
  categories: z.array(z.enum(CASE_CATEGORIES)).default([]),
  status: z.enum(CASE_STATUSES).default("new"),
  consent: z.enum(CONSENT_VALUES),
  assignedTo: z.string().default(""),
  documents: z.array(z.object({ label: z.string().max(80), done: z.boolean() })).default([]),
  referrals: z
    .array(z.object({ id: id(), to: z.string().max(120), date: isoDate(), note: z.string().max(500).default("") }))
    .default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable().default(null),
});
export type Case = z.infer<typeof CaseSchema>;

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;

export const TaskSchema = z.object({
  id: id(),
  title: z.string().trim().min(1).max(200),
  caseId: z.string().default(""),
  dueDate: isoDate(),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  owner: z.string().max(80).default(""),
  status: z.enum(["open", "done"]).default("open"),
  createdAt: z.string(),
  doneAt: z.string().nullable().default(null),
});
export type Task = z.infer<typeof TaskSchema>;

export const caseLabel = (n: number) => `#${String(n).padStart(4, "0")}`;

// ---------- Volunteers ----------
export const SKILLS = [
  "firstAid",
  "driving",
  "teaching",
  "cooking",
  "photography",
  "translation",
  "dataEntry",
  "medical",
  "counselling",
  "logistics",
] as const;
export type Skill = (typeof SKILLS)[number];

export const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const VolunteerSchema = z.object({
  id: id(),
  name: z.string().trim().min(1).max(80),
  phone: z.string().max(20).default(""),
  area: z.string().max(80).default(""),
  skills: z.array(z.enum(SKILLS)).default([]),
  languages: z.array(z.string().max(30)).default([]),
  /** 0 = Sunday … 6 = Saturday */
  availableDays: z.array(z.number().int().min(0).max(6)).default([]),
  availableSlots: z.array(z.enum(TIME_SLOTS)).default([]),
  hoursLog: z
    .array(z.object({ id: id(), date: isoDate(), hours: z.number().min(0).max(24), eventId: z.string().default(""), note: z.string().max(200).default("") }))
    .default([]),
  notes: z.string().max(1000).default(""),
  active: z.boolean().default(true),
  createdAt: z.string(),
});
export type Volunteer = z.infer<typeof VolunteerSchema>;

// ---------- Field notes ----------
/** Structured note — the AI "Organise" output and the manual template share this shape. */
export const OrganisedNoteSchema = z.object({
  summary: z.string().max(1500),
  needsIdentified: z.array(z.object({ category: z.string().max(40), description: z.string().max(300) })).max(20),
  actionsTaken: z.array(z.string().max(300)).max(20),
  followUps: z
    .array(
      z.object({
        task: z.string().max(200),
        suggestedDueInDays: z.number().int().min(0).max(365).optional(),
        owner: z.string().max(80).optional(),
      }),
    )
    .max(20),
  referralsMentioned: z.array(z.string().max(200)).max(20),
  language: z.string().max(10),
});
export type OrganisedNote = z.infer<typeof OrganisedNoteSchema>;

export const NoteTemplateSchema = z.object({
  saw: z.string().max(4000).default(""),
  needs: z.string().max(4000).default(""),
  actions: z.string().max(4000).default(""),
  nextSteps: z.string().max(4000).default(""),
});
export type NoteTemplate = z.infer<typeof NoteTemplateSchema>;

const NoteVersion = z.object({
  savedAt: z.string(),
  text: z.string(),
  template: NoteTemplateSchema.optional(),
  organised: OrganisedNoteSchema.nullable().optional(),
});

export const FieldNoteSchema = z.object({
  id: id(),
  /** "" = general visit (no case). */
  caseId: z.string().default(""),
  date: isoDate(),
  time: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).default(""),
  place: z.string().max(120).default(""),
  text: z.string().max(20_000).default(""),
  template: NoteTemplateSchema.default({ saw: "", needs: "", actions: "", nextSteps: "" }),
  organised: OrganisedNoteSchema.nullable().default(null),
  /** Earlier versions — edits never overwrite history. */
  history: z.array(NoteVersion).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FieldNote = z.infer<typeof FieldNoteSchema>;

// ---------- Events & shifts ----------
const hhmm = () => z.string().regex(/^\d{2}:\d{2}$/);

export const ShiftSchema = z.object({
  id: id(),
  role: z.string().trim().min(1).max(80),
  requiredSkills: z.array(z.enum(SKILLS)).default([]),
  slot: z.enum(TIME_SLOTS),
  start: hhmm(),
  end: hhmm(),
  required: z.number().int().min(1).max(100),
});
export type Shift = z.infer<typeof ShiftSchema>;

export const AssignmentSchema = z.object({ shiftId: z.string(), volunteerId: z.string() });
export type Assignment = z.infer<typeof AssignmentSchema>;

export const EventSchema = z.object({
  id: id(),
  title: z.string().trim().min(1).max(120),
  date: isoDate(),
  location: z.string().max(200).default(""),
  mapUrl: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  campId: z.string().default(""),
  shifts: z.array(ShiftSchema).default([]),
  assignments: z.array(AssignmentSchema).default([]),
  hoursLogged: z.boolean().default(false),
  createdAt: z.string(),
});
export type SevaEvent = z.infer<typeof EventSchema>;

// ---------- Camps & drives ----------
export const STAGES = ["T-30", "T-14", "T-7", "T-1", "day", "after"] as const;
export type Stage = (typeof STAGES)[number];

export const SupplyItemSchema = z.object({
  id: id(),
  item: z.string().trim().min(1).max(80),
  unit: z.string().max(20).default(""),
  perPerson: z.number().min(0).max(10_000),
  bufferPct: z.number().min(0).max(500).default(10),
  /** Manual total that replaces the calculated one. */
  override: z.number().min(0).nullable().default(null),
});
export type SupplyItem = z.infer<typeof SupplyItemSchema>;

export const BudgetLineSchema = z.object({
  id: id(),
  item: z.string().trim().min(1).max(80),
  planned: z.number().min(0).default(0),
  actual: z.number().min(0).default(0),
});
export type BudgetLine = z.infer<typeof BudgetLineSchema>;

export const SponsorSchema = z.object({
  id: id(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["cash", "inKind"]),
  amount: z.number().min(0).default(0),
  description: z.string().max(200).default(""),
});
export type Sponsor = z.infer<typeof SponsorSchema>;

export const AfterEventSchema = z.object({
  peopleServed: z.number().int().min(0).default(0),
  volunteers: z.number().int().min(0).default(0),
  unitsCollected: z.number().int().min(0).default(0),
  itemsDistributed: z.number().int().min(0).default(0),
  highlights: z.string().max(2000).default(""),
  /** Category used for "people reached by category" in the impact dashboard. */
  category: z.enum(CASE_CATEGORIES).default("other"),
  completedAt: z.string(),
});
export type AfterEvent = z.infer<typeof AfterEventSchema>;

export const CampSchema = z.object({
  id: id(),
  templateId: z.string(),
  title: z.string().trim().min(1).max(120),
  date: isoDate(),
  location: z.string().max(200).default(""),
  area: z.string().max(80).default(""),
  expectedBeneficiaries: z.number().int().min(0).max(1_000_000).default(100),
  checklist: z
    .array(z.object({ id: id(), stage: z.enum(STAGES), text: z.string().max(300), done: z.boolean().default(false), permission: z.boolean().default(false) }))
    .default([]),
  supplies: z.array(SupplyItemSchema).default([]),
  budget: z.array(BudgetLineSchema).default([]),
  sponsors: z.array(SponsorSchema).default([]),
  schedule: z.array(z.object({ id: id(), time: z.string().max(5), activity: z.string().max(200), owner: z.string().max(80).default("") })).default([]),
  emergencyResourceIds: z.array(z.string()).default([]),
  eventId: z.string().default(""),
  afterEvent: AfterEventSchema.nullable().default(null),
  notes: z.string().max(4000).default(""),
  createdAt: z.string(),
});
export type Camp = z.infer<typeof CampSchema>;

// ---------- Resource directory ----------
export const RESOURCE_CATEGORIES = ["hospital", "bloodBank", "government", "helpline", "school", "shelter", "ngo", "police", "other"] as const;

export const ResourceSchema = z.object({
  id: id(),
  name: z.string().trim().min(1).max(120),
  category: z.enum(RESOURCE_CATEGORIES),
  area: z.string().max(80).default(""),
  phone: z.string().max(30).default(""),
  hours: z.string().max(80).default(""),
  notes: z.string().max(1000).default(""),
  emergency: z.boolean().default(false),
  /** Seeded examples must be verified by the user before use. */
  needsVerification: z.boolean().default(false),
  createdAt: z.string(),
});
export type Resource = z.infer<typeof ResourceSchema>;

// ---------- Donations (simple register — not an accounting or tax system) ----------
export const DonationSchema = z.object({
  id: id(),
  date: isoDate(),
  donor: z.string().max(120).default(""),
  anonymous: z.boolean().default(false),
  type: z.enum(["cash", "inKind"]),
  amount: z.number().min(0).default(0),
  items: z.string().max(300).default(""),
  purpose: z.string().max(300).default(""),
  campId: z.string().default(""),
  createdAt: z.string(),
});
export type Donation = z.infer<typeof DonationSchema>;

// ---------- Media archive ----------
export const MEDIA_TYPES = ["print", "tv", "online", "radio"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MediaItemSchema = z.object({
  id: id(),
  outlet: z.string().trim().min(1).max(120),
  type: z.enum(MEDIA_TYPES),
  language: z.string().max(30).default(""),
  date: isoDate(),
  headline: z.string().trim().min(1).max(300),
  link: z
    .string()
    .max(1000)
    .refine((s) => s === "" || /^https?:\/\//.test(s), "http(s) link")
    .default(""),
  /** Compressed clipping photo as a data URL — stored encrypted like everything else. */
  clipping: z.string().max(700_000).default(""),
  tags: z.array(z.string().max(40)).default([]),
  campId: z.string().default(""),
  featured: z.boolean().default(false),
  notes: z.string().max(1000).default(""),
  createdAt: z.string(),
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

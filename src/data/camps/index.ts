// Camp & drive templates. Everything is editable after a camp is created.
// Permission/partner items are always labelled "check local requirements" — the app
// makes no legal claims about what is required where.

import type { CaseCategory, Skill, Stage, TimeSlot } from "@/types/models";

export interface ChecklistTemplate {
  stage: Stage;
  en: string;
  ta: string;
  permission?: boolean;
}

export interface CampTemplate {
  id: string;
  icon: string;
  name: { en: string; ta: string };
  category: CaseCategory;
  checklist: ChecklistTemplate[];
  roles: Array<{ role: string; slot: TimeSlot; start: string; end: string; required: number; skills?: Skill[] }>;
  supplies: Array<{ item: string; unit: string; perPerson: number; bufferPct: number }>;
  schedule: Array<{ time: string; activity: string }>;
}

const perm = (stage: Stage, en: string, ta: string): ChecklistTemplate => ({
  stage,
  en: `${en} — check local requirements`,
  ta: `${ta} — உள்ளூர் விதிமுறைகளைச் சரிபார்க்கவும்`,
  permission: true,
});

const common = {
  venue: { stage: "T-30", en: "Confirm venue, date and timing", ta: "இடம், தேதி, நேரத்தை உறுதிசெய்யவும்" },
  volunteers: { stage: "T-14", en: "Recruit volunteers and assign roles", ta: "தன்னார்வலர்களைச் சேர்த்து பணிகளை ஒதுக்கவும்" },
  publicity: { stage: "T-7", en: "Share publicity (WhatsApp, posters, announcements)", ta: "விளம்பரம் (வாட்ஸ்அப், சுவரொட்டி, அறிவிப்பு) பகிரவும்" },
  remind: { stage: "T-1", en: "Send reminders to volunteers and partners", ta: "தன்னார்வலர்கள், கூட்டாளர்களுக்கு நினைவூட்டல் அனுப்பவும்" },
  setup: { stage: "day", en: "Set up registration desk, signage and drinking water", ta: "பதிவு மேசை, அறிவிப்புப் பலகை, குடிநீர் ஏற்பாடு" },
  thanks: { stage: "after", en: "Record actual numbers and thank volunteers & sponsors", ta: "உண்மையான எண்ணிக்கைகளைப் பதிவு செய்து தன்னார்வலர்கள், நன்கொடையாளர்களுக்கு நன்றி கூறவும்" },
} satisfies Record<string, ChecklistTemplate>;

export const CAMP_TEMPLATES: CampTemplate[] = [
  {
    id: "blood",
    icon: "🩸",
    name: { en: "Blood donation camp", ta: "இரத்த தான முகாம்" },
    category: "health",
    checklist: [
      common.venue,
      perm("T-30", "Partner with a licensed blood bank", "உரிமம் பெற்ற இரத்த வங்கியுடன் கூட்டு"),
      perm("T-14", "Venue permission and any required approvals", "இட அனுமதி மற்றும் தேவையான ஒப்புதல்கள்"),
      common.volunteers,
      { stage: "T-7", en: "Pre-register donors; share eligibility guidance from the blood bank", ta: "நன்கொடையாளர் முன்பதிவு; இரத்த வங்கியின் தகுதி வழிகாட்டலைப் பகிரவும்" },
      common.publicity,
      common.remind,
      common.setup,
      { stage: "day", en: "Refreshment area for donors after donation", ta: "தானம் செய்தவர்களுக்கு சிற்றுண்டிப் பகுதி" },
      common.thanks,
    ],
    roles: [
      { role: "Registration", slot: "morning", start: "08:00", end: "12:00", required: 2, skills: ["dataEntry"] },
      { role: "Donor care / first aid", slot: "morning", start: "08:00", end: "12:00", required: 2, skills: ["firstAid"] },
      { role: "Refreshments", slot: "morning", start: "08:30", end: "12:30", required: 2 },
      { role: "Registration (afternoon)", slot: "afternoon", start: "12:00", end: "15:00", required: 1, skills: ["dataEntry"] },
      { role: "Crowd guidance", slot: "afternoon", start: "12:00", end: "15:00", required: 2 },
    ],
    supplies: [
      { item: "Juice packs", unit: "packs", perPerson: 1, bufferPct: 20 },
      { item: "Biscuit packets", unit: "packets", perPerson: 1, bufferPct: 20 },
      { item: "Donor certificates", unit: "sheets", perPerson: 1, bufferPct: 10 },
      { item: "Drinking water", unit: "litres", perPerson: 0.5, bufferPct: 25 },
    ],
    schedule: [
      { time: "07:30", activity: "Volunteers arrive; set up" },
      { time: "08:30", activity: "Registration opens" },
      { time: "09:00", activity: "Donation begins (blood bank team)" },
      { time: "14:30", activity: "Last registration" },
      { time: "15:30", activity: "Wrap up; count donors" },
    ],
  },
  {
    id: "medical",
    icon: "🩺",
    name: { en: "Medical / eye camp", ta: "மருத்துவ / கண் முகாம்" },
    category: "health",
    checklist: [
      common.venue,
      perm("T-30", "Partner hospital / doctors confirmed", "கூட்டு மருத்துவமனை / மருத்துவர்கள் உறுதி"),
      perm("T-14", "Venue permission and medicine handling arrangements", "இட அனுமதி மற்றும் மருந்து கையாளும் ஏற்பாடு"),
      common.volunteers,
      { stage: "T-7", en: "Arrange queue system and token slips", ta: "வரிசை முறை மற்றும் டோக்கன் சீட்டுகள் ஏற்பாடு" },
      common.publicity,
      common.remind,
      common.setup,
      { stage: "after", en: "Follow up on referrals (e.g. surgery, spectacles)", ta: "பரிந்துரைகளைத் தொடரவும் (எ.கா. அறுவை, கண்ணாடி)" },
      common.thanks,
    ],
    roles: [
      { role: "Registration & tokens", slot: "morning", start: "08:00", end: "13:00", required: 2, skills: ["dataEntry"] },
      { role: "Queue management", slot: "morning", start: "08:00", end: "13:00", required: 3 },
      { role: "Doctor assistant", slot: "morning", start: "09:00", end: "13:00", required: 2, skills: ["medical"] },
      { role: "Translation help", slot: "morning", start: "09:00", end: "13:00", required: 1, skills: ["translation"] },
    ],
    supplies: [
      { item: "Token slips", unit: "slips", perPerson: 1, bufferPct: 20 },
      { item: "Patient record forms", unit: "forms", perPerson: 1, bufferPct: 15 },
      { item: "Drinking water", unit: "litres", perPerson: 0.5, bufferPct: 25 },
      { item: "Chairs", unit: "chairs", perPerson: 0.2, bufferPct: 10 },
    ],
    schedule: [
      { time: "07:30", activity: "Set up stations" },
      { time: "08:30", activity: "Registration opens" },
      { time: "09:00", activity: "Consultations begin" },
      { time: "13:00", activity: "Close; compile referral list" },
    ],
  },
  {
    id: "ration",
    icon: "🍚",
    name: { en: "Relief & ration distribution", ta: "நிவாரண & ரேஷன் விநியோகம்" },
    category: "relief",
    checklist: [
      common.venue,
      { stage: "T-30", en: "Identify families with community leaders (minimum data)", ta: "சமூகத் தலைவர்களுடன் குடும்பங்களை அடையாளம் காணவும் (குறைந்தபட்ச தரவு)" },
      perm("T-14", "Local body / venue permission", "உள்ளாட்சி / இட அனுமதி"),
      { stage: "T-14", en: "Procure and pack kits", ta: "பொருட்களை வாங்கி பைகளில் அடைக்கவும்" },
      common.volunteers,
      { stage: "T-7", en: "Issue token slips so distribution is orderly and dignified", ta: "ஒழுங்கான, கண்ணியமான விநியோகத்திற்கு டோக்கன் வழங்கவும்" },
      common.remind,
      common.setup,
      { stage: "day", en: "No photos of recipients without consent", ta: "ஒப்புதல் இல்லாமல் பயனாளிகளைப் புகைப்படம் எடுக்க வேண்டாம்" },
      common.thanks,
    ],
    roles: [
      { role: "Token check", slot: "morning", start: "08:00", end: "12:00", required: 2 },
      { role: "Kit handover", slot: "morning", start: "08:00", end: "12:00", required: 4 },
      { role: "Transport", slot: "morning", start: "07:00", end: "09:00", required: 1, skills: ["driving"] },
      { role: "Stock register", slot: "morning", start: "08:00", end: "12:00", required: 1, skills: ["dataEntry"] },
    ],
    supplies: [
      { item: "Rice", unit: "kg", perPerson: 5, bufferPct: 5 },
      { item: "Dal", unit: "kg", perPerson: 1, bufferPct: 5 },
      { item: "Cooking oil", unit: "litres", perPerson: 1, bufferPct: 5 },
      { item: "Carry bags", unit: "bags", perPerson: 1, bufferPct: 10 },
    ],
    schedule: [
      { time: "07:00", activity: "Kits loaded and transported" },
      { time: "08:00", activity: "Distribution starts (token order)" },
      { time: "12:00", activity: "Close; reconcile stock" },
    ],
  },
  {
    id: "flood",
    icon: "🌊",
    name: { en: "Flood / disaster relief collection", ta: "வெள்ள / பேரிடர் நிவாரண சேகரிப்பு" },
    category: "relief",
    checklist: [
      { stage: "T-7", en: "List urgently needed items with local relief coordinators", ta: "உள்ளூர் நிவாரண ஒருங்கிணைப்பாளர்களுடன் அவசரத் தேவைப் பட்டியல்" },
      perm("T-7", "Coordinate with local authorities on where and how to deliver", "எங்கு, எப்படி வழங்குவது என்பதை உள்ளூர் அதிகாரிகளுடன் ஒருங்கிணைக்கவும்"),
      { stage: "T-7", en: "Set up collection points and timings", ta: "சேகரிப்பு இடங்கள், நேரங்களை அமைக்கவும்" },
      common.publicity,
      { stage: "day", en: "Sort, label and pack items by type", ta: "பொருட்களை வகைப்படி பிரித்து, லேபிள் இட்டு அடைக்கவும்" },
      { stage: "day", en: "Keep a simple register of items received", ta: "பெற்ற பொருட்களின் எளிய பதிவேடு" },
      { stage: "after", en: "Arrange transport and record handover", ta: "போக்குவரத்து ஏற்பாடு; ஒப்படைப்பைப் பதிவு செய்யவும்" },
      common.thanks,
    ],
    roles: [
      { role: "Collection desk", slot: "morning", start: "09:00", end: "13:00", required: 2, skills: ["dataEntry"] },
      { role: "Sorting & packing", slot: "afternoon", start: "13:00", end: "17:00", required: 4 },
      { role: "Driver", slot: "evening", start: "17:00", end: "20:00", required: 1, skills: ["driving"] },
    ],
    supplies: [
      { item: "Cartons", unit: "boxes", perPerson: 0.2, bufferPct: 20 },
      { item: "Packing tape", unit: "rolls", perPerson: 0.02, bufferPct: 50 },
      { item: "Labels", unit: "sheets", perPerson: 0.2, bufferPct: 20 },
    ],
    schedule: [
      { time: "09:00", activity: "Collection opens" },
      { time: "13:00", activity: "Sorting begins" },
      { time: "17:00", activity: "Load vehicle" },
    ],
  },
  {
    id: "schoolkit",
    icon: "🎒",
    name: { en: "School kit distribution", ta: "பள்ளிப் பொருட்கள் விநியோகம்" },
    category: "education",
    checklist: [
      common.venue,
      perm("T-30", "School / headmaster permission", "பள்ளி / தலைமையாசிரியர் அனுமதி"),
      { stage: "T-14", en: "Get class-wise student counts (numbers only)", ta: "வகுப்பு வாரியாக மாணவர் எண்ணிக்கை (எண்கள் மட்டும்)" },
      { stage: "T-14", en: "Procure and pack kits by class", ta: "வகுப்பு வாரியாகப் பொருட்களை வாங்கி அடைக்கவும்" },
      common.volunteers,
      common.remind,
      { stage: "day", en: "Distribute class by class with teachers", ta: "ஆசிரியர்களுடன் வகுப்பு வாரியாக விநியோகம்" },
      { stage: "day", en: "Photos only with school's and parents' consent", ta: "பள்ளி மற்றும் பெற்றோர் ஒப்புதலுடன் மட்டுமே புகைப்படம்" },
      common.thanks,
    ],
    roles: [
      { role: "Kit handover", slot: "morning", start: "09:30", end: "12:30", required: 4 },
      { role: "Count & register", slot: "morning", start: "09:30", end: "12:30", required: 1, skills: ["dataEntry"] },
      { role: "Photography (with consent)", slot: "morning", start: "10:00", end: "12:00", required: 1, skills: ["photography"] },
    ],
    supplies: [
      { item: "School bags", unit: "bags", perPerson: 1, bufferPct: 5 },
      { item: "Notebooks", unit: "books", perPerson: 6, bufferPct: 5 },
      { item: "Pencil box sets", unit: "sets", perPerson: 1, bufferPct: 5 },
    ],
    schedule: [
      { time: "09:00", activity: "Arrive; meet headmaster" },
      { time: "09:30", activity: "Distribution by class" },
      { time: "12:30", activity: "Wrap up" },
    ],
  },
  {
    id: "rally",
    icon: "📣",
    name: { en: "Awareness rally / street play", ta: "விழிப்புணர்வுப் பேரணி / தெருக்கூத்து" },
    category: "other",
    checklist: [
      { stage: "T-30", en: "Choose topic and key messages", ta: "தலைப்பு மற்றும் முக்கியச் செய்திகளைத் தேர்ந்தெடுக்கவும்" },
      perm("T-14", "Route / public-space permission", "பாதை / பொது இட அனுமதி"),
      { stage: "T-14", en: "Rehearse the play; prepare placards", ta: "நாடக ஒத்திகை; பதாகைகள் தயாரிப்பு" },
      common.volunteers,
      common.publicity,
      common.remind,
      { stage: "day", en: "First-aid kit and drinking water along the route", ta: "பாதையில் முதலுதவிப் பெட்டி மற்றும் குடிநீர்" },
      common.thanks,
    ],
    roles: [
      { role: "Performers", slot: "morning", start: "08:00", end: "11:00", required: 6 },
      { role: "Route marshal", slot: "morning", start: "08:00", end: "11:00", required: 2 },
      { role: "First aid", slot: "morning", start: "08:00", end: "11:00", required: 1, skills: ["firstAid"] },
    ],
    supplies: [
      { item: "Placards", unit: "pcs", perPerson: 0.1, bufferPct: 10 },
      { item: "Pamphlets", unit: "pcs", perPerson: 1, bufferPct: 20 },
      { item: "Drinking water", unit: "litres", perPerson: 0.05, bufferPct: 20 },
    ],
    schedule: [
      { time: "07:30", activity: "Assemble; briefing" },
      { time: "08:00", activity: "Rally starts" },
      { time: "09:30", activity: "Street play at main junction" },
      { time: "11:00", activity: "Close" },
    ],
  },
  {
    id: "trees",
    icon: "🌳",
    name: { en: "Tree plantation", ta: "மரம் நடுதல்" },
    category: "other",
    checklist: [
      perm("T-30", "Land owner / local body permission for the site", "நிலம் / உள்ளாட்சி அனுமதி"),
      { stage: "T-14", en: "Arrange saplings suited to the local area", ta: "உள்ளூருக்கு ஏற்ற மரக்கன்றுகள் ஏற்பாடு" },
      { stage: "T-7", en: "Dig pits; arrange water source", ta: "குழிகள் தோண்டுதல்; நீர் ஆதாரம்" },
      common.volunteers,
      common.remind,
      { stage: "day", en: "Plant, water and tag saplings", ta: "நட்டு, நீர் ஊற்றி, குறியிடவும்" },
      { stage: "after", en: "Plan watering rota for the next months", ta: "அடுத்த மாதங்களுக்கு நீர் ஊற்றும் அட்டவணை" },
      common.thanks,
    ],
    roles: [
      { role: "Planting team", slot: "morning", start: "07:00", end: "10:00", required: 6 },
      { role: "Watering", slot: "morning", start: "07:00", end: "10:00", required: 2 },
      { role: "Transport", slot: "morning", start: "06:30", end: "08:00", required: 1, skills: ["driving"] },
    ],
    supplies: [
      { item: "Saplings", unit: "saplings", perPerson: 1, bufferPct: 10 },
      { item: "Tree guards", unit: "guards", perPerson: 1, bufferPct: 5 },
      { item: "Manure", unit: "kg", perPerson: 2, bufferPct: 10 },
    ],
    schedule: [
      { time: "06:30", activity: "Load saplings" },
      { time: "07:00", activity: "Planting begins" },
      { time: "10:00", activity: "Close" },
    ],
  },
  {
    id: "elder",
    icon: "🧓",
    name: { en: "Elder-care visit day", ta: "முதியோர் பராமரிப்பு வருகை நாள்" },
    category: "elderCare",
    checklist: [
      perm("T-14", "Home / centre permission and visiting rules", "இல்லம் / மைய அனுமதி மற்றும் வருகை விதிகள்"),
      { stage: "T-14", en: "Plan activities (music, games, health check with partner)", ta: "செயல்பாடுகள் (இசை, விளையாட்டு, கூட்டாளர் உடல்நலப் பரிசோதனை)" },
      common.volunteers,
      { stage: "T-7", en: "Brief volunteers on respectful, patient interaction", ta: "மரியாதையான, பொறுமையான உரையாடல் குறித்து தன்னார்வலர்களுக்கு விளக்கம்" },
      common.remind,
      { stage: "day", en: "No photos of residents without consent", ta: "ஒப்புதல் இல்லாமல் குடியிருப்போரைப் புகைப்படம் எடுக்க வேண்டாம்" },
      common.thanks,
    ],
    roles: [
      { role: "Companionship", slot: "morning", start: "10:00", end: "12:30", required: 4 },
      { role: "Activities lead", slot: "morning", start: "10:00", end: "12:30", required: 1 },
      { role: "Lunch serving", slot: "afternoon", start: "12:30", end: "14:00", required: 2, skills: ["cooking"] },
    ],
    supplies: [
      { item: "Fruit", unit: "kg", perPerson: 0.25, bufferPct: 10 },
      { item: "Lunch packs", unit: "packs", perPerson: 1, bufferPct: 10 },
    ],
    schedule: [
      { time: "10:00", activity: "Arrive; greet residents" },
      { time: "10:30", activity: "Activities" },
      { time: "12:30", activity: "Lunch" },
    ],
  },
  {
    id: "hygiene",
    icon: "🧼",
    name: { en: "Health & hygiene workshop", ta: "உடல்நலம் & சுகாதாரப் பயிலரங்கு" },
    category: "health",
    checklist: [
      common.venue,
      perm("T-14", "Venue / school / community hall permission", "இட / பள்ளி / சமுதாயக் கூட அனுமதி"),
      { stage: "T-14", en: "Prepare session plan and demo materials", ta: "அமர்வுத் திட்டம் மற்றும் செய்முறைப் பொருட்கள்" },
      common.volunteers,
      common.publicity,
      common.remind,
      common.setup,
      common.thanks,
    ],
    roles: [
      { role: "Facilitator", slot: "morning", start: "10:00", end: "12:00", required: 1, skills: ["teaching"] },
      { role: "Demo helpers", slot: "morning", start: "10:00", end: "12:00", required: 2 },
      { role: "Registration", slot: "morning", start: "09:30", end: "12:00", required: 1, skills: ["dataEntry"] },
    ],
    supplies: [
      { item: "Soap bars", unit: "bars", perPerson: 1, bufferPct: 10 },
      { item: "Sanitary kits", unit: "kits", perPerson: 0.5, bufferPct: 10 },
      { item: "Pamphlets", unit: "pcs", perPerson: 1, bufferPct: 15 },
    ],
    schedule: [
      { time: "09:30", activity: "Registration" },
      { time: "10:00", activity: "Session & demonstrations" },
      { time: "11:30", activity: "Q&A; kit distribution" },
    ],
  },
  {
    id: "custom",
    icon: "✨",
    name: { en: "Custom", ta: "தனிப்பயன்" },
    category: "other",
    checklist: [common.venue, common.volunteers, common.publicity, common.remind, common.setup, common.thanks],
    roles: [],
    supplies: [],
    schedule: [],
  },
];

export const templateById = (id: string) => CAMP_TEMPLATES.find((t) => t.id === id);

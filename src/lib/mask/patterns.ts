// Security-critical: identity patterns shared by the browser masker and the server
// payload guard, so both always agree on what counts as an identifier.
// All regexes are global; callers must reset lastIndex or use String.replace/matchAll.

/** Emails. */
export const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * 12-digit Aadhaar-like numbers (4-4-4 with optional space/dash). Run BEFORE phones,
 * otherwise the first 10 digits could be taken as a phone number.
 */
export const AADHAAR_LIKE = /(?<![\d\w+])\d{4}[ -]?\d{4}[ -]?\d{4}(?![\d\w])/g;

/** PAN (ABCDE1234F) and Voter-ID-like (ABC1234567) codes. */
export const ALNUM_ID = /\b(?:[A-Z]{5}\d{4}[A-Z]|[A-Z]{3}\d{7})\b/g;

/** Indian mobile numbers: optional +91 / 91 / 0, then 10 digits starting 6–9, single space/dash separators allowed. */
export const MOBILE = /(?<![\d\w+])(?:\+91[ -]?|91[ -]|0)?[6-9](?:[ -]?\d){9}(?![\d\w])/g;

/** Landlines with STD code: 044-2345 6789, 0422 2345678. */
export const LANDLINE = /(?<![\d\w])0\d{2,4}[ -]\d{3,4}[ -]?\d{3,4}(?![\d\w])/g;

/** Any other long digit run (ration card, bank account…): 9+ digits. */
export const LONG_NUMBER = /(?<![\d\w])\d{9,18}(?![\d\w])/g;

/** PIN codes in address context: "PIN 600042", "Pincode: 600 042", "Chennai - 600042". */
export const PIN_CODE =
  /(?:\b(?:pin\s*(?:code)?|pincode)\s*[:\-]?\s*|(?<=\b[A-Z][a-z]+\s*[-,]\s*))[1-9]\d{2}\s?\d{3}(?!\d)/gi;

const MONTHS = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE = `(?:\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\.?,?\\s+\\d{4}|(?:${MONTHS})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4})`;

/** Dates of birth: a date that follows a DOB keyword. Group 1 = keyword part, group 2 = the date. */
export const DOB = new RegExp(
  `(\\b(?:d\\.?o\\.?b\\.?|date\\s+of\\s+birth|born(?:\\s+on)?)\\s*[:\\-]?\\s*|பிறந்த\\s*(?:தேதி)?\\s*[:\\-]?\\s*)(${DATE})`,
  "gi",
);

const STREET_WORDS =
  "street|st\\.|road|rd\\.|nagar|salai|lane|colony|cross\\s+street|main\\s+road|theru|avenue|layout|block|extension|garden|puram|pettai|தெரு|சாலை|நகர்";

/** House/door numbers followed by a street-like word, or "Door No. 12/4" style prefixes. */
export const ADDRESS = new RegExp(
  `(?:\\b(?:door|house|flat|plot|h)\\.?\\s*no\\.?\\s*[:\\-]?\\s*[\\w/-]+\\s*,?\\s*(?:[\\p{L}.]+\\s+){0,3}(?:${STREET_WORDS})|(?<![\\w/])\\d+[A-Za-z]?(?:/\\d+[A-Za-z]?)?\\s*,?\\s+(?:[\\p{L}.]+\\s+){0,3}(?:${STREET_WORDS})|\\b(?:door|house|flat|plot)\\s*no\\.?\\s*[:\\-]?\\s*[\\w/-]+)`,
  "giu",
);

/** Honorifics that are usually followed by a person's name. */
export const HONORIFIC =
  /\b(Mr|Mrs|Ms|Miss|Dr|Smt|Shri|Sri|Thiru|Thirumathi|Tmt|Selvi|Kumari|Master|Selvan)\.?\s+((?:[A-Z][a-z]+)(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)*)/g;

/** Masking tokens look like {{PERSON_1}}. */
export const TOKEN = /\{\{\s*([A-Z]+_\d+)\s*\}\}/g;

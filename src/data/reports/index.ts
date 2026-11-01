// Report templates used WITHOUT AI (and as the structure the AI fills in).
// {placeholders} are filled by code with the user's own numbers.

export type ReportKind = "monthly" | "quarterly" | "annual" | "event" | "donorThanks" | "grantOutline";

type Tpl = { title: string; sections: Array<{ heading: string; body: string }> };

export const REPORT_TEMPLATES: Record<ReportKind, { en: Tpl; ta: Tpl }> = {
  monthly: {
    en: {
      title: "{org} — Impact report, {period}",
      sections: [
        { heading: "Overview", body: "During {period}, our team opened {casesOpened} new cases, closed {casesClosed} and completed {followUpsDone} follow-ups." },
        { heading: "Camps & drives", body: "We held {campsHeld} camps/drives, serving {peopleServedAtCamps} people." },
        { heading: "Volunteers", body: "{activeVolunteers} volunteers gave {volunteerHours} hours of service." },
        { heading: "Support received", body: "Cash donations received: ₹{donationsCash}. In-kind contributions: {donationsInKind}." },
        { heading: "Highlights", body: "{highlights}" },
      ],
    },
    ta: {
      title: "{org} — தாக்க அறிக்கை, {period}",
      sections: [
        { heading: "மேலோட்டம்", body: "{period} காலத்தில் எங்கள் குழு {casesOpened} புதிய வழக்குகளைத் தொடங்கி, {casesClosed} வழக்குகளை முடித்து, {followUpsDone} தொடர் நடவடிக்கைகளை நிறைவு செய்தது." },
        { heading: "முகாம்கள் & இயக்கங்கள்", body: "{campsHeld} முகாம்கள் நடத்தப்பட்டு {peopleServedAtCamps} பேர் பயன்பெற்றனர்." },
        { heading: "தன்னார்வலர்கள்", body: "{activeVolunteers} தன்னார்வலர்கள் {volunteerHours} மணிநேர சேவை அளித்தனர்." },
        { heading: "பெற்ற ஆதரவு", body: "பண நன்கொடை: ₹{donationsCash}. பொருள் பங்களிப்புகள்: {donationsInKind}." },
        { heading: "சிறப்பம்சங்கள்", body: "{highlights}" },
      ],
    },
  },
  quarterly: { en: { title: "", sections: [] }, ta: { title: "", sections: [] } },
  annual: { en: { title: "", sections: [] }, ta: { title: "", sections: [] } },
  event: {
    en: {
      title: "{eventTitle} — Event report",
      sections: [
        { heading: "About the event", body: "{org} organised {eventTitle} on {eventDate} at {eventLocation}." },
        { heading: "Reach", body: "People served: {peopleServed}. Volunteers: {volunteers}. Units collected: {unitsCollected}. Items distributed: {itemsDistributed}." },
        { heading: "Highlights", body: "{highlights}" },
        { heading: "Thanks", body: "We thank every volunteer, partner and supporter who made this possible." },
      ],
    },
    ta: {
      title: "{eventTitle} — நிகழ்வு அறிக்கை",
      sections: [
        { heading: "நிகழ்வு பற்றி", body: "{org} {eventDate} அன்று {eventLocation} இல் {eventTitle} நிகழ்வை நடத்தியது." },
        { heading: "சென்றடைந்தோர்", body: "பயன்பெற்றோர்: {peopleServed}. தன்னார்வலர்கள்: {volunteers}. சேகரித்த அலகுகள்: {unitsCollected}. விநியோகித்த பொருட்கள்: {itemsDistributed}." },
        { heading: "சிறப்பம்சங்கள்", body: "{highlights}" },
        { heading: "நன்றி", body: "இதைச் சாத்தியமாக்கிய ஒவ்வொரு தன்னார்வலர், கூட்டாளர், ஆதரவாளருக்கும் நன்றி." },
      ],
    },
  },
  donorThanks: {
    en: {
      title: "Thank you from {org}",
      sections: [
        { heading: "Dear friend", body: "Thank you for standing with us. In {period}, your support helped us reach {peopleReached} people, hold {campsHeld} camps and complete {followUpsDone} follow-ups." },
        { heading: "With gratitude", body: "{highlights}\n\nWith warm regards,\n{org}" },
      ],
    },
    ta: {
      title: "{org} இன் நன்றி",
      sections: [
        { heading: "அன்புள்ள நண்பரே", body: "எங்களுடன் துணை நின்றதற்கு நன்றி. {period} காலத்தில் உங்கள் ஆதரவால் {peopleReached} பேரைச் சென்றடைந்தோம், {campsHeld} முகாம்கள் நடத்தினோம், {followUpsDone} தொடர் நடவடிக்கைகளை முடித்தோம்." },
        { heading: "நன்றியுடன்", body: "{highlights}\n\nஅன்புடன்,\n{org}" },
      ],
    },
  },
  grantOutline: {
    en: {
      title: "{org} — Proposal outline",
      sections: [
        { heading: "Need", body: "[Describe the need in your area in your own words.]" },
        { heading: "Activities", body: "In {period} we held {campsHeld} camps/drives and supported {casesOpened} new cases." },
        { heading: "Reach", body: "People reached: {peopleReached}. Volunteer hours: {volunteerHours}." },
        { heading: "Outcomes", body: "Cases closed: {casesClosed}. Follow-ups completed: {followUpsDone}.\n{highlights}" },
        { heading: "Budget", body: "See the budget table below (filled from your camp budgets)." },
      ],
    },
    ta: {
      title: "{org} — முன்மொழிவு வரைவு",
      sections: [
        { heading: "தேவை", body: "[உங்கள் பகுதியின் தேவையை உங்கள் சொற்களில் விவரிக்கவும்.]" },
        { heading: "செயல்பாடுகள்", body: "{period} காலத்தில் {campsHeld} முகாம்கள் நடத்தி {casesOpened} புதிய வழக்குகளுக்கு ஆதரவளித்தோம்." },
        { heading: "சென்றடைந்தோர்", body: "சென்றடைந்தோர்: {peopleReached}. தன்னார்வல மணிநேரம்: {volunteerHours}." },
        { heading: "விளைவுகள்", body: "முடிந்த வழக்குகள்: {casesClosed}. நிறைவான தொடர் நடவடிக்கைகள்: {followUpsDone}.\n{highlights}" },
        { heading: "வரவுசெலவு", body: "கீழே உள்ள வரவுசெலவு அட்டவணையைப் பார்க்கவும் (உங்கள் முகாம் வரவுசெலவிலிருந்து நிரப்பப்பட்டது)." },
      ],
    },
  },
};
// Quarterly and annual reports share the monthly structure.
REPORT_TEMPLATES.quarterly = REPORT_TEMPLATES.monthly;
REPORT_TEMPLATES.annual = REPORT_TEMPLATES.monthly;

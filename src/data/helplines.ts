// Example NATIONAL helplines only (no local numbers). They are added only when the user
// asks, always flagged `needsVerification`, and the UI says:
// "Verify this number on the official website before use."
export const EXAMPLE_HELPLINES = [
  { name: "Emergency Response Support System (example)", phone: "112", category: "helpline", emergency: true },
  { name: "Ambulance (example)", phone: "108", category: "hospital", emergency: true },
  { name: "Childline (example)", phone: "1098", category: "helpline", emergency: true },
  { name: "Women Helpline (example)", phone: "181", category: "helpline", emergency: false },
  { name: "Elderline (example)", phone: "14567", category: "helpline", emergency: false },
] as const;

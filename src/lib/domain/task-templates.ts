/** Default checklist categories and rule-based task templates. */

export const TASK_CATEGORIES = [
  { id: "budget", label: "Budget & Finance" },
  { id: "guests", label: "Guest List" },
  { id: "venue", label: "Venue" },
  { id: "ceremony", label: "Ceremony" },
  { id: "reception", label: "Reception" },
  { id: "catering", label: "Catering" },
  { id: "photo", label: "Photography & Video" },
  { id: "attire", label: "Attire & Fittings" },
  { id: "beauty", label: "Hair & Makeup" },
  { id: "flowers", label: "Flowers & Décor" },
  { id: "invitations", label: "Invitations & RSVPs" },
  { id: "music", label: "Music & Entertainment" },
  { id: "rings", label: "Wedding Rings" },
  { id: "transport", label: "Transport & Accommodation" },
  { id: "legal", label: "Documents & Legal" },
  { id: "rehearsal", label: "Ceremony Rehearsal" },
  { id: "dayof", label: "Wedding-Day Logistics" },
  { id: "thankyou", label: "Thank-You Messages" },
  { id: "archive", label: "Post-Wedding" },
  { id: "other", label: "Other" },
] as const;

export const GUEST_CATEGORIES = [
  "Bride's family",
  "Groom's family",
  "Mutual friends",
  "Bride's friends",
  "Groom's friends",
  "Colleagues",
  "VIP",
  "Wedding party",
  "Vendors",
  "Other",
] as const;

export const VENDOR_CATEGORIES = [
  "Venue",
  "Catering",
  "Photographer",
  "Videographer",
  "Florist",
  "Decorator",
  "Makeup artist",
  "Hair stylist",
  "Wedding attire",
  "Cake supplier",
  "Music & entertainment",
  "Officiant",
  "Transportation",
  "Wedding coordinator",
  "Printing & stationery",
  "Accommodation",
  "Other",
] as const;

export const BUDGET_CATEGORY_DEFAULTS = [
  "Venue",
  "Catering & drinks",
  "Photography",
  "Videography",
  "Wedding attire",
  "Hair & makeup",
  "Rings",
  "Flowers",
  "Styling & décor",
  "Invitations & printing",
  "Cake & desserts",
  "Music & entertainment",
  "Ceremony costs",
  "Transportation",
  "Accommodation",
  "Favors & gifts",
  "Legal & administrative",
  "Miscellaneous",
] as const;

export type TaskTemplate = {
  title: string;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  /** Days before the wedding for the due date. Negative = after the wedding. */
  relativeDays: number | null;
  description?: string;
};

/**
 * Rule-based default checklist. relative_days drives due dates from the
 * wedding date; when the date changes, opt-in recalculation moves these.
 * Jurisdiction-sensitive items are worded as reminders, not legal advice.
 */
export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  { title: "Set an overall budget and track it", category: "budget", priority: "critical", relativeDays: 365 },
  { title: "Draft the guest list (first pass)", category: "guests", priority: "high", relativeDays: 330 },
  { title: "Research and tour ceremony venues", category: "venue", priority: "high", relativeDays: 300 },
  { title: "Research and tour reception venues", category: "venue", priority: "high", relativeDays: 300 },
  { title: "Book the ceremony venue", category: "venue", priority: "critical", relativeDays: 270 },
  { title: "Book the reception venue", category: "venue", priority: "critical", relativeDays: 270 },
  { title: "Book caterer and tasting", category: "catering", priority: "high", relativeDays: 240 },
  { title: "Book photographer", category: "photo", priority: "high", relativeDays: 240 },
  { title: "Book videographer", category: "photo", priority: "medium", relativeDays: 240 },
  { title: "Book florist and decorator", category: "flowers", priority: "medium", relativeDays: 210 },
  { title: "Shop for wedding attire", category: "attire", priority: "high", relativeDays: 210 },
  { title: "Book hair and makeup trial", category: "beauty", priority: "medium", relativeDays: 150 },
  { title: "Order wedding rings", category: "rings", priority: "high", relativeDays: 150 },
  { title: "Send save-the-dates", category: "invitations", priority: "medium", relativeDays: 150 },
  { title: "Check marriage-license requirements for your area (verify locally)", category: "legal", priority: "high", relativeDays: 120,
    description: "Requirements differ by city/province/country — treat this as a reminder to check official sources, not legal advice." },
  { title: "Send invitations and open RSVPs", category: "invitations", priority: "high", relativeDays: 90 },
  { title: "Plan the wedding-day schedule", category: "dayof", priority: "medium", relativeDays: 75 },
  { title: "Book transportation", category: "transport", priority: "medium", relativeDays: 75 },
  { title: "Arrange guest accommodation", category: "transport", priority: "low", relativeDays: 75 },
  { title: "Cake tasting and order", category: "catering", priority: "medium", relativeDays: 75 },
  { title: "Finalize menu and dietary needs", category: "catering", priority: "high", relativeDays: 45 },
  { title: "Chase pending RSVPs", category: "guests", priority: "high", relativeDays: 30 },
  { title: "Final dress fittings", category: "attire", priority: "high", relativeDays: 30 },
  { title: "Apply for the marriage license (check your local timeline)", category: "legal", priority: "critical", relativeDays: 30,
    description: "Timelines vary by jurisdiction — confirm with your local civil registrar." },
  { title: "Confirm vendors and payment schedule", category: "budget", priority: "high", relativeDays: 21 },
  { title: "Hold the ceremony rehearsal", category: "rehearsal", priority: "medium", relativeDays: 2 },
  { title: "Wedding day!", category: "dayof", priority: "critical", relativeDays: 0 },
  { title: "Send thank-you messages", category: "thankyou", priority: "medium", relativeDays: -14 },
  { title: "Settle final vendor balances", category: "budget", priority: "high", relativeDays: -7 },
  { title: "Archive the wedding plan and documents", category: "archive", priority: "low", relativeDays: -30 },
];

export function defaultDayScheduleTemplates() {
  return [
    { title: "Hair & makeup", sortOrder: 10, durationMin: 120 },
    { title: "Photography preparation", sortOrder: 20, durationMin: 60 },
    { title: "Family portraits", sortOrder: 30, durationMin: 45 },
    { title: "Guest arrival", sortOrder: 40, durationMin: 30 },
    { title: "Ceremony", sortOrder: 50, durationMin: 60 },
    { title: "Cocktail & transition", sortOrder: 60, durationMin: 60 },
    { title: "Reception entrance", sortOrder: 70, durationMin: 15 },
    { title: "Dinner", sortOrder: 80, durationMin: 90 },
    { title: "Speeches & toasts", sortOrder: 90, durationMin: 30 },
    { title: "First dance", sortOrder: 100, durationMin: 10 },
    { title: "Cake cutting", sortOrder: 110, durationMin: 15 },
    { title: "Reception closing", sortOrder: 120, durationMin: 60 },
  ];
}

export function dueDateFromTemplate(
  t: TaskTemplate,
  weddingDate: string | null,
): string | null {
  if (t.relativeDays == null || !weddingDate) return null;
  const d = new Date(weddingDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - t.relativeDays);
  return d.toISOString().slice(0, 10);
}

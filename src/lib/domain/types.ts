/** Core domain types mirroring the database schema (subset of fields the UI uses). */

import type { InvitationContent } from "./invitation";

export type DateStatus = "tentative" | "confirmed" | "undecided";
export type WeddingRole = "owner" | "co_planner" | "viewer";

export type Wedding = {
  id: string;
  owner_id: string;
  bride_name: string;
  groom_name: string;
  partner1_label: string;
  partner2_label: string;
  wedding_date: string | null;
  date_status: DateStatus;
  location: string | null;
  currency: string;
  guest_count_estimate: number | null;
  total_budget: number | null;
  contingency_pct: number;
  rsvp_deadline: string | null;
  planning_status: "planning" | "completed" | "archived";
  wedding_style: string | null;
  rsvp_settings: RsvpSettings;
  invitation_config: InvitationContent;
  invitation_published: boolean;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

export type RsvpSettings = {
  closed?: boolean;
  allowEdits?: boolean;
  requirePerGuestAttendance?: boolean;
  mealField?: boolean;
  dietaryField?: boolean;
  accessibilityField?: boolean;
  messageField?: boolean;
  songField?: boolean;
  mealChoices?: string[];
  instructions?: string;
  confirmationCopy?: string;
  [key: string]: unknown;
};

export type WeddingMember = {
  id: string;
  wedding_id: string;
  user_id: string | null;
  email: string;
  role: WeddingRole;
  status: "active" | "invited" | "declined";
  created_at: string;
};

export type Task = {
  id: string;
  wedding_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  completed_at: string | null;
  assignee: string | null;
  depends_on_task_id: string | null;
  relative_days: number | null;
  notes: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};

export type WeddingEvent = {
  id: string;
  wedding_id: string;
  title: string;
  event_type: "planning_milestone" | "wedding_day";
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  coordinator: string | null;
  vendor_id: string | null;
  sort_order: number;
  is_public: boolean;
};

export type GuestGroup = {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  side: "bride" | "groom" | "both" | "custom";
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  invited_pax: number;
  plus_one_allowed: boolean;
  invitation_type: "household" | "individual";
  internal_notes: string | null;
  rsvp_deadline_override: string | null;
  created_at: string;
};

export type Guest = {
  id: string;
  wedding_id: string;
  group_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  category: string | null;
  side: "bride" | "groom" | "both" | "custom";
  is_primary_contact: boolean;
  meal_preference: string | null;
  dietary_notes: string | null;
  accessibility_notes: string | null;
  internal_notes: string | null;
  created_at: string;
};

export type Invitation = {
  id: string;
  wedding_id: string;
  group_id: string;
  status:
    | "draft"
    | "ready"
    | "sent"
    | "pending"
    | "confirmed"
    | "declined"
    | "follow_up"
    | "cancelled";
  token_version: number;
  token_created_at: string;
  token_revoked_at: string | null;
  issued_at: string | null;
  sent_at: string | null;
  max_pax: number;
  expires_at: string | null;
  last_contacted_at: string | null;
  follow_up_notes: string | null;
  greeting_name: string | null;
  created_at: string;
  updated_at: string;
};

export type RsvpResponse = {
  id: string;
  wedding_id: string;
  invitation_id: string;
  group_id: string | null;
  status: "confirmed" | "declined";
  attending_count: number;
  meal_preferences: string | null;
  dietary_notes: string | null;
  accessibility_notes: string | null;
  message_to_couple: string | null;
  song_request: string | null;
  submitted_at: string;
  updated_at: string;
  edited_after_deadline: boolean;
};

export type BudgetCategory = {
  id: string;
  wedding_id: string;
  name: string;
  sort_order: number;
  budgeted_amount: number;
};

export type Vendor = {
  id: string;
  wedding_id: string;
  name: string;
  category: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  social_link: string | null;
  quoted_price: number | null;
  contracted_price: number | null;
  booking_status:
    | "considering"
    | "contacted"
    | "quoted"
    | "booked"
    | "declined"
    | "completed";
  rating: number | null;
  meeting_date: string | null;
  payment_terms: string | null;
  includes_notes: string | null;
  notes: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  wedding_id: string;
  title: string;
  category_id: string | null;
  vendor_id: string | null;
  estimated_amount: number;
  quoted_amount: number | null;
  contracted_amount: number | null;
  actual_amount: number | null;
  payment_status: "unpaid" | "partial" | "paid";
  currency: string;
  conversion_rate: number;
  due_date: string | null;
  task_id: string | null;
  notes: string | null;
  created_at: string;
};

export type ExpensePayment = {
  id: string;
  expense_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  status: "scheduled" | "paid";
  paid_at: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

export type Venue = {
  id: string;
  wedding_id: string;
  name: string;
  venue_type: string | null;
  role: "ceremony" | "reception" | "both" | "other";
  address: string | null;
  map_url: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  capacity: number | null;
  booking_status: "considering" | "optioned" | "booked" | "declined";
  rental_price: number | null;
  facilities: string;
  setup_start: string | null;
  teardown_end: string | null;
  restrictions: string | null;
  parking_notes: string | null;
  accessibility_notes: string | null;
  transit_notes: string | null;
  accommodation_notes: string | null;
  vendor_id: string | null;
  is_public: boolean;
};

export type SeatingTable = {
  id: string;
  wedding_id: string;
  name: string;
  capacity: number;
  location: string | null;
  shape: "round" | "rectangular" | "oval" | "long";
  sort_order: number;
  notes: string | null;
};

export type GuestTableAssignment = {
  id: string;
  wedding_id: string;
  guest_id: string;
  table_id: string | null;
  seat_number: number | null;
  is_tentative: boolean;
  notes: string | null;
};

export type WeddingPartyMember = {
  id: string;
  wedding_id: string;
  name: string;
  role: string;
  side: "bride" | "groom" | "both";
  email: string | null;
  phone: string | null;
  attire_notes: string | null;
  responsibilities: string | null;
  rehearsal: boolean;
  ceremony_position: string | null;
  fitting_date: string | null;
  notes: string | null;
  sort_order: number;
};

export type Decision = {
  id: string;
  wedding_id: string;
  title: string;
  description: string | null;
  decision_date: string | null;
  category: string | null;
  responsible: string | null;
  status: "proposed" | "decided" | "deferred" | "revisited";
  notes: string | null;
};

export type MediaAsset = {
  id: string;
  wedding_id: string;
  kind: "inspiration" | "invitation" | "gallery" | "cover" | "monogram" | "other";
  title: string | null;
  storage_path: string;
  source_url: string | null;
  source_note: string | null;
  tags: string[];
  sort_order: number;
};

export type WeddingDocument = {
  id: string;
  wedding_id: string;
  title: string;
  doc_type: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  vendor_id: string | null;
  expense_id: string | null;
  task_id: string | null;
  notes: string | null;
  created_at: string;
};

/** Effective invitation lifecycle shown in the RSVP Manager. */
export type InvitationRow = {
  invitation: Invitation;
  group: GuestGroup;
  guests: Guest[];
  response: RsvpResponse | null;
  /** Computed RSVP status when no explicit invitation status exists yet. */
  effectiveStatus:
    | "draft"
    | "ready"
    | "sent"
    | "pending"
    | "confirmed"
    | "declined"
    | "follow_up"
    | "cancelled";
};

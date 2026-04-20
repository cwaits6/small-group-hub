export type UserRole = "pending" | "member" | "content_editor" | "admin";

export type AccessRequestStatus = "pending" | "approved" | "denied";

export type RsvpStatus = "yes" | "no" | "maybe";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
  phone_work: string | null;
  bio: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  anniversary: string | null;
  occupation: string | null;
  employer: string | null;
  family_id: string | null;
  is_unlisted: boolean;
  hide_phone_mobile: boolean;
  hide_phone_home: boolean;
  hide_phone_work: boolean;
  hide_email: boolean;
  hide_address: boolean;
  hide_birthday: boolean;
  hide_anniversary: boolean;
  hide_occupation: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyUnit {
  id: string;
  family_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone_home: string | null;
  hide_address: boolean;
  hide_phone_home: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Directory projection of a profile with privacy flags applied — hidden
 * fields come back as null. Queried from the `profiles_directory` view.
 * Admins should query the raw `profiles` table to bypass privacy.
 */
export interface DirectoryProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  bio: string | null;
  family_id: string | null;
  email: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
  phone_work: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_year: number | null;
  anniversary: string | null;
  occupation: string | null;
  employer: string | null;
  created_at: string;
}

export interface DirectoryFamily {
  id: string;
  family_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  phone_home: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  message: string | null;
  status: AccessRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  signup_token: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export interface EventCalendar {
  id: string;
  name: string;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string | null;
  is_private: boolean;
  calendar_id: string | null;
  is_rsvp_enabled: boolean;
  created_by: string | null;
  created_at: string;
  // Recurrence metadata (Apple/ICS style — one row per series, expanded at render time)
  recurrence_frequency: "daily" | "weekly" | "monthly" | "yearly" | null;
  recurrence_interval: number;
  recurrence_end_mode: "never" | "count" | "until" | null;
  recurrence_count: number | null;
  recurrence_until: string | null;
  // Per-occurrence exception support
  series_id: string | null;           // set on exception events; points to the anchor series
  series_occurrence_date: string | null; // the original occurrence ISO date this row replaces
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
}

export interface Lecture {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  lecture_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export interface PageContent {
  slug: string;
  title: string;
  body: string;
  updated_by: string | null;
  updated_at: string;
}

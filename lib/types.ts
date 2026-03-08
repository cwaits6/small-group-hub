export type UserRole = "pending" | "member" | "admin";

export type AccessRequestStatus = "pending" | "approved" | "denied";

export type RsvpStatus = "yes" | "no" | "maybe";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  bio: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  message: string | null;
  status: AccessRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
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
  created_by: string | null;
  created_at: string;
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

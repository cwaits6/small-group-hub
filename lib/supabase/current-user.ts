import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Resolve the authenticated user for a server render, or null when anonymous.
// Skips the getUser() call entirely when there are no auth cookies, so
// anonymous visitors don't trigger "Invalid Refresh Token" lookups.
export async function getOptionalUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.includes("auth-token"));
  if (!hasAuthCookie) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

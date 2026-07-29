import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export default async function JoinPage() {
  // Signed-in members are already in the group — there's nothing to request, so
  // send them to the app rather than showing the access-request form.
  // Mirror the root layout: skip the getUser() call entirely when there are no
  // auth cookies, so anonymous visitors don't trigger refresh-token errors.
  const cookieStore = await cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((c) => c.name.includes("auth-token"));
  if (hasAuthCookie) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return <JoinForm />;
}

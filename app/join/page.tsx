import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/supabase/current-user";
import { JoinForm } from "./JoinForm";

export default async function JoinPage() {
  // Signed-in members are already in the group — there's nothing to request, so
  // send them to the app rather than showing the access-request form.
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  return <JoinForm />;
}

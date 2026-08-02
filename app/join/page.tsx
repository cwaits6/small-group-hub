import { redirect } from "next/navigation";
import { resolveOrgSlug, resolveRequestOrgId } from "@/lib/org";
import { getOptionalUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";
import { JoinUnavailable } from "./JoinUnavailable";

export default async function JoinPage() {
  // Signed-in members are already in the group — there's nothing to request, so
  // send them to the app rather than showing the access-request form.
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  // Resolve the request's org through the same app_request_org_id() the
  // access_requests RLS WITH CHECK evaluates — the server client sends the
  // x-two42-org header that the helper reads, so the value the form inserts
  // is by construction the value the policy compares against. The slug here
  // is for the log message only; the client keeps its own host/env mapping.
  const orgSlug = resolveOrgSlug();
  const supabase = await createClient();
  const orgId = await resolveRequestOrgId(supabase, {
    label: "Join page",
    orgSlug,
  });

  // Without a resolvable org every submission would fail closed with a bare
  // 42501 — show a real message instead of a form that can only error.
  if (!orgId) {
    return <JoinUnavailable />;
  }

  return <JoinForm orgId={orgId} />;
}

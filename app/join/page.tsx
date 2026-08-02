import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getOptionalUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export default async function JoinPage() {
  // Signed-in members are already in the group — there's nothing to request, so
  // send them to the app rather than showing the access-request form.
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  // Resolve the request's org through the same app_request_org_id() the
  // access_requests RLS WITH CHECK evaluates — the server client sends the
  // x-two42-org header that the helper reads, so the value the form inserts
  // is by construction the value the policy compares against.
  const supabase = await createClient();
  const { data: resolvedOrg, error: orgError } = await supabase.rpc("app_request_org_id");
  const orgId = typeof resolvedOrg === "string" ? resolvedOrg : null;
  if (orgError) console.error("Join page: org resolution failed:", orgError);

  // Without a resolvable org every submission would fail closed with a bare
  // 42501 — show a real message instead of a form that can only error.
  if (!orgId) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg text-center">
        <Card className="p-8">
          <CardContent className="pt-6">
            <h1 className="text-3xl font-bold text-brand-primary mb-4">
              Join requests unavailable
            </h1>
            <p className="text-lg text-muted-foreground">
              This site isn&apos;t accepting join requests right now — please
              contact your group admin.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <JoinForm orgId={orgId} />;
}

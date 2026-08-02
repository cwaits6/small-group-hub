import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { isValidOrgSlug, resolveRequestOrgId } from "@/lib/org";
import { getOptionalUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "@/app/join/JoinForm";
import { JoinUnavailable } from "@/app/join/JoinUnavailable";

interface PageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata = { title: `Request Access | ${siteConfig.name}` };

export default async function OrgJoinPage({ params }: PageProps) {
  const { orgSlug } = await params;

  // Signed-in members are already in an org — there's nothing to request, and
  // app_request_org_id() would ignore the slug and return their own org
  // anyway. Send them to the app before any resolution happens.
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  // Shape-check before the slug reaches an HTTP header. Route params arrive
  // URL-decoded, so a %0d%0a payload would otherwise reach undici as a raw
  // header value and throw a 500 instead of taking the fail-closed path.
  // The pattern is the DB's own (provision_organization()), so anything it
  // rejects could never have been minted as an org slug.
  if (!isValidOrgSlug(orgSlug)) {
    console.error("Org join page: rejected malformed org slug %s", orgSlug);
    return <JoinUnavailable />;
  }

  // The URL slug — not the host/env slug — is the org this request is about.
  // app_request_org_id() validates it against a real organizations row and
  // returns NULL otherwise, which is the fail-closed path below. It grants
  // nothing: the header only ever selects among orgs' already-public content.
  const supabase = await createClient(orgSlug);
  const orgId = await resolveRequestOrgId(supabase, {
    label: "Org join page",
    orgSlug,
  });

  // Both failure modes (RPC error, NULL result) land here. Never a fallback
  // org. The render is identical to the unresolvable-org case on purpose —
  // a distinct message would be an org-existence oracle.
  if (!orgId) {
    return <JoinUnavailable />;
  }

  return <JoinForm orgId={orgId} orgSlug={orgSlug} />;
}

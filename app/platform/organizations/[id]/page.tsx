import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-access";
import { createServiceClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  OrganizationDetail,
  type OrgDetail,
  type OwnerRequest,
} from "./OrganizationDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PlatformOrganizationPage({ params }: PageProps) {
  const user = await getPlatformAdmin();
  if (!user) redirect("/dashboard");

  const { id } = await params;

  // Cross-org reads: organizations is the tenant root and takes .eq("id");
  // access_requests is org-owned, so .eq("org_id", id) IS its tenant
  // boundary on this BYPASSRLS client. See
  // docs/security/service-role-inventory.md.
  const service = await createServiceClient();
  const { data: org } = await service
    .from("organizations")
    .select("id, name, slug, status, created_at, branding")
    .eq("id", id)
    .maybeSingle();

  if (!org) redirect("/platform/organizations");

  const { data: ownerRequests } = await service
    .from("access_requests")
    .select("name, email, signup_token, token_expires_at")
    .eq("org_id", id)
    .eq("approved_role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);

  const ownerRow = ownerRequests?.[0] ?? null;
  const owner: OwnerRequest | null = ownerRow
    ? {
        name: ownerRow.name,
        email: ownerRow.email,
        inviteOutstanding: ownerRow.signup_token !== null,
        tokenExpiresAt: ownerRow.token_expires_at,
      }
    : null;

  const branding =
    typeof org.branding === "object" && org.branding !== null && !Array.isArray(org.branding)
      ? (org.branding as Record<string, unknown>)
      : {};

  const detail: OrgDetail = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    branding: {
      display_name: typeof branding.display_name === "string" ? branding.display_name : "",
      logo_url: typeof branding.logo_url === "string" ? branding.logo_url : "",
      accent: typeof branding.accent === "string" ? branding.accent : "",
      reply_to: typeof branding.reply_to === "string" ? branding.reply_to : "",
    },
  };

  return (
    <PageContainer>
      <PageHeader
        title={org.name}
        subtitle={org.slug}
        backHref="/platform/organizations"
        backLabel="Back to Organizations"
      />
      <OrganizationDetail org={detail} owner={owner} />
    </PageContainer>
  );
}

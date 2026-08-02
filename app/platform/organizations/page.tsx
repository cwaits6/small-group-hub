import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-access";
import { createServiceClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrganizationsList, type PlatformOrg } from "./OrganizationsList";

export default async function PlatformOrganizationsPage() {
  const user = await getPlatformAdmin();
  if (!user) redirect("/dashboard");

  // Cross-org read: organizations is the tenant root (no org_id), and this
  // list existing is the whole point of the platform surface. See
  // docs/security/service-role-inventory.md.
  const service = await createServiceClient();
  const { data: orgs } = await service
    .from("organizations")
    .select("id, name, slug, status, created_at")
    .order("slug");

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Organizations"
        subtitle="Every organization on this deployment."
      />
      <OrganizationsList initialOrgs={(orgs ?? []) as PlatformOrg[]} />
    </PageContainer>
  );
}

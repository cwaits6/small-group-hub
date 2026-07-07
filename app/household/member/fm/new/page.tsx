import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { FamilyMemberForm } from "../FamilyMemberForm";

export const metadata = { title: `Add Family Member | ${siteConfig.name}` };

export default async function NewFamilyMemberPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_id, setup_completed")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["member", "content_editor", "admin"].includes(profile.role) ||
    !profile.setup_completed ||
    !profile.family_id
  ) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/household" />}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to household
      </Button>
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Add Family Member
      </h1>
      <p className="text-base text-muted-foreground mb-8">
        Add a child, parent, or other family member who doesn&apos;t have their own account.
      </p>

      <FamilyMemberForm member={null} />
    </div>
  );
}

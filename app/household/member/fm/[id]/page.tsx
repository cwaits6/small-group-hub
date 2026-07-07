import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { siteConfig } from "@/lib/config";
import type { FamilyMember } from "@/lib/types";
import { FamilyMemberForm } from "../FamilyMemberForm";

export const metadata = { title: `Edit Family Member | ${siteConfig.name}` };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditFamilyMemberPage({ params }: Props) {
  const { id } = await params;
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

  const { data: member } = await supabase
    .from("family_members")
    .select("*")
    .eq("id", id)
    .single<FamilyMember>();

  if (!member) notFound();

  // Ensure the member belongs to the current user's household
  if (member.family_id !== profile.family_id) redirect("/household");

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
        Edit Family Member
      </h1>
      <p className="text-base text-muted-foreground mb-8">
        Update info for <strong>{member.preferred_name || member.first_name}</strong>.
      </p>

      <FamilyMemberForm member={member} />
    </div>
  );
}

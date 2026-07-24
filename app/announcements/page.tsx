import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { siteConfig } from "@/lib/config";

export const metadata = { title: `Announcements | ${siteConfig.name}` };

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("is_published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        subtitle="News and updates from our group."
      />

      {announcements && announcements.length > 0 ? (
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </div>
      ) : (
        <p className="text-xl text-muted-foreground">No announcements yet.</p>
      )}
    </PageContainer>
  );
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnnouncementCard } from "@/components/announcements/AnnouncementCard";

export const metadata = { title: "Announcements | Incouragers" };

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
    .order("published_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-2">
        Announcements
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Stay up to date with the latest news from our group.
      </p>

      {announcements && announcements.length > 0 ? (
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </div>
      ) : (
        <p className="text-xl text-muted-foreground">No announcements yet.</p>
      )}
    </div>
  );
}

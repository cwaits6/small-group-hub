import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/types";

interface AnnouncementCardProps {
  announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const date = new Date(announcement.published_at || announcement.created_at);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-amber-700 shrink-0" />
          <CardTitle className="text-xl">{announcement.title}</CardTitle>
        </div>
        <p className="text-base text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-lg max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: announcement.content }}
        />
      </CardContent>
    </Card>
  );
}

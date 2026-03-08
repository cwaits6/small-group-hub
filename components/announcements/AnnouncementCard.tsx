import { Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/types";

interface AnnouncementCardProps {
  announcement: Announcement;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const date = new Date(announcement.published_at || announcement.created_at);

  return (
    <div className="bg-white rounded-2xl border-2 border-rose-100 overflow-hidden hover:border-rose-300 hover:shadow-lg transition-all duration-200">
      {/* Top accent */}
      <div
        className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg, #f43f5e, #fb7185, #f97316)" }}
      />

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#fff1f2" }}
          >
            <Megaphone className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-slate-800 leading-tight">
              {announcement.title}
            </h3>
            <p className="text-sm text-slate-400 font-medium">
              {date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div
          className="text-base text-slate-600 leading-relaxed [&_a]:text-rose-600 [&_a]:underline [&_a:hover]:text-rose-800 [&_strong]:font-semibold [&_strong]:text-slate-800"
          dangerouslySetInnerHTML={{ __html: announcement.content }}
        />
      </div>
    </div>
  );
}

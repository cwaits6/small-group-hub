import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Clock, Lock } from "lucide-react";
import type { Event } from "@/lib/types";

interface EventCardProps {
  event: Event;
  children?: React.ReactNode;
}

export function EventCard({ event, children }: EventCardProps) {
  const startDate = new Date(event.start_time);
  const endDate = event.end_time ? new Date(event.end_time) : null;

  const dayNum = startDate.toLocaleDateString("en-US", { day: "numeric" });
  const month = startDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const weekday = startDate.toLocaleDateString("en-US", { weekday: "long" });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="group bg-white rounded-2xl border-2 border-emerald-100 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
      {/* Top accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg, #059669, #34d399)" }}
      />

      <div className="p-6">
        <div className="flex gap-4">
          {/* Date chip */}
          <div className="shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #0d4f3c, #059669)" }}
          >
            <span className="text-xs font-bold tracking-widest leading-none">{month}</span>
            <span className="text-2xl font-bold font-display leading-tight">{dayNum}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-display text-xl font-bold text-slate-800 leading-tight">
                {event.title}
              </h3>
              {event.is_private && (
                <Badge
                  variant="secondary"
                  className="shrink-0 bg-amber-100 text-amber-700 border-amber-200 text-xs"
                >
                  <Lock className="h-3 w-3 mr-1" />
                  Members
                </Badge>
              )}
            </div>
            <p className="text-sm text-emerald-600 font-semibold">{weekday}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-base text-slate-500">
            <Clock className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>
              {formatTime(startDate)}
              {endDate && <span className="text-slate-400"> – {formatTime(endDate)}</span>}
            </span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-base text-slate-500">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{event.location}</span>
            </div>
          )}
          {event.description && (
            <p className="text-base text-slate-500 pt-1 leading-relaxed line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {children && <div className="mt-4 pt-4 border-t border-slate-100">{children}</div>}
      </div>
    </div>
  );
}

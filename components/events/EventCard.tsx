import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl">{event.title}</CardTitle>
          {event.is_private && (
            <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
              <Lock className="h-3 w-3" />
              Members Only
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-lg text-muted-foreground">
          <CalendarDays className="h-5 w-5 shrink-0 text-amber-700" />
          <span>{formatDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-lg text-muted-foreground">
          <Clock className="h-5 w-5 shrink-0 text-amber-700" />
          <span>
            {formatTime(startDate)}
            {endDate && ` – ${formatTime(endDate)}`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-lg text-muted-foreground">
            <MapPin className="h-5 w-5 shrink-0 text-amber-700" />
            <span>{event.location}</span>
          </div>
        )}
        {event.description && (
          <p className="text-base text-muted-foreground pt-2">{event.description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

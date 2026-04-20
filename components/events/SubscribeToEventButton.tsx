"use client";

import { Rss } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubscribeToEventButtonProps {
  eventId: string;
}

export function SubscribeToEventButton({ eventId }: SubscribeToEventButtonProps) {
  return (
    <Button
      onClick={() => {
        window.location.href = `webcal://${window.location.host}/api/events/${eventId}/ics`;
      }}
      variant="outline"
      size="lg"
      className="h-10 gap-2 border-slate-200 bg-white px-6 text-base text-slate-600 shadow-sm hover:border-emerald-300 hover:bg-white hover:text-brand-primary"
    >
      <Rss className="h-4 w-4" />
      Subscribe to Event
    </Button>
  );
}

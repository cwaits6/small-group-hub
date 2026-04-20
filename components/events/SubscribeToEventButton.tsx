"use client";

import { Rss } from "lucide-react";

interface SubscribeToEventButtonProps {
  eventId: string;
}

export function SubscribeToEventButton({ eventId }: SubscribeToEventButtonProps) {
  return (
    <button
      onClick={() => {
        window.location.href = `webcal://${window.location.host}/api/events/${eventId}/ics`;
      }}
      className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-brand-primary transition-all bg-white"
    >
      <Rss className="h-4 w-4" />
      Subscribe to Event
    </button>
  );
}

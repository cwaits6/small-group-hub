"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

interface AddToCalendarButtonProps {
  eventId: string;
}

export function AddToCalendarButton({ eventId }: AddToCalendarButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleAddToCalendar = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/events/${eventId}/ics`);
      if (!response.ok) throw new Error("Failed to fetch calendar file");

      const icsContent = await response.text();
      const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
      window.location.href = dataUri;
    } catch (error) {
      console.error("Error adding to calendar:", error);
      alert("Failed to add event to calendar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleAddToCalendar}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-white"
    >
      <CalendarPlus className="h-4 w-4" />
      {loading ? "Adding..." : "Add to Calendar"}
    </button>
  );
}

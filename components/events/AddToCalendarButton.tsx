import { CalendarPlus } from "lucide-react";

interface AddToCalendarButtonProps {
  eventId: string;
}

export function AddToCalendarButton({ eventId }: AddToCalendarButtonProps) {
  return (
    <a
      href={`/api/events/${eventId}/ics`}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-emerald-300 hover:text-brand-primary transition-all bg-white"
    >
      <CalendarPlus className="h-4 w-4" />
      Add to Calendar
    </a>
  );
}

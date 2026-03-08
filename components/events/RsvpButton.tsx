"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Check, X, HelpCircle } from "lucide-react";
import type { RsvpStatus } from "@/lib/types";

interface RsvpButtonProps {
  eventId: string;
  userId: string;
  currentStatus: RsvpStatus | null;
}

export function RsvpButton({ eventId, userId, currentStatus }: RsvpButtonProps) {
  const [status, setStatus] = useState<RsvpStatus | null>(currentStatus);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleRsvp = async (newStatus: RsvpStatus) => {
    setLoading(true);
    try {
      if (status === newStatus) {
        // Un-RSVP
        await supabase
          .from("rsvps")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", userId);
        setStatus(null);
      } else {
        // Upsert RSVP
        await supabase.from("rsvps").upsert(
          { event_id: eventId, user_id: userId, status: newStatus },
          { onConflict: "event_id,user_id" }
        );
        setStatus(newStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  const options: { value: RsvpStatus; label: string; icon: React.ReactNode }[] = [
    { value: "yes", label: "Going", icon: <Check className="h-5 w-5" /> },
    { value: "maybe", label: "Maybe", icon: <HelpCircle className="h-5 w-5" /> },
    { value: "no", label: "Can't Go", icon: <X className="h-5 w-5" /> },
  ];

  return (
    <div className="flex gap-2 pt-3">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={status === option.value ? "default" : "outline"}
          size="lg"
          className={`text-base ${status === option.value ? "bg-amber-700 hover:bg-amber-800" : ""}`}
          onClick={() => handleRsvp(option.value)}
          disabled={loading}
        >
          {option.icon}
          <span className="ml-1">{option.label}</span>
        </Button>
      ))}
    </div>
  );
}

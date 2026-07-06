"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatServiceDate } from "@/lib/serving/sundays";
import type { ScheduleEntry } from "./ServingSchedule";

export interface HistoryEntry {
  date: string;
  entry: ScheduleEntry | null;
}

interface ServingHistoryProps {
  entries: HistoryEntry[];
}

export function ServingHistory({ entries }: ServingHistoryProps) {
  const [open, setOpen] = useState(false);

  if (!entries.length) return null;

  return (
    <div className="mt-10 border-t border-border pt-8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Previous weeks ({entries.length})
      </button>

      {open && (
        <div className="mt-4 space-y-0 divide-y divide-border">
          {entries.map(({ date, entry }) => (
            <div
              key={date}
              className="flex items-center justify-between py-3 gap-4"
            >
              <span className="font-sans text-sm text-muted-foreground shrink-0">
                {formatServiceDate(date)}
              </span>
              {entry ? (
                <span className="font-sans text-sm font-medium text-foreground text-right">
                  {entry.label}
                </span>
              ) : (
                <span className="font-sans text-sm text-muted-foreground/60 italic text-right">
                  No one signed up
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

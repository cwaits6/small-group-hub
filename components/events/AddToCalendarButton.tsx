"use client";

import { AddToCalendarButton as AtcButton } from "add-to-calendar-button-react";

interface AddToCalendarButtonProps {
  eventTitle: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  compact?: boolean;
}

const TZ = "America/New_York";

function formatDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function formatTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const h = parts.find(p => p.type === "hour")!.value;
  const min = parts.find(p => p.type === "minute")!.value;
  return `${h}:${min}`;
}

export function AddToCalendarButton({
  eventTitle,
  startTime,
  endTime,
  location,
  description,
  compact,
}: AddToCalendarButtonProps) {
  const effectiveEndTime = endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  return (
    <AtcButton
      name={eventTitle}
      startDate={formatDate(startTime)}
      startTime={formatTime(startTime)}
      endDate={formatDate(effectiveEndTime)}
      endTime={formatTime(effectiveEndTime)}
      timeZone={TZ}
      location={location || undefined}
      description={description ?? undefined}
      options={["Apple", "Google", "iCal", "Outlook.com", "Microsoft365"]}
      buttonStyle={compact ? "text" : "default"}
      lightMode="light"
      size={compact ? "3" : "5"}
      hideBranding
    />
  );
}

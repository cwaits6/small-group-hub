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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function AddToCalendarButton({
  eventTitle,
  startTime,
  endTime,
  location,
  description,
  compact,
}: AddToCalendarButtonProps) {
  return (
    <AtcButton
      name={eventTitle}
      startDate={formatDate(startTime)}
      startTime={formatTime(startTime)}
      endDate={endTime ? formatDate(endTime) : formatDate(startTime)}
      endTime={endTime ? formatTime(endTime) : undefined}
      location={location ?? undefined}
      description={description ?? undefined}
      options={["Apple", "Google", "iCal", "Outlook.com", "Microsoft365"]}
      buttonStyle={compact ? "text" : "default"}
      lightMode="light"
      size={compact ? "3" : "5"}
      hideBranding
    />
  );
}

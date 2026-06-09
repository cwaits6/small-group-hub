"use client";

import { useEffect, useState } from "react";
import { AddToCalendarButton as AtcButton } from "add-to-calendar-button-react";

interface AddToCalendarButtonProps {
  eventTitle: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  compact?: boolean;
  instance?: string | number;
}

const TZ = "America/New_York";
const detailButtonStyle = [
  "--btn-background:#fff",
  "--btn-hover-background:#E2ECF7",
  "--btn-hover-border:#2F6BA8",
  "--btn-border:#E5E0D4",
  "--btn-border-width:1px",
  "--btn-border-radius:0.75rem",
  "--btn-padding-x:0.95em",
  "--btn-padding-y:0.52em",
  "--btn-text:#475569",
  "--btn-hover-text:#2F6BA8",
  "--btn-font-weight:600",
  "--font:var(--font-sans), sans-serif",
  "--base-font-size-l:16px",
  "--base-font-size-m:16px",
  "--base-font-size-s:16px",
  "--accent-color:#2F6BA8",
  "--list-background:#fff",
  "--list-hover-background:#E2ECF7",
  "--list-text:#334155",
  "--list-hover-text:#2F6BA8",
  "--list-border:#E5E0D4",
  "--list-border-radius:1rem",
  "--list-padding:0.8em 1em",
  "--buttonslist-gap:0.75rem",
].join(";");

const compactButtonStyle = [
  "--btn-background:#fff",
  "--btn-hover-background:#f8fafc",
  "--btn-hover-border:#cbd5e1",
  "--btn-border:#e2e8f0",
  "--btn-border-width:1px",
  "--btn-border-radius:0.75rem",
  "--btn-padding-x:0.9em",
  "--btn-padding-y:0.55em",
  "--btn-text:#334155",
  "--btn-hover-text:#2F6BA8",
  "--btn-font-weight:600",
  "--font:var(--font-sans), sans-serif",
  "--base-font-size-l:14px",
  "--base-font-size-m:14px",
  "--base-font-size-s:14px",
  "--accent-color:#2F6BA8",
  "--list-background:#fff",
  "--list-hover-background:#E2ECF7",
  "--list-text:#334155",
  "--list-hover-text:#2F6BA8",
  "--list-border:#e2e8f0",
  "--list-border-radius:1rem",
  "--list-padding:0.8em 1em",
].join(";");

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
  instance,
}: AddToCalendarButtonProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const startDate = new Date(startTime);
  const parsedEndTime = endTime ? new Date(endTime) : null;
  const effectiveEndTime =
    parsedEndTime && parsedEndTime.getTime() > startDate.getTime()
      ? parsedEndTime.toISOString()
      : new Date(startDate.getTime() + 60 * 60 * 1000).toISOString();

  if (!isMounted) {
    return (
      <div
        aria-hidden="true"
        className={compact ? "h-8 w-24 rounded-md border border-input bg-background" : "h-10 w-40 rounded-md border border-input bg-background"}
      />
    );
  }

  return (
    <AtcButton
      instance={instance}
      name={eventTitle}
      startDate={formatDate(startTime)}
      startTime={formatTime(startTime)}
      endDate={formatDate(effectiveEndTime)}
      endTime={formatTime(effectiveEndTime)}
      timeZone={TZ}
      location={location || undefined}
      description={description ?? undefined}
      options={["Apple", "Google", "iCal", "Outlook.com", "Microsoft365"]}
      buttonStyle="default"
      lightMode="light"
      size={compact ? "3" : "5"}
      styleLight={compact ? compactButtonStyle : detailButtonStyle}
      styleDark={compact ? compactButtonStyle : detailButtonStyle}
      hideBranding
    />
  );
}

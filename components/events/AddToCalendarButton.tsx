"use client";

import { useSyncExternalStore } from "react";
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
  "--btn-background:var(--card)",
  "--btn-hover-background:var(--color-brand-warm)",
  "--btn-hover-border:var(--color-brand-primary)",
  "--btn-border:var(--color-brand-bg-muted)",
  "--btn-border-width:1px",
  "--btn-border-radius:0.75rem",
  "--btn-padding-x:0.95em",
  "--btn-padding-y:0.52em",
  "--btn-text:var(--muted-foreground)",
  "--btn-hover-text:var(--color-brand-primary)",
  "--btn-font-weight:600",
  "--font:var(--font-sans), sans-serif",
  "--base-font-size-l:16px",
  "--base-font-size-m:16px",
  "--base-font-size-s:16px",
  "--accent-color:var(--color-brand-primary)",
  "--list-background:var(--card)",
  "--list-hover-background:var(--color-brand-warm)",
  "--list-text:var(--foreground)",
  "--list-hover-text:var(--color-brand-primary)",
  "--list-border:var(--color-brand-bg-muted)",
  "--list-border-radius:1rem",
  "--list-padding:0.8em 1em",
  "--buttonslist-gap:0.75rem",
].join(";");

const compactButtonStyle = [
  "--btn-background:var(--card)",
  "--btn-hover-background:var(--background)",
  "--btn-hover-border:var(--border)",
  "--btn-border:var(--border)",
  "--btn-border-width:1px",
  "--btn-border-radius:0.75rem",
  "--btn-padding-x:0.9em",
  "--btn-padding-y:0.55em",
  "--btn-text:var(--foreground)",
  "--btn-hover-text:var(--color-brand-primary)",
  "--btn-font-weight:600",
  "--font:var(--font-sans), sans-serif",
  "--base-font-size-l:14px",
  "--base-font-size-m:14px",
  "--base-font-size-s:14px",
  "--accent-color:var(--color-brand-primary)",
  "--list-background:var(--card)",
  "--list-hover-background:var(--color-brand-warm)",
  "--list-text:var(--foreground)",
  "--list-hover-text:var(--color-brand-primary)",
  "--list-border:var(--border)",
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
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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

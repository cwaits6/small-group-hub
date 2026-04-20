"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GoogleMapsScript } from "@/components/GoogleMapsScript";
import { LocationInput } from "@/components/events/LocationInput";
import { addHour, isValidEndTime } from "@/lib/datetime-local";
import type { EventCalendar } from "@/lib/types";

const APP_TIMEZONE = "America/New_York";

/** Parse a datetime-local string (YYYY-MM-DDTHH:mm) as wall-clock time in
 *  APP_TIMEZONE and return a UTC ISO string. */
function localToUTCISO(localStr: string): string {
  const [datePart, timePart] = localStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  // Treat the desired local time as UTC (arbitrary reference)
  const ref = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Ask Intl what APP_TIMEZONE shows for that UTC moment
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  // delta = how far UTC is ahead of APP_TIMEZONE at this moment
  const shownAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(ref.getTime() + (ref.getTime() - shownAsUTC)).toISOString();
}

type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
type RecurrenceEndMode = "never" | "count" | "until";

const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const END_MODE_LABELS: Record<RecurrenceEndMode, string> = {
  never: "Never",
  count: "After Number Of Times",
  until: "On Date",
};

export function NewEventForm() {
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState<EventCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [isRsvpEnabled, setIsRsvpEnabled] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("weekly");
  const [recurrenceEndMode, setRecurrenceEndMode] = useState<RecurrenceEndMode>("never");
  const [recurrenceCount, setRecurrenceCount] = useState("4");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [location, setLocation] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const rawDate = searchParams.get("date");
  const prefillDate = rawDate ? rawDate.split("T")[0] : null;
  const selectedCalendar = calendars.find((calendar) => calendar.id === calendarId) ?? null;
  const initialStartTime = useMemo(
    () => (prefillDate ? `${prefillDate}T09:00` : ""),
    [prefillDate]
  );
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(() => addHour(initialStartTime));

  useEffect(() => {
    setStartTime(initialStartTime);
    setEndTime(addHour(initialStartTime));
  }, [initialStartTime]);

  useEffect(() => {
    supabase
      .from("event_calendars")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load event calendars:", error);
          toast.error("Failed to load calendars.");
          return;
        }
        if (data) setCalendars(data as EventCalendar[]);
      });
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isValidEndTime(startTime, endTime)) {
      toast.error("End time must be after start time.");
      return;
    }

    const parsedRecurrenceCount = Number(recurrenceCount);
    if (
      isRecurring &&
      recurrenceEndMode === "count" &&
      (!Number.isInteger(parsedRecurrenceCount) || parsedRecurrenceCount < 2 || parsedRecurrenceCount > 999)
    ) {
      toast.error("Recurring events must repeat between 2 and 999 times.");
      return;
    }

    if (isRecurring && recurrenceEndMode === "until") {
      if (!recurrenceUntil) {
        toast.error("Choose when the recurring event should stop repeating.");
        return;
      }

      const untilDate = new Date(recurrenceUntil);
      const firstStartDate = new Date(startTime);
      // Both are datetime-local strings (same timezone offset implicit), so
      // comparing them as browser-local Dates is valid for ordering checks.
      if (Number.isNaN(untilDate.getTime()) || untilDate.getTime() < firstStartDate.getTime()) {
        toast.error("Repeat until must be on or after the first event.");
        return;
      }
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const nextLocation = (formData.get("location") as string)?.trim() ?? "";
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;

    const { error } = await supabase.from("events").insert({
      title,
      description,
      location: nextLocation || null,
      start_time: localToUTCISO(startTime),
      end_time: endTime ? localToUTCISO(endTime) : null,
      is_private: true,
      calendar_id: calendarId || null,
      is_rsvp_enabled: isRsvpEnabled,
      created_by: user?.id,
      recurrence_frequency: isRecurring ? recurrenceFrequency : null,
      recurrence_interval: 1,
      recurrence_end_mode: isRecurring ? recurrenceEndMode : null,
      recurrence_count: isRecurring && recurrenceEndMode === "count" ? parsedRecurrenceCount : null,
      recurrence_until:
        isRecurring && recurrenceEndMode === "until"
          ? localToUTCISO(recurrenceUntil)
          : null,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create event.");
      return;
    }

    toast.success("Event created!");
    router.push("/events");
  };

  const handleStartTimeChange = (nextStartTime: string) => {
    const previousSuggestedEndTime = addHour(startTime);
    setStartTime(nextStartTime);

    if (!endTime || endTime === previousSuggestedEndTime) {
      setEndTime(addHour(nextStartTime));
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <GoogleMapsScript />
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Create Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-lg">Description</Label>
              <Textarea id="description" name="description" rows={4} className="text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-lg">Location</Label>
              <LocationInput
                id="location"
                name="location"
                value={location}
                onChange={setLocation}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time" className="text-lg">Start Time</Label>
                <Input
                  id="start_time"
                  name="start_time"
                  type="datetime-local"
                  required
                  className="text-lg py-6"
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-lg">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  className="text-lg py-6"
                  min={startTime || undefined}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-lg">Calendar</Label>
              <Select
                value={calendarId ?? "none"}
                onValueChange={(val) => setCalendarId(val === "none" ? null : val)}
              >
                <SelectTrigger className="w-full text-lg py-6">
                  <SelectValue placeholder="No calendar (uncategorized)">
                    {selectedCalendar ? (
                      <span className="flex items-center gap-2">
                        {selectedCalendar.color && (
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: selectedCalendar.color }}
                          />
                        )}
                        {selectedCalendar.name}
                      </span>
                    ) : (
                      "No calendar (uncategorized)"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[20rem]">
                  <SelectItem value="none">No calendar (uncategorized)</SelectItem>
                  {calendars.map((cal) => (
                    <SelectItem key={cal.id} value={cal.id}>
                      <span className="flex items-center gap-2">
                        {cal.color && (
                          <span
                            className="inline-block w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: cal.color }}
                          />
                        )}
                        {cal.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_rsvp_enabled"
                checked={isRsvpEnabled}
                onCheckedChange={setIsRsvpEnabled}
              />
              <Label htmlFor="is_rsvp_enabled" className="text-lg">RSVP enabled</Label>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="is_recurring"
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
                <div>
                  <Label htmlFor="is_recurring" className="text-lg">Recurring event</Label>
                  <p className="text-sm text-muted-foreground">
                    Repeat this event on a schedule.
                  </p>
                </div>
              </div>

              {isRecurring && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-lg">Repeat</Label>
                      <Select
                        value={recurrenceFrequency}
                        onValueChange={(value) => setRecurrenceFrequency(value as RecurrenceFrequency)}
                      >
                        <SelectTrigger className="w-full text-lg py-6">
                          <SelectValue>{RECURRENCE_LABELS[recurrenceFrequency]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-lg">End Repeat</Label>
                      <Select
                        value={recurrenceEndMode}
                        onValueChange={(value) => setRecurrenceEndMode(value as RecurrenceEndMode)}
                      >
                        <SelectTrigger className="w-full text-lg py-6">
                          <SelectValue>{END_MODE_LABELS[recurrenceEndMode]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="count">After Number Of Times</SelectItem>
                          <SelectItem value="until">On Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {recurrenceEndMode === "count" && (
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_count" className="text-lg">Occurrences</Label>
                      <Input
                        id="recurrence_count"
                        type="number"
                        min="2"
                        max="999"
                        step="1"
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(e.target.value)}
                        className="text-lg py-6"
                      />
                    </div>
                  )}

                  {recurrenceEndMode === "until" && (
                    <div className="space-y-2">
                      <Label htmlFor="recurrence_until" className="text-lg">Repeat Until</Label>
                      <Input
                        id="recurrence_until"
                        type="datetime-local"
                        min={startTime || undefined}
                        value={recurrenceUntil}
                        onChange={(e) => setRecurrenceUntil(e.target.value)}
                        className="text-lg py-6"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-brand-primary hover:bg-brand-primary/90 text-white"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Event"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
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
import type { EventCalendar } from "@/lib/types";

export default function NewEventPage() {
  const [loading, setLoading] = useState(false);
  const [calendars, setCalendars] = useState<EventCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [isRsvpEnabled, setIsRsvpEnabled] = useState(true);
  const [location, setLocation] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // Pre-fill start time from calendar date click (e.g. ?date=2026-04-15)
  // Normalize to YYYY-MM-DD in case a full ISO datetime is passed from timeGridWeek
  const rawDate = searchParams.get("date");
  const prefillDate = rawDate ? rawDate.split("T")[0] : null;

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
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("events").insert({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      location: location || null,
      start_time: formData.get("start_time") as string,
      end_time: (formData.get("end_time") as string) || null,
      is_private: formData.get("is_private") === "on",
      calendar_id: calendarId || null,
      is_rsvp_enabled: isRsvpEnabled,
      created_by: user?.id,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create event.");
      return;
    }

    toast.success("Event created!");
    router.push("/admin");
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
                value={location}
                onChange={setLocation}
                className="text-lg py-6"
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
                  defaultValue={prefillDate ? `${prefillDate}T09:00` : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-lg">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  className="text-lg py-6"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-lg">Calendar</Label>
              <Select
                value={calendarId ?? "none"}
                onValueChange={(val) => setCalendarId(val === "none" ? null : val)}
              >
                <SelectTrigger className="text-lg py-6">
                  <SelectValue placeholder="No calendar (uncategorized)" />
                </SelectTrigger>
                <SelectContent>
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
              <Switch id="is_private" name="is_private" />
              <Label htmlFor="is_private" className="text-lg">Members only (private)</Label>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_rsvp_enabled"
                checked={isRsvpEnabled}
                onCheckedChange={setIsRsvpEnabled}
              />
              <Label htmlFor="is_rsvp_enabled" className="text-lg">RSVP enabled</Label>
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

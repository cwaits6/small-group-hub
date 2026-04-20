"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import type { Event, EventCalendar } from "@/lib/types";

export default function EditEventPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [calendars, setCalendars] = useState<EventCalendar[]>([]);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [isRsvpEnabled, setIsRsvpEnabled] = useState(true);
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: eventData, error: eventError }, { data: calData }] = await Promise.all([
        supabase.from("events").select("*").eq("id", params.id).single(),
        supabase.from("event_calendars").select("*").order("name"),
      ]);
      if (eventError || !eventData) {
        router.replace("/admin");
        return;
      }
      setEvent(eventData as Event);
      setCalendarId(eventData.calendar_id ?? null);
      setIsRsvpEnabled(eventData.is_rsvp_enabled ?? true);
      setLocation(eventData.location ?? "");
      if (calData) setCalendars(calData as EventCalendar[]);
      setIsLoading(false);
    }
    load();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const nextLocation = (formData.get("location") as string)?.trim() ?? "";

    const { error } = await supabase
      .from("events")
      .update({
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        location: nextLocation || null,
        start_time: new Date(formData.get("start_time") as string).toISOString(),
        end_time: (formData.get("end_time") as string) ? new Date(formData.get("end_time") as string).toISOString() : null,
        is_private: formData.get("is_private") === "on",
        calendar_id: calendarId || null,
        is_rsvp_enabled: isRsvpEnabled,
      })
      .eq("id", params.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to update event.");
      return;
    }

    toast.success("Event updated!");
    router.replace(`/events/${params.id}`);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    const { error } = await supabase.from("events").delete().eq("id", params.id);

    if (error) {
      toast.error("Failed to delete event.");
      return;
    }

    toast.success("Event deleted.");
    router.push("/admin");
  };

  if (isLoading || !event) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <GoogleMapsScript />
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Edit Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required defaultValue={event.title} className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-lg">Description</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={event.description || ""} className="text-lg" />
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
                  defaultValue={toLocalDatetime(event.start_time)}
                  className="text-lg py-6"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time" className="text-lg">End Time</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="datetime-local"
                  defaultValue={event.end_time ? toLocalDatetime(event.end_time) : ""}
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
                <SelectTrigger className="w-full text-lg py-6">
                  <SelectValue placeholder="No calendar (uncategorized)" />
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
              <Switch id="is_private" name="is_private" defaultChecked={event.is_private} />
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

            <div className="flex gap-3">
              <Button
                type="submit"
                size="lg"
                className="flex-1 text-lg py-6 bg-brand-primary hover:bg-brand-primary/90 text-white"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="text-lg py-6"
                onClick={() => router.push(`/events/${params.id}`)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="text-lg py-6"
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

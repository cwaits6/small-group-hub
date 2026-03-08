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
import { toast } from "sonner";
import type { Event } from "@/lib/types";

export default function EditEventPage() {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("id", params.id)
        .single();
      setEvent(data);
    }
    load();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from("events")
      .update({
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        location: (formData.get("location") as string) || null,
        start_time: formData.get("start_time") as string,
        end_time: (formData.get("end_time") as string) || null,
        is_private: formData.get("is_private") === "on",
      })
      .eq("id", params.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to update event.");
      return;
    }

    toast.success("Event updated!");
    router.push("/admin");
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

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Edit Event</CardTitle>
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
              <Input id="location" name="location" defaultValue={event.location || ""} className="text-lg py-6" />
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

            <div className="flex items-center gap-3">
              <Switch id="is_private" name="is_private" defaultChecked={event.is_private} />
              <Label htmlFor="is_private" className="text-lg">Members only (private)</Label>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                size="lg"
                className="flex-1 text-lg py-6 bg-amber-700 hover:bg-amber-800"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
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

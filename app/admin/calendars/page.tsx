"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { EventCalendar } from "@/lib/types";

export default function AdminCalendarsPage() {
  const [calendars, setCalendars] = useState<EventCalendar[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [adding, setAdding] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("event_calendars")
      .select("*")
      .order("name");
    if (error) {
      toast.error("Failed to load calendars.");
      return;
    }
    if (data) setCalendars(data as EventCalendar[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("event_calendars").insert({
      name: name.trim(),
      color,
      created_by: user?.id,
    });

    setAdding(false);

    if (error) {
      toast.error("Failed to create calendar.");
      return;
    }

    toast.success("Calendar created.");
    setName("");
    setColor("#6366f1");
    await load();
  };

  const handleDelete = async (id: string, calName: string) => {
    if (!confirm(`Delete calendar "${calName}"? Events assigned to it will become uncategorized.`)) return;

    const { error } = await supabase.from("event_calendars").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete calendar.");
      return;
    }

    toast.success("Calendar deleted.");
    await load();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Event Calendars</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add new calendar form */}
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cal-name" className="text-base">Calendar Name</Label>
              <Input
                id="cal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Encouragers, First Redeemer"
                required
                className="text-base py-5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cal-color" className="text-base">Color</Label>
              <input
                id="cal-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="block h-10 w-16 rounded-md border border-input cursor-pointer p-1"
              />
            </div>
            <Button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary/90 text-white py-5"
              disabled={adding}
            >
              {adding ? "Adding..." : "Add Calendar"}
            </Button>
          </form>

          {/* Calendar list */}
          {calendars.length === 0 ? (
            <p className="text-muted-foreground text-base">No calendars yet. Add one above.</p>
          ) : (
            <ul className="space-y-2">
              {calendars.map((cal) => (
                <li
                  key={cal.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block w-4 h-4 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: cal.color ?? "#e5e7eb" }}
                    />
                    <span className="text-base font-medium">{cal.name}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(cal.id, cal.name)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

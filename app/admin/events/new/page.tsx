"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function NewEventPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("events").insert({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      location: (formData.get("location") as string) || null,
      start_time: formData.get("start_time") as string,
      end_time: (formData.get("end_time") as string) || null,
      is_private: formData.get("is_private") === "on",
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
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Create Event</CardTitle>
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
              <Input id="location" name="location" className="text-lg py-6" />
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

            <div className="flex items-center gap-3">
              <Switch id="is_private" name="is_private" />
              <Label htmlFor="is_private" className="text-lg">Members only (private)</Label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function NewLecturePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("lectures").insert({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || null,
      video_url: formData.get("video_url") as string,
      thumbnail_url: (formData.get("thumbnail_url") as string) || null,
      lecture_date: (formData.get("lecture_date") as string) || null,
      created_by: user?.id,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to add lecture.");
      return;
    }

    toast.success("Lecture added!");
    router.push("/admin");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Add Lecture</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video_url" className="text-lg">Video URL</Label>
              <Input
                id="video_url"
                name="video_url"
                type="url"
                required
                placeholder="https://youtube.com/watch?v=..."
                className="text-lg py-6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lecture_date" className="text-lg">Lecture Date</Label>
              <Input id="lecture_date" name="lecture_date" type="date" className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-lg">Description</Label>
              <Textarea id="description" name="description" rows={3} className="text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail_url" className="text-lg">
                Thumbnail URL <span className="text-muted-foreground">(optional, auto-detected for YouTube)</span>
              </Label>
              <Input id="thumbnail_url" name="thumbnail_url" type="url" className="text-lg py-6" />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Lecture"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

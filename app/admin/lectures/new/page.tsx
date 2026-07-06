"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function NewLecturePageWrapper() {
  return (
    <Suspense>
      <NewLecturePage />
    </Suspense>
  );
}

function NewLecturePage() {
  const [loading, setLoading] = useState(false);
  const [seriesList, setSeriesList] = useState<{ id: string; name: string; teacher: string | null }[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSeries = searchParams.get("series") ?? "";
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("lecture_series")
      .select("id, name, teacher")
      .order("created_at", { ascending: false })
      .then(({ data }) => setSeriesList(data ?? []));
  }, [supabase]);

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
      series_id: (formData.get("series_id") as string) || null,
      summary: (formData.get("summary") as string) || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to add lecture.");
      return;
    }

    toast.success("Lecture added!");
    router.push("/admin/lectures");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Add Lecture</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Series */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="series_id" className="text-lg">Series</Label>
                <a
                  href="/admin/lectures/series/new"
                  className="text-sm font-medium text-brand-primary hover:opacity-80"
                >
                  + Create new series
                </a>
              </div>
              <select
                id="series_id"
                name="series_id"
                defaultValue={preselectedSeries}
                className="w-full border border-input rounded-md px-3 py-3 text-base bg-background"
              >
                <option value="">No series</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.teacher ? ` — ${s.teacher}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required className="text-lg py-6" />
            </div>

            {/* Video URL */}
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

            {/* Lecture date */}
            <div className="space-y-2">
              <Label htmlFor="lecture_date" className="text-lg">Lecture Date</Label>
              <Input id="lecture_date" name="lecture_date" type="date" className="text-lg py-6" />
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary" className="text-lg">Summary</Label>
              <Textarea
                id="summary"
                name="summary"
                rows={4}
                placeholder="Post-class summary..."
                className="text-lg"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-lg">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                placeholder="Short description (optional)"
                className="text-lg"
              />
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label htmlFor="thumbnail_url" className="text-lg">
                Thumbnail URL{" "}
                <span className="text-muted-foreground">(optional, auto-detected for YouTube)</span>
              </Label>
              <Input id="thumbnail_url" name="thumbnail_url" type="url" className="text-lg py-6" />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-brand-primary hover:bg-brand-primary/90 text-white"
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

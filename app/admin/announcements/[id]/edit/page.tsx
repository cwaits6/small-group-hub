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
import type { Announcement } from "@/lib/types";

export default function EditAnnouncementPage() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", params.id)
        .single();
      setAnnouncement(data);
    }
    load();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const isPublished = formData.get("is_published") === "on";

    const { error } = await supabase
      .from("announcements")
      .update({
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        is_published: isPublished,
        published_at: isPublished && !announcement?.published_at
          ? new Date().toISOString()
          : announcement?.published_at,
      })
      .eq("id", params.id);

    setLoading(false);

    if (error) {
      toast.error("Failed to update announcement.");
      return;
    }

    toast.success("Announcement updated!");
    router.push("/admin");
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    const { error } = await supabase.from("announcements").delete().eq("id", params.id);

    if (error) {
      toast.error("Failed to delete announcement.");
      return;
    }

    toast.success("Announcement deleted.");
    router.push("/admin");
  };

  if (!announcement) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Edit Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required defaultValue={announcement.title} className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-lg">Content</Label>
              <Textarea id="content" name="content" required rows={8} defaultValue={announcement.content} className="text-lg" />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="is_published" name="is_published" defaultChecked={announcement.is_published} />
              <Label htmlFor="is_published" className="text-lg">Published</Label>
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

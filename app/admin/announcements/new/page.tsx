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

export default function NewAnnouncementPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    const isPublished = formData.get("is_published") === "on";

    const { error } = await supabase.from("announcements").insert({
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      author_id: user?.id,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to create announcement.");
      return;
    }

    toast.success("Announcement created!");
    router.push("/admin");
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">New Announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">Title</Label>
              <Input id="title" name="title" required className="text-lg py-6" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content" className="text-lg">
                Content <span className="text-muted-foreground">(HTML supported)</span>
              </Label>
              <Textarea id="content" name="content" required rows={8} className="text-lg" />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="is_published" name="is_published" defaultChecked />
              <Label htmlFor="is_published" className="text-lg">Publish immediately</Label>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Announcement"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

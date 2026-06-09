"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type LectureSeries = {
  id: string;
  name: string;
  teacher: string | null;
  is_archived: boolean;
};

export default function EditSeriesPage() {
  const [series, setSeries] = useState<LectureSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found">(
    "loading",
  );
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("lecture_series")
      .select("id, name, teacher, is_archived")
      .eq("id", params.id as string)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setLoadState("not-found");
          return;
        }
        setSeries(data as LectureSeries);
        setIsArchived((data as LectureSeries).is_archived);
        setLoadState("ready");
      });
  }, [params.id, supabase]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    const { error } = await supabase
      .from("lecture_series")
      .update({
        name: formData.get("name") as string,
        teacher: (formData.get("teacher") as string) || null,
        is_archived: isArchived,
      })
      .eq("id", params.id as string);

    setLoading(false);

    if (error) {
      toast.error("Failed to update series.");
      return;
    }

    toast.success("Series updated!");
    router.push("/admin/lectures/series");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this series? Lectures in it will be unlinked but not deleted.")) return;

    const { error } = await supabase
      .from("lecture_series")
      .delete()
      .eq("id", params.id as string);

    if (error) {
      toast.error("Failed to delete series.");
      return;
    }

    toast.success("Series deleted.");
    router.push("/admin/lectures/series");
  };

  if (loadState === "loading") {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (loadState === "not-found" || !series) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">
          Series not found.{" "}
          <Link
            href="/admin/lectures/series"
            className="text-brand-primary hover:underline"
          >
            Back to series
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">Edit Series</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-lg">Series Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={series.name}
                className="text-lg py-6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher" className="text-lg">Teacher</Label>
              <Input
                id="teacher"
                name="teacher"
                defaultValue={series.teacher ?? ""}
                className="text-lg py-6"
              />
            </div>

            <div className="flex items-center gap-3 pt-2 pb-2">
              <Switch
                id="is_archived"
                checked={isArchived}
                onCheckedChange={setIsArchived}
              />
              <div>
                <Label htmlFor="is_archived" className="text-base font-medium">Archive this series</Label>
                <p className="text-sm text-muted-foreground">Moves it to the Past Series section on the lectures page</p>
              </div>
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

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlockEditor } from "@/components/editor";
import { toast } from "sonner";
import type { Block, PartialBlock } from "@blocknote/core";
import type { PageContent } from "@/lib/types";

export default function EditPageContentPage() {
  const [page, setPage] = useState<PageContent | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const blocksRef = useRef<Block[]>([]);
  const isDirtyRef = useRef(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const slug = params.slug as string;
  const isNew = slug === "new";
  const isContentEditor = userRole === "content_editor";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setUserRole(profile?.role ?? null);
      }

      if (isNew) {
        setPage({ slug: "", title: "", body: "", updated_by: null, updated_at: "" });
        isDirtyRef.current = false;
        setInitialLoading(false);
        return;
      }

      const { data } = await supabase
        .from("page_content")
        .select("*")
        .eq("slug", slug)
        .single();
      setPage(data);
      isDirtyRef.current = false;
      setInitialLoading(false);
    }
    load();
  }, [slug, isNew]);

  const parsedInitialContent = (): PartialBlock[] | undefined => {
    if (!page?.body) return undefined;
    try {
      const parsed = JSON.parse(page.body);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    // If editor was never touched, preserve existing body to avoid overwriting with []
    const body = isDirtyRef.current
      ? JSON.stringify(blocksRef.current)
      : (page?.body ?? "[]");

    let newSlug = isNew
      ? title
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : slug;

    // Validate slug is non-empty and not a reserved word
    if (isNew && (!newSlug || newSlug === "new")) {
      toast.error("Please enter a valid title with at least one alphanumeric character.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (isNew) {
      const { error } = await supabase.from("page_content").insert({
        slug: newSlug,
        title,
        body,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      });

      setLoading(false);

      if (error) {
        toast.error(
          error.code === "23505"
            ? "A page with that title already exists. Please choose a different name."
            : "Failed to create page."
        );
        return;
      }

      toast.success("Page created!");
      isDirtyRef.current = false;
    } else {
      const { error } = await supabase
        .from("page_content")
        .update({
          title,
          body,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", slug);

      setLoading(false);

      if (error) {
        toast.error("Failed to update page.");
        return;
      }

      toast.success("Page saved!");
      isDirtyRef.current = false;
    }

    router.push("/admin/pages");
  };

  const handleDelete = async () => {
    if (isContentEditor) {
      toast.error("You don't have permission to delete pages.");
      return;
    }
    if (!confirm("Are you sure you want to delete this page?")) return;

    const { error } = await supabase
      .from("page_content")
      .delete()
      .eq("slug", slug);

    if (error) {
      toast.error("Failed to delete page.");
      return;
    }

    toast.success("Page deleted.");
    router.push("/admin/pages");
  };

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Page not found.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-brand-primary">
            {isNew ? "New Page" : "Edit Page"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form id="page-form" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="title" className="text-lg">
                Title
              </Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={page.title}
                className="text-lg py-6"
              />
            </div>
          </form>

          <div className="space-y-2">
            <Label className="text-lg">Content</Label>
            <div className="rounded-lg overflow-hidden border border-border">
              <BlockEditor
                initialContent={parsedInitialContent()}
                onChange={(blocks) => {
                  blocksRef.current = blocks;
                  isDirtyRef.current = true;
                }}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              form="page-form"
              size="lg"
              className="flex-1 text-lg py-6 bg-brand-primary hover:bg-brand-primary/90 text-white"
              disabled={loading}
            >
              {loading
                ? isNew
                  ? "Creating..."
                  : "Saving..."
                : isNew
                  ? "Create Page"
                  : "Save Changes"}
            </Button>
            {!isNew && !isContentEditor && (
              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="text-lg py-6"
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

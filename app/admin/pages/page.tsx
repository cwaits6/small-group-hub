import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { siteConfig } from "@/lib/config";
import type { PageContent } from "@/lib/types";

export const metadata = { title: `Manage Pages | ${siteConfig.name}` };

export default async function AdminPagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "content_editor"].includes(profile.role)) {
    redirect("/dashboard");
  }

  const { data: pages } = await supabase
    .from("page_content")
    .select("*")
    .order("slug");

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-brand-primary">Pages</h1>
        <Button
          className="bg-brand-primary hover:bg-brand-primary/90 text-white"
          nativeButton={false}
          render={<Link href="/admin/pages/new/edit" />}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Page
        </Button>
      </div>

      {pages && pages.length > 0 ? (
        <div className="space-y-3">
          {(pages as PageContent[]).map((page) => (
            <Link key={page.slug} href={`/admin/pages/${page.slug}/edit`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="py-4 flex items-center gap-4">
                  <FileText className="h-5 w-5 text-brand-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold truncate">{page.title}</p>
                    <p className="text-sm text-muted-foreground">/{page.slug}</p>
                  </div>
                  <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
                    {page.updated_at
                      ? new Date(page.updated_at).toLocaleDateString()
                      : "—"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              No pages yet. Create your first page to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

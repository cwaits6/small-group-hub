import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/config";

export const metadata = { title: `Lecture Series | Admin | ${siteConfig.name}` };

export default async function AdminSeriesPage() {
  const supabase = await createClient();

  const { data: series } = await supabase
    .from("lecture_series")
    .select("*, lectures(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-brand-primary">Lecture Series</h1>
        <Link
          href="/admin/lectures/series/new"
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
        >
          New series
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Series</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Series</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Teacher</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Lectures</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Status</th>
                  <th className="pb-3 font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {(series ?? []).map((s) => {
                  const count = (s.lectures as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 font-medium text-foreground">{s.name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.teacher ?? "—"}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{count}</td>
                      <td className="py-3 pr-4">
                        {(s as unknown as { is_archived: boolean }).is_archived ? (
                          <span className="text-xs font-medium text-muted-foreground">Archived</span>
                        ) : (
                          <span className="text-xs font-medium text-green-700">Active</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-4">
                          <Link
                            href={`/admin/lectures/new?series=${s.id}`}
                            className="text-brand-primary hover:underline font-medium text-sm"
                          >
                            + Add lecture
                          </Link>
                          <Link
                            href={`/admin/lectures/series/${s.id}/edit`}
                            className="text-muted-foreground hover:underline font-medium text-sm"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(!series || series.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No series yet.{" "}
                      <Link href="/admin/lectures/series/new" className="text-brand-primary hover:underline">
                        Create one →
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Link
          href="/admin/lectures"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          ← Back to Lectures
        </Link>
      </div>
    </div>
  );
}

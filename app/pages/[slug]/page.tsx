import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { PageRenderer } from "./PageRenderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("page_content")
    .select("title")
    .eq("slug", slug)
    .single();

  return {
    title: data ? `${data.title} | ${siteConfig.name}` : "Page Not Found",
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("page_content")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!page) notFound();

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-8">
        {page.title}
      </h1>
      <PageRenderer body={page.body} />
    </div>
  );
}

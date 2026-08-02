import { redirect } from "next/navigation";
import { getPlatformAdmin } from "@/lib/platform-access";
import { PlatformSidebarNav } from "./PlatformSidebarNav";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate layer 2 of 4 (middleware, this layout, each page, each route
  // handler). Layouts do not re-run on every soft navigation, so the pages
  // and handlers repeat the check rather than trusting this one.
  const user = await getPlatformAdmin();
  if (!user) redirect("/dashboard");

  return (
    <div className="flex min-w-0 flex-1 flex-col md:flex-row">
      <PlatformSidebarNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

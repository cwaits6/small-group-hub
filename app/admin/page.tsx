import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Megaphone, BookOpen, Settings, Clock } from "lucide-react";

export const metadata = { title: "Admin | Incouragers" };

export default async function AdminPage() {
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

  if (profile?.role !== "admin") redirect("/dashboard");

  // Get stats
  const { count: pendingRequests } = await supabase
    .from("access_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: totalMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .in("role", ["member", "admin"]);

  const { count: upcomingEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .gte("start_time", new Date().toISOString());

  const { count: publishedAnnouncements } = await supabase
    .from("announcements")
    .select("*", { count: "exact", head: true })
    .eq("is_published", true);

  const adminLinks = [
    {
      href: "/admin/members",
      label: "Members",
      description: "Manage members and access requests",
      icon: Users,
      badge: pendingRequests ? `${pendingRequests} pending` : undefined,
    },
    {
      href: "/admin/events/new",
      label: "Create Event",
      description: "Add a new event",
      icon: Calendar,
    },
    {
      href: "/admin/announcements/new",
      label: "New Announcement",
      description: "Post an announcement",
      icon: Megaphone,
    },
    {
      href: "/admin/lectures/new",
      label: "Add Lecture",
      description: "Add a lecture recording",
      icon: BookOpen,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      description: "Donation URL and other settings",
      icon: Settings,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl md:text-4xl font-bold text-amber-900 mb-10">
        Admin Dashboard
      </h1>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-muted-foreground">Pending Requests</p>
                <p className="text-3xl font-bold text-amber-900">{pendingRequests || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-muted-foreground">Total Members</p>
                <p className="text-3xl font-bold text-amber-900">{totalMembers || 0}</p>
              </div>
              <Users className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-muted-foreground">Upcoming Events</p>
                <p className="text-3xl font-bold text-amber-900">{upcomingEvents || 0}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-muted-foreground">Announcements</p>
                <p className="text-3xl font-bold text-amber-900">{publishedAnnouncements || 0}</p>
              </div>
              <Megaphone className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <h2 className="text-2xl font-bold text-amber-900 mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <link.icon className="h-6 w-6 text-amber-700" />
                  {link.badge && (
                    <Badge variant="destructive" className="text-sm">
                      {link.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{link.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base text-muted-foreground">{link.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

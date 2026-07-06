import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { toDateString, upcomingSundays } from "@/lib/serving/sundays";
import { AdminServingSetup } from "@/components/serving/AdminServingSetup";
import type { MemberGroup, ServingTeamSettings } from "@/lib/types";

export const metadata = { title: `Serving | ${siteConfig.name}` };

type SettingsWithGroup = ServingTeamSettings & {
  member_groups: Pick<MemberGroup, "id" | "name" | "description" | "color"> | null;
};

export default async function ServingPage() {
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

  if (!profile || profile.role === "pending") redirect("/dashboard");
  const isAdmin = profile.role === "admin";

  const [{ data: settingsRows }, { data: memberships }] = await Promise.all([
    supabase
      .from("serving_team_settings")
      .select("*, member_groups(id, name, description, color)")
      .eq("enabled", true),
    supabase
      .from("profile_groups")
      .select("group_id, is_leader")
      .eq("profile_id", user.id),
  ]);

  const membershipMap = new Map(
    (memberships ?? []).map((m) => [m.group_id, m.is_leader as boolean])
  );
  const teams = ((settingsRows ?? []) as SettingsWithGroup[]).filter(
    (s) => s.member_groups && (isAdmin || membershipMap.has(s.group_id))
  );

  // Coverage counts for each team's upcoming window
  const today = toDateString(new Date());
  const coverage = new Map<string, number>();
  if (teams.length > 0) {
    const { data: signups } = await supabase
      .from("serving_signups")
      .select("group_id, service_date")
      .in(
        "group_id",
        teams.map((t) => t.group_id)
      )
      .gte("service_date", today);

    for (const team of teams) {
      const window = new Set(upcomingSundays(team.window_weeks));
      coverage.set(
        team.group_id,
        (signups ?? []).filter(
          (s) => s.group_id === team.group_id && window.has(s.service_date)
        ).length
      );
    }
  }

  // Teams admins could still turn on
  let candidateGroups: Pick<MemberGroup, "id" | "name" | "color">[] = [];
  if (isAdmin) {
    const { data: allGroups } = await supabase
      .from("member_groups")
      .select("id, name, color")
      .order("display_order");
    const enabledIds = new Set(teams.map((t) => t.group_id));
    candidateGroups = (allGroups ?? []).filter((g) => !enabledIds.has(g.id));
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Serving
      </h1>
      <p className="text-lg text-muted-foreground mb-10">
        Take a Sunday to serve — sign up in one tap and we&apos;ll remind you
        when it&apos;s close.
      </p>

      {teams.length > 0 ? (
        <div className="space-y-4">
          {teams.map((team) => {
            const group = team.member_groups!;
            const covered = coverage.get(team.group_id) ?? 0;
            const isLeader = membershipMap.get(team.group_id) === true;
            const isMember = membershipMap.has(team.group_id);
            return (
              <Link key={team.group_id} href={`/serving/${team.group_id}`}>
                <Card className="mb-4 hover:border-brand-primary/50 transition-colors">
                  <CardContent className="py-5 flex items-center gap-4">
                    <span
                      className="inline-block w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: group.color ?? "#2F6BA8" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-semibold flex items-center gap-2">
                        {group.name}
                        {isLeader && (
                          <span className="text-xs font-medium uppercase tracking-wider text-brand-accent border border-brand-accent/40 rounded px-1.5 py-0.5">
                            Leader
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {covered} of the next {team.window_weeks} Sundays covered
                        {isMember && !isLeader ? " · You're on this team" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-6 w-6 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-xl text-muted-foreground">
          No serving teams are set up yet.
        </p>
      )}

      {isAdmin && candidateGroups.length > 0 && (
        <AdminServingSetup groups={candidateGroups} />
      )}
    </div>
  );
}

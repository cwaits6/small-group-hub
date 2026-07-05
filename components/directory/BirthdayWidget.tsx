"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { displayName, initials } from "@/lib/names";
import type { DirectoryProfile, FamilyDirectoryFull } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface BirthdayEntry {
  key: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  month: number;
  day: number;
  type: "birthday" | "anniversary";
  daysUntil: number;
  isClassMember: boolean;
}

function daysUntilNextOccurrence(month: number, day: number, today: Date): number {
  const year = today.getFullYear();
  const thisYear = new Date(year, month - 1, day);
  if (thisYear >= today) {
    return Math.floor((thisYear.getTime() - today.getTime()) / 86400000);
  }
  const nextYear = new Date(year + 1, month - 1, day);
  return Math.floor((nextYear.getTime() - today.getTime()) / 86400000);
}

function formatDaysUntil(days: number): string {
  if (days === 0) return "Today!";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

interface BirthdayWidgetProps {
  members: DirectoryProfile[];
  families: FamilyDirectoryFull[];
}

export function BirthdayWidget({ members, families }: BirthdayWidgetProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [includeNonClassMembers, setIncludeNonClassMembers] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean | null>(null); // null = auto
  // 1-12 when browsing a specific month; null = default upcoming view
  const [browseMonth, setBrowseMonth] = useState<number | null>(null);

  const entries = useMemo<BirthdayEntry[]>(() => {
    const result: BirthdayEntry[] = [];

    // Collect birthdays from auth profiles
    for (const m of members) {
      if (!m.birth_month || !m.birth_day) continue;
      result.push({
        key: `profile-${m.id}`,
        name: displayName(m),
        avatarUrl: m.avatar_url,
        initials: initials(m),
        month: m.birth_month,
        day: m.birth_day,
        type: "birthday",
        daysUntil: daysUntilNextOccurrence(m.birth_month, m.birth_day, today),
        isClassMember: true,
      });
    }

    // Collect birthdays / anniversaries from family member records
    for (const family of families) {
      // Family members (non-auth lightweight records)
      for (const fm of family.family_members_list) {
        if (!fm.birth_month || !fm.birth_day) continue;
        result.push({
          key: `fm-${fm.id}`,
          name: [fm.first_name, fm.last_name].filter(Boolean).join(" "),
          avatarUrl: fm.avatar_url,
          initials: ((fm.first_name?.charAt(0) || "") + (fm.last_name?.charAt(0) || "")).toUpperCase() || "?",
          month: fm.birth_month,
          day: fm.birth_day,
          type: "birthday",
          daysUntil: daysUntilNextOccurrence(fm.birth_month, fm.birth_day, today),
          isClassMember: fm.is_class_member,
        });
      }

      // Family anniversary — only if spouse exists in household
      const hasSpouse =
        family.members.some((m) => m.relationship === "spouse") ||
        family.family_members_list.some((fm) => fm.relationship === "spouse");
      if (family.anniversary && hasSpouse) {
        const d = new Date(family.anniversary + "T00:00:00");
        const annMonth = d.getMonth() + 1;
        const annDay = d.getDate();
        result.push({
          key: `ann-${family.id}`,
          name: `${family.family_name} Anniversary`,
          avatarUrl: null,
          initials: family.family_name.charAt(0).toUpperCase(),
          month: annMonth,
          day: annDay,
          type: "anniversary",
          daysUntil: daysUntilNextOccurrence(annMonth, annDay, today),
          isClassMember: true,
        });
      }
    }

    return result;
  }, [members, families, today]);

  const currentMonth = today.getMonth() + 1;

  const filtered = useMemo(
    () =>
      includeNonClassMembers
        ? entries
        : entries.filter((e) => e.isClassMember),
    [entries, includeNonClassMembers],
  );

  const thisWeek = useMemo(
    () =>
      filtered
        .filter((e) => e.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [filtered],
  );

  const thisMonth = useMemo(() => {
    const todayDay = new Date().getDate();
    return filtered
      .filter((e) => e.month === currentMonth && e.daysUntil > 7 && e.day >= todayDay)
      .sort((a, b) => a.day - b.day);
  }, [filtered, currentMonth]);

  // Full list for a browsed month
  const browsedEntries = useMemo(() => {
    if (browseMonth === null) return [];
    return filtered
      .filter((e) => e.month === browseMonth)
      .sort((a, b) => a.day - b.day);
  }, [filtered, browseMonth]);

  function stepMonth(delta: number) {
    const base = browseMonth ?? currentMonth;
    let next = base + delta;
    if (next < 1) next = 12;
    if (next > 12) next = 1;
    setBrowseMonth(next === currentMonth ? null : next);
    setCollapsed(false);
  }

  const hasEvents = thisWeek.length > 0 || thisMonth.length > 0;

  // Auto-expand if there are events this week, auto-collapse otherwise.
  const isCollapsed = collapsed !== null ? collapsed : !hasEvents || thisWeek.length === 0;

  if (!hasEvents && isCollapsed) {
    // Show minimal collapsed state when no events
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Birthdays &amp; Anniversaries</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Birthdays &amp; Anniversaries</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="include-family"
                checked={includeNonClassMembers}
                onCheckedChange={setIncludeNonClassMembers}
              />
              <Label
                htmlFor="include-family"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Include all family members
              </Label>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="space-y-4">
            {/* Month navigator */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => stepMonth(-1)}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-28 text-center">
                {browseMonth === null
                  ? "Upcoming"
                  : MONTH_NAMES[browseMonth - 1]}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => stepMonth(1)}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {browseMonth !== null && (
                <button
                  type="button"
                  onClick={() => setBrowseMonth(null)}
                  className="text-xs text-brand-primary hover:underline ml-2"
                >
                  Back to upcoming
                </button>
              )}
            </div>

            {browseMonth !== null ? (
              browsedEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No birthdays or anniversaries in{" "}
                  {MONTH_NAMES[browseMonth - 1]}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {browsedEntries.map((entry) => (
                    <span key={entry.key} className="text-sm text-muted-foreground">
                      {entry.type === "anniversary" ? "💍" : "🎂"}{" "}
                      <span className="font-medium text-foreground">
                        {entry.name}
                      </span>{" "}
                      ({MONTH_NAMES[entry.month - 1]} {entry.day})
                    </span>
                  ))}
                </div>
              )
            ) : (
              <>
            {thisWeek.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  This Week
                </p>
                <div className="space-y-2">
                  {thisWeek.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {entry.avatarUrl && (
                          <AvatarImage src={entry.avatarUrl} alt={entry.name} />
                        )}
                        <AvatarFallback className="bg-brand-primary text-white text-xs">
                          {entry.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{entry.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {entry.type === "anniversary" ? "💍" : "🎂"}{" "}
                          {MONTH_NAMES[entry.month - 1]} {entry.day}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium shrink-0 ${
                          entry.daysUntil === 0
                            ? "text-brand-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formatDaysUntil(entry.daysUntil)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {thisMonth.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  This Month
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {thisMonth.map((entry) => (
                    <span key={entry.key} className="text-sm text-muted-foreground">
                      {entry.type === "anniversary" ? "💍" : "🎂"}{" "}
                      <span className="font-medium text-foreground">
                        {entry.name}
                      </span>{" "}
                      ({MONTH_NAMES[entry.month - 1]} {entry.day})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!hasEvents && (
              <p className="text-sm text-muted-foreground">
                No birthdays or anniversaries this month.
              </p>
            )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

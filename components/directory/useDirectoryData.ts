"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DirectoryGroup } from "@/components/directory/types";
import type { DirectoryProfile, FamilyDirectoryFull } from "@/lib/types";

/**
 * Loads the three directory data sources (member profiles, households,
 * groups) and derives the lookup maps shared by all directory sub-pages.
 */
export function useDirectoryData() {
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [families, setFamilies] = useState<FamilyDirectoryFull[]>([]);
  const [groups, setGroups] = useState<DirectoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const [{ data: m, error: mErr }, { data: f, error: fErr }, { data: g, error: gErr }] =
        await Promise.all([
          supabase
            .from("profiles_directory")
            .select("*")
            .order("last_name", { ascending: true }),
          supabase
            .from("families_directory_full")
            .select("*")
            .order("family_name", { ascending: true }),
          supabase
            .from("member_groups")
            .select("id, name, color, icon, description, show_in_directory_filter")
            .order("display_order"),
        ]);

      if (mErr || fErr || gErr) {
        const err = mErr ?? fErr ?? gErr;
        console.error("directory load error:", {
          source: mErr
            ? "profiles_directory"
            : fErr
              ? "families_directory_full"
              : "member_groups",
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
        });
        setLoading(false);
        return;
      }

      setMembers((m || []) as DirectoryProfile[]);
      setFamilies((f || []) as FamilyDirectoryFull[]);
      setGroups((g || []) as DirectoryGroup[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const profileMap = useMemo(() => {
    const map: Record<string, DirectoryProfile> = {};
    members.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, [members]);

  const familyMap = useMemo(() => {
    const map: Record<string, FamilyDirectoryFull> = {};
    families.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [families]);

  // Roster per group, derived from listed members' group chips
  const groupRosters = useMemo(() => {
    const map: Record<string, DirectoryProfile[]> = {};
    for (const m of members) {
      for (const g of m.groups || []) {
        (map[g.id] ??= []).push(m);
      }
    }
    return map;
  }, [members]);

  return { members, families, groups, loading, profileMap, familyMap, groupRosters };
}

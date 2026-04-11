"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Phone, Mail, MapPin, Calendar, Briefcase, Home } from "lucide-react";
import { formatPhone } from "@/lib/sanitize";
import { displayName, initials } from "@/lib/names";
import type { DirectoryProfile, DirectoryFamily } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatBirthday(m: DirectoryProfile): string | null {
  if (!m.birth_month || !m.birth_day) return null;
  const monthName = MONTH_NAMES[m.birth_month - 1];
  return `${monthName} ${m.birth_day}${m.birth_year ? `, ${m.birth_year}` : ""}`;
}

function formatAnniversary(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Merged view of a member's contact info with family fallback. */
function resolveAddress(
  member: DirectoryProfile,
  family: DirectoryFamily | null,
) {
  const line1 = member.address_line1 ?? family?.address_line1 ?? null;
  const line2 = member.address_line2 ?? family?.address_line2 ?? null;
  const city = member.city ?? family?.city ?? null;
  const state = member.state ?? family?.state ?? null;
  const postal = member.postal_code ?? family?.postal_code ?? null;
  if (!line1 && !city) return null;
  return { line1, line2, city, state, postal };
}

export default function DirectoryPage() {
  const [members, setMembers] = useState<DirectoryProfile[]>([]);
  const [families, setFamilies] = useState<Record<string, DirectoryFamily>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<DirectoryProfile | null>(null);
  const [view, setView] = useState<"people" | "families">("people");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: f }] = await Promise.all([
        supabase
          .from("profiles_directory")
          .select("*")
          .order("last_name", { ascending: true }),
        supabase.from("families_directory").select("*"),
      ]);

      setMembers((m || []) as DirectoryProfile[]);
      const familyMap: Record<string, DirectoryFamily> = {};
      (f || []).forEach((fam) => {
        familyMap[fam.id] = fam as DirectoryFamily;
      });
      setFamilies(familyMap);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const haystack = [
        m.first_name,
        m.last_name,
        m.preferred_name,
        m.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [members, query]);

  const byFamily = useMemo(() => {
    const grouped: Record<string, DirectoryProfile[]> = {};
    const solo: DirectoryProfile[] = [];
    filtered.forEach((m) => {
      if (m.family_id) {
        (grouped[m.family_id] ??= []).push(m);
      } else {
        solo.push(m);
      }
    });
    return { grouped, solo };
  }, [filtered]);

  const selectedFamily = selected?.family_id
    ? families[selected.family_id] || null
    : null;
  const selectedAddress = selected ? resolveAddress(selected, selectedFamily) : null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading directory...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <h1 className="text-3xl md:text-4xl font-bold text-brand-primary mb-2">
        Member Directory
      </h1>
      <p className="text-base text-muted-foreground mb-6">
        Browse and connect with other members in your class.
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 text-base py-5"
        />
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "people" | "families")}>
        <TabsList className="mb-4">
          <TabsTrigger value="people">People ({filtered.length})</TabsTrigger>
          <TabsTrigger value="families">
            Families ({Object.keys(byFamily.grouped).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people">
          {filtered.length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-8">
              No members match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m)}
                  className="text-left"
                >
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14">
                          {m.avatar_url && (
                            <AvatarImage src={m.avatar_url} alt={displayName(m)} />
                          )}
                          <AvatarFallback className="bg-brand-primary text-white">
                            {initials(m)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {displayName(m)}
                          </p>
                          {m.phone_mobile && (
                            <p className="text-sm text-muted-foreground truncate">
                              {formatPhone(m.phone_mobile)}
                            </p>
                          )}
                          {!m.phone_mobile && m.email && (
                            <p className="text-sm text-muted-foreground truncate">
                              {m.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="families">
          {Object.keys(byFamily.grouped).length === 0 ? (
            <p className="text-base text-muted-foreground text-center py-8">
              No family households yet.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byFamily.grouped)
                .sort(([a], [b]) => {
                  const nameA = families[a]?.family_name || "";
                  const nameB = families[b]?.family_name || "";
                  return nameA.localeCompare(nameB);
                })
                .map(([familyId, memberList]) => {
                  const fam = families[familyId];
                  if (!fam) return null;
                  return (
                    <Card key={familyId}>
                      <CardContent className="pt-6">
                        <p className="text-xl font-semibold text-brand-primary">
                          {fam.family_name}
                        </p>
                        {fam.address_line1 && (
                          <p className="text-sm text-muted-foreground">
                            {fam.address_line1}
                            {fam.city && `, ${fam.city}`}
                            {fam.state && `, ${fam.state}`}
                            {fam.postal_code && ` ${fam.postal_code}`}
                          </p>
                        )}
                        {fam.phone_home && (
                          <p className="text-sm text-muted-foreground">
                            Home: {formatPhone(fam.phone_home)}
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                          {memberList.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelected(m)}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-brand-bg-light transition-colors text-left"
                            >
                              <Avatar className="h-10 w-10">
                                {m.avatar_url && (
                                  <AvatarImage
                                    src={m.avatar_url}
                                    alt={displayName(m)}
                                  />
                                )}
                                <AvatarFallback className="bg-brand-primary text-white text-sm">
                                  {initials(m)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {displayName(m)}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Member detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {selected.avatar_url && (
                      <AvatarImage
                        src={selected.avatar_url}
                        alt={displayName(selected)}
                      />
                    )}
                    <AvatarFallback className="bg-brand-primary text-white text-xl">
                      {initials(selected)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">
                      {displayName(selected)}
                    </DialogTitle>
                    {selected.preferred_name &&
                      selected.first_name &&
                      selected.preferred_name !== selected.first_name && (
                        <p className="text-sm text-muted-foreground">
                          ({selected.first_name} {selected.last_name})
                        </p>
                      )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {selected.bio && (
                  <p className="text-base italic">{selected.bio}</p>
                )}

                {selected.phone_mobile && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${selected.phone_mobile}`}
                      className="text-base text-brand-primary hover:underline"
                    >
                      {formatPhone(selected.phone_mobile)}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      mobile
                    </span>
                  </div>
                )}

                {selected.phone_home && (
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${selected.phone_home}`}
                      className="text-base text-brand-primary hover:underline"
                    >
                      {formatPhone(selected.phone_home)}
                    </a>
                    <span className="text-xs text-muted-foreground">home</span>
                  </div>
                )}

                {!selected.phone_home && selectedFamily?.phone_home && (
                  <div className="flex items-center gap-3">
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${selectedFamily.phone_home}`}
                      className="text-base text-brand-primary hover:underline"
                    >
                      {formatPhone(selectedFamily.phone_home)}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      family home
                    </span>
                  </div>
                )}

                {selected.phone_work && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${selected.phone_work}`}
                      className="text-base text-brand-primary hover:underline"
                    >
                      {formatPhone(selected.phone_work)}
                    </a>
                    <span className="text-xs text-muted-foreground">work</span>
                  </div>
                )}

                {selected.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={`mailto:${selected.email}`}
                      className="text-base text-brand-primary hover:underline break-all"
                    >
                      {selected.email}
                    </a>
                  </div>
                )}

                {selectedAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <div className="text-base">
                      <p>{selectedAddress.line1}</p>
                      {selectedAddress.line2 && <p>{selectedAddress.line2}</p>}
                      <p>
                        {selectedAddress.city}
                        {selectedAddress.state && `, ${selectedAddress.state}`}
                        {selectedAddress.postal && ` ${selectedAddress.postal}`}
                      </p>
                    </div>
                  </div>
                )}

                {formatBirthday(selected) && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-base">
                      Birthday: {formatBirthday(selected)}
                    </span>
                  </div>
                )}

                {selected.anniversary && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-base">
                      Anniversary: {formatAnniversary(selected.anniversary)}
                    </span>
                  </div>
                )}

                {(selected.occupation || selected.employer) && (
                  <div className="flex items-start gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    <div className="text-base">
                      {selected.occupation && <p>{selected.occupation}</p>}
                      {selected.employer && (
                        <p className="text-sm text-muted-foreground">
                          {selected.employer}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

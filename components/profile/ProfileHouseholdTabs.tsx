"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MyProfileView } from "@/components/profile/MyProfileView";
import { HouseholdClient } from "@/components/household/HouseholdClient";
import { HOUSEHOLD_TAB } from "@/lib/profileTabs";
import type { HouseholdSummary } from "@/lib/household";
import type { FamilyMember, FamilyUnit, Profile } from "@/lib/types";

interface ProfileHouseholdTabsProps {
  profile: Profile;
  family: FamilyUnit | null;
  householdProfiles: (Profile | HouseholdSummary)[];
  familyMembers: FamilyMember[];
}

function ProfileHouseholdTabsInner({
  profile,
  family,
  householdProfiles,
  familyMembers,
}: ProfileHouseholdTabsProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(
    searchParams.get("tab") === HOUSEHOLD_TAB ? HOUSEHOLD_TAB : "me",
  );

  // Without a family there is no household to manage — just the self-edit view.
  if (!family) {
    return <MyProfileView profile={profile} family={null} />;
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
      <TabsList className="mb-6">
        <TabsTrigger value="me" className="text-base px-6">
          Me
        </TabsTrigger>
        <TabsTrigger value={HOUSEHOLD_TAB} className="text-base px-6">
          Household
        </TabsTrigger>
      </TabsList>

      <TabsContent value="me">
        <MyProfileView profile={profile} family={family} />
      </TabsContent>
      <TabsContent value={HOUSEHOLD_TAB}>
        <HouseholdClient
          currentProfile={profile}
          family={family}
          initialFamilyMembers={familyMembers}
          householdProfiles={householdProfiles}
          onEditSelf={() => setActiveTab("me")}
        />
      </TabsContent>
    </Tabs>
  );
}

export function ProfileHouseholdTabs(props: ProfileHouseholdTabsProps) {
  return (
    <Suspense fallback={null}>
      <ProfileHouseholdTabsInner {...props} />
    </Suspense>
  );
}

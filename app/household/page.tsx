import { redirect } from "next/navigation";
import { HOUSEHOLD_TAB } from "@/lib/profileTabs";

export default function HouseholdPage() {
  redirect(`/profile?tab=${HOUSEHOLD_TAB}`);
}

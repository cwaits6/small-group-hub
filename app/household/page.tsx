import { redirect } from "next/navigation";

export default function HouseholdPage() {
  redirect("/profile?tab=household");
}

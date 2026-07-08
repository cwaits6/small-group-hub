"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

/** Admin toggle: may members put up and manage their own giving links? */
export function ManageModeToggle({ stewardsCanManage }: { stewardsCanManage: boolean }) {
  const [on, setOn] = useState(stewardsCanManage);
  const router = useRouter();
  const supabase = createClient();

  async function toggle(next: boolean) {
    setOn(next);
    const { error } = await supabase.from("site_settings").upsert({
      key: "giving_manage_mode",
      value: next ? "stewards" : "admins",
      updated_at: new Date().toISOString(),
    });
    if (error) {
      setOn(!next);
      toast.error("Failed to update the setting.");
      return;
    }
    toast.success(
      next
        ? "Members can now put up their own giving links."
        : "Giving links are now admin-managed only."
    );
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <div>
        <Label htmlFor="giving-mode" className="text-base">
          Members can put up their own links
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">
          When off, only admins can create and edit giving funds. Existing
          funds stay visible either way.
        </p>
      </div>
      <Switch id="giving-mode" checked={on} onCheckedChange={toggle} />
    </div>
  );
}

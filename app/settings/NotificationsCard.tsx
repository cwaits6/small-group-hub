"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface NotificationsCardProps {
  userId: string;
  initialEmailAnnouncements: boolean;
}

export function NotificationsCard({
  userId,
  initialEmailAnnouncements,
}: NotificationsCardProps) {
  const [emailAnnouncements, setEmailAnnouncements] = useState(
    initialEmailAnnouncements,
  );
  const supabase = createClient();

  const handleChange = async (next: boolean) => {
    setEmailAnnouncements(next);
    const { error } = await supabase
      .from("profiles")
      .update({ email_announcements: next })
      .eq("id", userId);
    if (error) {
      console.error(error);
      setEmailAnnouncements(!next);
      toast.error("Couldn't save that. Please try again.");
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="mb-4">Notifications</h3>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="email-announcements" className="text-base font-semibold">
            Email me new announcements
          </Label>
          <Switch
            id="email-announcements"
            checked={emailAnnouncements}
            onCheckedChange={handleChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

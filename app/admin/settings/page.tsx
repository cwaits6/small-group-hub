"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SettingsMap {
  [key: string]: string;
}

const SETTINGS_LABELS: Record<string, string> = {
  donation_url: "Donation URL",
  venmo_url: "Venmo URL",
  directory_app_url: "Directory App URL",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("site_settings").select("*");
      if (data) {
        const map: SettingsMap = {};
        data.forEach((s) => {
          map[s.key] = s.value || "";
        });
        setSettings(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const updates = Object.entries(settings).map(([key, value]) =>
      supabase
        .from("site_settings")
        .update({
          value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("key", key)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    setSaving(false);

    if (hasError) {
      toast.error("Failed to save some settings.");
    } else {
      toast.success("Settings saved!");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <p className="text-xl text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-amber-900">Site Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {Object.entries(SETTINGS_LABELS).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key} className="text-lg">{label}</Label>
                <Input
                  id={key}
                  value={settings[key] || ""}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  placeholder={`Enter ${label.toLowerCase()}`}
                  className="text-lg py-6"
                />
              </div>
            ))}

            <Button
              type="submit"
              size="lg"
              className="w-full text-lg py-6 bg-amber-700 hover:bg-amber-800"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

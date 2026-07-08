"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MethodChip } from "@/components/giving/MethodButton";
import { METHOD_ORDER, PAYMENT_METHODS } from "@/lib/giving/methods";
import type { PaymentHandle, PaymentMethodKey } from "@/lib/types";

interface PaymentHandlesCardProps {
  profileId: string;
  handles: PaymentHandle[];
}

/**
 * A member's reusable payment usernames. They power any giving fund the
 * member stewards — funds pick these up automatically unless overridden.
 */
export function PaymentHandlesCard({ profileId, handles }: PaymentHandlesCardProps) {
  const [values, setValues] = useState<Record<PaymentMethodKey, string>>(() => {
    const v = {} as Record<PaymentMethodKey, string>;
    for (const key of METHOD_ORDER) {
      v[key] = handles.find((h) => h.method === key)?.handle ?? "";
    }
    return v;
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function save() {
    setSaving(true);
    const now = new Date().toISOString();
    const keep = METHOD_ORDER.filter((key) => values[key].trim());
    const drop = METHOD_ORDER.filter((key) => !values[key].trim());

    const upsert =
      keep.length > 0
        ? await supabase.from("payment_handles").upsert(
            keep.map((key) => ({
              profile_id: profileId,
              method: key,
              handle: values[key].trim(),
              updated_at: now,
            }))
          )
        : { error: null };
    const del =
      drop.length > 0
        ? await supabase
            .from("payment_handles")
            .delete()
            .eq("profile_id", profileId)
            .in("method", drop)
        : { error: null };

    setSaving(false);
    if (upsert.error || del.error) {
      toast.error("Failed to save payment handles.");
      return;
    }
    toast.success("Payment handles saved.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment handles</CardTitle>
        <p className="text-sm text-muted-foreground">
          Used when you collect money for the group — a snack fund, a retreat,
          flowers. Visible to members only, never public. Leave blank any you
          don&apos;t use.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {METHOD_ORDER.map((key) => {
          const meta = PAYMENT_METHODS[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <MethodChip method={meta} size="sm" />
              <Label htmlFor={`handle-${key}`} className="w-36 shrink-0 text-sm">
                {meta.name}
              </Label>
              <Input
                id={`handle-${key}`}
                value={values[key]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={meta.placeholder}
                maxLength={120}
                className="font-mono text-sm"
              />
            </div>
          );
        })}
        <div className="pt-2">
          <Button
            onClick={save}
            disabled={saving}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white"
          >
            {saving ? "Saving…" : "Save handles"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

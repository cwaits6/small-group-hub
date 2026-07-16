"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "./Segmented";

type TextSize = "normal" | "large" | "larger";

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "larger", label: "Larger" },
];

function persist(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing can block storage; the choice still applies this visit.
  }
}

export function DisplayCard() {
  const [textSize, setTextSize] = useState<TextSize>("normal");
  const [highContrast, setHighContrast] = useState(false);

  // The <head> script applied saved prefs before paint; sync state to it.
  useEffect(() => {
    const root = document.documentElement;
    const saved = root.dataset.textsize;
    if (saved === "large" || saved === "larger") setTextSize(saved);
    setHighContrast(root.dataset.contrast === "high");
  }, []);

  const applyTextSize = (size: TextSize) => {
    setTextSize(size);
    const root = document.documentElement;
    if (size === "normal") {
      delete root.dataset.textsize;
      persist("pref-textsize", null);
    } else {
      root.dataset.textsize = size;
      persist("pref-textsize", size);
    }
  };

  const applyContrast = (on: boolean) => {
    setHighContrast(on);
    const root = document.documentElement;
    if (on) {
      root.dataset.contrast = "high";
      persist("pref-contrast", "high");
    } else {
      delete root.dataset.contrast;
      persist("pref-contrast", null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <h3>Display</h3>

        <div className="space-y-2">
          <Label className="text-base">Text size</Label>
          <div>
            <Segmented
              label="Text size"
              options={TEXT_SIZE_OPTIONS}
              value={textSize}
              onChange={applyTextSize}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <div>
            <Label htmlFor="high-contrast" className="text-base font-semibold">
              Higher contrast
            </Label>
            <p className="text-sm text-muted-foreground">
              Darker text and stronger edges — easier to read.
            </p>
          </div>
          <Switch
            id="high-contrast"
            checked={highContrast}
            onCheckedChange={applyContrast}
          />
        </div>
      </CardContent>
    </Card>
  );
}

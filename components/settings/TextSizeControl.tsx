"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type TextSize = "normal" | "large" | "larger";

const options: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "larger", label: "Larger" },
];

export function TextSizeControl() {
  // Starts null (nothing highlighted) until mounted — the pre-paint script owns
  // the attribute before hydration, so reading it during render would mismatch.
  const [active, setActive] = useState<TextSize | null>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.textsize;
    setActive(current === "large" || current === "larger" ? current : "normal");
  }, []);

  const select = (value: TextSize) => {
    setActive(value);
    document.documentElement.setAttribute("data-textsize", value);
    try {
      localStorage.setItem("textsize", value);
    } catch {
      // Storage unavailable — the size still applies for this visit.
    }
  };

  return (
    <div role="group" aria-label="Text size" className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => select(option.value)}
          aria-pressed={active === option.value}
          className={cn(
            "min-h-[48px] px-5 rounded-lg border text-label font-medium transition-colors",
            active === option.value
              ? "bg-primary border-primary text-primary-foreground"
              : "bg-card border-border-strong text-foreground hover:bg-hover",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

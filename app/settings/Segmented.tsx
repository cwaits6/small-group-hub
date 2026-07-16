"use client";

interface SegmentedProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Word-labeled segmented control (design system .seg — never color alone) */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-input bg-card p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-lg px-5 text-base font-semibold transition-colors ${
              active
                ? "bg-brand-primary text-white"
                : "text-foreground hover:bg-brand-warm"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

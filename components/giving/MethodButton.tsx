"use client";

import { toast } from "sonner";
import { ArrowRight, Copy } from "lucide-react";
import { methodHref, type ResolvedMethod } from "@/lib/giving/methods";

/** Brand-tinted text chip for a payment method (no trademarked logos) */
export function MethodChip({
  method,
  size = "md",
}: {
  method: ResolvedMethod["meta"];
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${
        size === "sm" ? "h-7 w-7 text-sm" : "h-10 w-10 text-lg"
      }`}
      style={{ backgroundColor: method.color }}
    >
      {method.glyph}
    </span>
  );
}

/**
 * One payment option. Link methods (Venmo/PayPal/Cash App) open the payer's
 * own app in a new tab; copy methods (Zelle, Apple/Google Pay) copy the
 * handle to the clipboard since they have no public profile URLs.
 */
export function MethodButton({ resolved }: { resolved: ResolvedMethod }) {
  const { meta, handle } = resolved;
  const inner = (
    <>
      <MethodChip method={meta} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-base font-semibold text-foreground">
          {meta.name}
        </span>
        <span className="block truncate font-mono text-sm text-muted-foreground">
          {meta.prefix}
          {handle}
        </span>
      </span>
    </>
  );
  const frame =
    "flex w-full items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-brand-primary/50";

  if (meta.kind === "link") {
    return (
      <a
        href={methodHref(meta.key, handle)}
        target="_blank"
        rel="noopener noreferrer"
        className={frame}
      >
        {inner}
        <span
          className="flex shrink-0 items-center gap-1.5 text-sm font-bold"
          style={{ color: meta.color }}
        >
          {meta.verb}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className={frame}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(handle);
          toast.success(`Copied ${handle}`, {
            description: `Paste it in ${meta.name} to send.`,
          });
        } catch {
          toast.error("Couldn't copy — long-press the handle instead.");
        }
      }}
    >
      {inner}
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        Copy
      </span>
    </button>
  );
}

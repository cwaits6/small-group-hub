import { cn } from "@/lib/utils";

type PageContainerSize = "narrow" | "default" | "wide" | "full";

interface PageContainerProps {
  size?: PageContainerSize;
  className?: string;
  children: React.ReactNode;
}

const sizeClasses: Record<PageContainerSize, string> = {
  /** Forms and focused single-column flows */
  narrow: "max-w-2xl",
  /** Standard content pages */
  default: "max-w-4xl",
  /** Data-dense pages: tables, boards, wide grids */
  wide: "max-w-6xl",
  /** No width cap — page manages its own inner layout */
  full: "",
};

/**
 * Canonical page wrapper: one max-width scale, responsive gutters, and
 * standard vertical padding. Every page.tsx should use this instead of
 * hand-rolling `container mx-auto max-w-* px-4 py-12`.
 */
export function PageContainer({
  size = "default",
  className,
  children,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-12 sm:px-6 lg:px-8",
        size !== "full" && "container",
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

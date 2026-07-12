/** Loading placeholder shared by the directory sub-pages */
export function DirectoryListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 min-h-16 px-4 py-3 rounded-xl border border-border bg-card"
        >
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

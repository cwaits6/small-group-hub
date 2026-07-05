import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarClusterProps {
  people: Array<{ avatarUrl: string | null; name: string; initials: string }>;
}

/** Up to 3 overlapping avatars for a household row, with a +N overflow badge */
export function AvatarCluster({ people }: AvatarClusterProps) {
  const displayed = people.slice(0, 3);
  const overflow = people.length - displayed.length;
  return (
    <div className="flex -space-x-2">
      {displayed.map((p, i) => (
        <Avatar key={i} className="h-10 w-10 border-2 border-background">
          {p.avatarUrl && <AvatarImage src={p.avatarUrl} alt={p.name} />}
          <AvatarFallback className="bg-brand-primary text-white text-sm">
            {p.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar
          className="h-10 w-10 border-2 border-background"
          aria-label={`${overflow} more household member${overflow !== 1 ? "s" : ""}`}
        >
          <AvatarFallback className="bg-muted text-muted-foreground text-sm">
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

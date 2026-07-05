import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarClusterProps {
  people: Array<{ avatarUrl: string | null; name: string; initials: string }>;
}

/** Up to 3 overlapping avatars for a household row */
export function AvatarCluster({ people }: AvatarClusterProps) {
  const displayed = people.slice(0, 3);
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
    </div>
  );
}

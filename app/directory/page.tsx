import Link from "next/link";
import { Cake, ChevronRight, Heart, House, Users } from "lucide-react";
import type { ComponentType } from "react";

export const metadata = {
  title: "Directory",
};

const tiles: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}[] = [
  { href: "/directory/families", icon: House, title: "Families" },
  { href: "/directory/groups", icon: Users, title: "Groups" },
  { href: "/directory/birthdays", icon: Cake, title: "Birthdays" },
  { href: "/directory/anniversaries", icon: Heart, title: "Anniversaries" },
];

export default function DirectoryPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight text-foreground mb-8">
        Directory
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-7 hover:border-brand-primary transition-colors"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-warm">
              <tile.icon className="h-6 w-6 text-brand-primary" aria-hidden="true" />
            </span>
            <span className="text-xl font-bold text-foreground">{tile.title}</span>
            <ChevronRight
              className="ml-auto h-6 w-6 text-muted-foreground"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

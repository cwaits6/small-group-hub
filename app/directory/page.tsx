import Link from "next/link";
import { Cake, ChevronRight, Heart, House, Printer, Users } from "lucide-react";
import type { ComponentType } from "react";

export const metadata = {
  title: "Directory",
};

const tiles: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}[] = [
  {
    href: "/directory/families",
    icon: House,
    title: "Families",
    description: "Everyone in our group, A to Z by last name.",
  },
  {
    href: "/directory/groups",
    icon: Users,
    title: "Groups",
    description: "Teams, studies, and who's in each one.",
  },
  {
    href: "/directory/birthdays",
    icon: Cake,
    title: "Birthdays",
    description: "This month's birthdays and the months ahead.",
  },
  {
    href: "/directory/anniversaries",
    icon: Heart,
    title: "Anniversaries",
    description: "Wedding anniversaries through the year.",
  },
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
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-7 hover:border-brand-primary transition-colors"
          >
            <span className="flex items-center w-full">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-warm">
                <tile.icon className="h-6 w-6 text-brand-primary" aria-hidden="true" />
              </span>
              <ChevronRight
                className="ml-auto h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
            <span className="text-xl font-bold text-foreground">{tile.title}</span>
            <span className="text-base text-muted-foreground">{tile.description}</span>
          </Link>
        ))}
      </div>

      <Link
        href="/directory/print"
        className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand-primary underline underline-offset-4 hover:text-brand-primary/80"
      >
        <Printer className="h-4 w-4" aria-hidden="true" />
        Printable directory
      </Link>
    </div>
  );
}

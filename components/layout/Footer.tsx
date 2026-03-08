import { siteConfig } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t bg-stone-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-lg text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p className="text-base text-muted-foreground">
            {siteConfig.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}

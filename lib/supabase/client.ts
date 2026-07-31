import { createBrowserClient } from "@supabase/ssr";
import { resolveOrgSlug } from "@/lib/org";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Org resolution for anonymous requests (Phase 2, CWA-9): without
      // this header the anon join form's insert would fail closed —
      // app_request_org_id() would resolve no org. Authenticated sessions
      // ignore it (the principal's own org always wins).
      global: {
        headers: {
          "x-two42-org": resolveOrgSlug(
            typeof window !== "undefined" ? window.location.host : null
          ),
        },
      },
    }
  );
}

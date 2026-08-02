// Shared org-iteration primitive for the cron-triggered Edge Functions.
//
// Both reminder functions run with the service key, which carries BYPASSRLS —
// the Phase 2 org isolation policies do not constrain them. Tenant isolation
// therefore has to live in the query text: enumerate orgs here, then filter
// every downstream query on org_id explicitly.
//
// Deliberately free of any @supabase/supabase-js import so it can be unit
// tested offline against the structural type below.

export interface Org {
  id: string;
  name: string;
  slug: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** The narrow slice of the Supabase client this module needs. */
export interface OrgListClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        order(column: string): PromiseLike<QueryResult<Org>>;
      };
    };
  };
}

/**
 * Active organizations, ordered by slug for a stable, reproducible run order.
 * Suspended orgs are skipped — a suspended tenant must not email its members.
 * Throws on query failure: enumerating zero orgs because of an error is
 * indistinguishable from "no orgs" at the call site, and would silently make
 * the whole run a no-op.
 */
export async function listActiveOrgs(supabase: OrgListClient): Promise<Org[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("status", "active")
    .order("slug");
  if (error) throw new Error(`Failed to list organizations: ${error.message}`);
  return data ?? [];
}

export interface OrgRunResult {
  orgId: string;
  slug: string;
  sent: number;
  error?: string;
}

/**
 * Run `fn` once per org, sequentially, isolating failures: one org throwing is
 * logged with its slug and recorded, and the remaining orgs still run.
 * Sequential rather than parallel so outbound Resend volume stays at today's
 * rate instead of being multiplied by the org count.
 */
export async function forEachOrg(
  orgs: Org[],
  fn: (org: Org) => Promise<number>,
): Promise<OrgRunResult[]> {
  const results: OrgRunResult[] = [];
  for (const org of orgs) {
    try {
      results.push({ orgId: org.id, slug: org.slug, sent: await fn(org) });
    } catch (err) {
      console.error(`[org ${org.slug} ${org.id}] reminder run failed:`, err);
      results.push({
        orgId: org.id,
        slug: org.slug,
        sent: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export function summarize(results: OrgRunResult[]): {
  orgs: number;
  emailsSent: number;
  failed: Array<{ org: string; error: string }>;
} {
  return {
    orgs: results.length,
    emailsSent: results.reduce((n, r) => n + r.sent, 0),
    failed: results
      .filter((r) => r.error)
      .map((r) => ({ org: r.slug, error: r.error as string })),
  };
}

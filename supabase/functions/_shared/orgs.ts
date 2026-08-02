// Shared org-iteration primitive for the cron-triggered Edge Functions.
//
// Both reminder functions run with the service key, which carries BYPASSRLS —
// the Phase 2 org isolation policies do not constrain them. Tenant isolation
// therefore has to live in the query text: enumerate orgs here, then filter
// every downstream query on org_id explicitly.
//
// The one exception is a nested PostgREST embed — `.select("a, b(c)")` — which
// cannot take its own filter. Those are safe *because* the parent row was
// already org-filtered and every FK into an org-owned parent is composite
// (col, org_id), so an embed traversal cannot leave the tenant. That argument
// only holds while the parent is filtered: never embed from an unfiltered
// `.from(`.
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

/**
 * What a per-org runner reports back. `sendFailures` counts emails Resend
 * refused or that never left the function — without it, a run in which every
 * send failed is byte-identical to a legitimately quiet day, because a failed
 * send throws nothing and so never reaches `failed[]`.
 */
export interface OrgRunCounts {
  sent: number;
  sendFailures: number;
}

export interface OrgRunResult extends OrgRunCounts {
  orgId: string;
  slug: string;
  error?: string;
}

/**
 * Thrown by a per-org runner (runForOrg / runDaily / runMonthly) when it must
 * abort mid-run but has already sent some emails. Without this, a mid-loop
 * throw after N successful sends would still be recorded by forEachOrg as
 * `{ sent: 0, sendFailures: 0 }` — indistinguishable from an org that failed
 * before sending anything (CWA-49). Callers should accumulate `sent` /
 * `sendFailures` locally and throw this instead of a plain `Error` once any
 * email has gone out.
 */
export class OrgRunError extends Error {
  readonly sent: number;
  readonly sendFailures: number;

  constructor(message: string, counts: OrgRunCounts) {
    super(message);
    this.name = "OrgRunError";
    this.sent = counts.sent;
    this.sendFailures = counts.sendFailures;
  }
}

/**
 * Run `fn` once per org, sequentially, isolating failures: one org throwing is
 * logged with its slug and recorded, and the remaining orgs still run.
 * Sequential rather than parallel so outbound Resend concurrency stays at
 * today's rate instead of being multiplied by the org count.
 */
export async function forEachOrg(
  orgs: Org[],
  fn: (org: Org) => Promise<OrgRunCounts>,
): Promise<OrgRunResult[]> {
  const results: OrgRunResult[] = [];
  for (const org of orgs) {
    try {
      const { sent, sendFailures } = await fn(org);
      results.push({ orgId: org.id, slug: org.slug, sent, sendFailures });
    } catch (err) {
      console.error("[org %s %s] reminder run failed:", org.slug, org.id, err);
      // OrgRunError carries whatever was sent before the mid-run abort;
      // ordinary errors (nothing sent yet) fall back to zeroes.
      const counts: OrgRunCounts = err instanceof OrgRunError
        ? { sent: err.sent, sendFailures: err.sendFailures }
        : { sent: 0, sendFailures: 0 };
      results.push({
        orgId: org.id,
        slug: org.slug,
        ...counts,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/**
 * Roll per-org results into the HTTP response body.
 *
 * The invocation contract is deliberately **HTTP 200 even when every org
 * failed** — per-org failures are reported in `failed[]`, not in the status
 * code. Returning 5xx would make pg_cron retry a run that has already sent
 * real email to the orgs that succeeded, duplicating reminders to every
 * healthy tenant. Monitor `failed[]` and `emailsFailed`, not the status code;
 * a 500 means the run did not start (see the handler's catch).
 */
export function summarize(results: OrgRunResult[]): {
  orgs: number;
  emailsSent: number;
  emailsFailed: number;
  failed: Array<{ org: string; error: string }>;
} {
  return {
    orgs: results.length,
    emailsSent: results.reduce((n, r) => n + r.sent, 0),
    emailsFailed: results.reduce((n, r) => n + r.sendFailures, 0),
    failed: results
      .filter((r) => r.error)
      .map((r) => ({ org: r.slug, error: r.error as string })),
  };
}

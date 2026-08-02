// Unit tests for the org-iteration primitive. Pure units: no network, no
// database — the fake below satisfies OrgListClient structurally.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  forEachOrg,
  listActiveOrgs,
  summarize,
  type Org,
  type OrgListClient,
  type OrgRunResult,
} from "../_shared/orgs.ts";

interface RecordedQuery {
  from?: string;
  select?: string;
  eq?: [string, unknown];
  order?: string;
}

function makeFakeClient(result: {
  data: Org[] | null;
  error: { message: string } | null;
}): { client: OrgListClient; recorded: RecordedQuery } {
  const recorded: RecordedQuery = {};
  const client: OrgListClient = {
    from(table) {
      recorded.from = table;
      return {
        select(columns) {
          recorded.select = columns;
          return {
            eq(column, value) {
              recorded.eq = [column, value];
              return {
                order(column) {
                  recorded.order = column;
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, recorded };
}

const orgA: Org = { id: "a-id", name: "Org A", slug: "a" };
const orgB: Org = { id: "b-id", name: "Org B", slug: "b" };
const orgC: Org = { id: "c-id", name: "Org C", slug: "c" };

Deno.test("listActiveOrgs filters on status = active and orders by slug", async () => {
  const { client, recorded } = makeFakeClient({ data: [orgA, orgB], error: null });
  const orgs = await listActiveOrgs(client);
  assertEquals(recorded.from, "organizations");
  assertEquals(recorded.select, "id, name, slug");
  assertEquals(recorded.eq, ["status", "active"]);
  assertEquals(recorded.order, "slug");
  assertEquals(orgs, [orgA, orgB]);
});

Deno.test("listActiveOrgs throws when the query errors", async () => {
  const { client } = makeFakeClient({ data: null, error: { message: "boom" } });
  await assertRejects(
    () => listActiveOrgs(client),
    Error,
    "Failed to list organizations: boom",
  );
});

Deno.test("listActiveOrgs returns [] when data is null and there is no error", async () => {
  const { client } = makeFakeClient({ data: null, error: null });
  assertEquals(await listActiveOrgs(client), []);
});

Deno.test("forEachOrg runs every org and totals the counts", async () => {
  const seen: string[] = [];
  const results = await forEachOrg([orgA, orgB, orgC], (org) => {
    seen.push(org.slug);
    return Promise.resolve(seen.length * 10);
  });
  assertEquals(seen, ["a", "b", "c"]);
  assertEquals(results, [
    { orgId: "a-id", slug: "a", sent: 10 },
    { orgId: "b-id", slug: "b", sent: 20 },
    { orgId: "c-id", slug: "c", sent: 30 },
  ]);
});

Deno.test("forEachOrg continues after one org throws", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const seen: string[] = [];
    const results = await forEachOrg([orgA, orgB, orgC], (org) => {
      seen.push(org.slug);
      if (org.slug === "b") return Promise.reject(new Error("org b exploded"));
      return Promise.resolve(1);
    });
    assertEquals(seen, ["a", "b", "c"]);
    assertEquals(results[0], { orgId: "a-id", slug: "a", sent: 1 });
    assertEquals(results[1], {
      orgId: "b-id",
      slug: "b",
      sent: 0,
      error: "org b exploded",
    });
    assertEquals(results[2], { orgId: "c-id", slug: "c", sent: 1 });
  } finally {
    console.error = originalError;
  }
});

Deno.test("forEachOrg records non-Error throws", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const results = await forEachOrg([orgA], () => Promise.reject("plain string"));
    assertEquals(results, [
      { orgId: "a-id", slug: "a", sent: 0, error: "plain string" },
    ]);
  } finally {
    console.error = originalError;
  }
});

Deno.test("summarize totals sends and lists failures by slug", () => {
  const results: OrgRunResult[] = [
    { orgId: "a-id", slug: "a", sent: 5 },
    { orgId: "b-id", slug: "b", sent: 0, error: "org b exploded" },
    { orgId: "c-id", slug: "c", sent: 7 },
  ];
  assertEquals(summarize(results), {
    orgs: 3,
    emailsSent: 12,
    failed: [{ org: "b", error: "org b exploded" }],
  });
});

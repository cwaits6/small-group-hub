// The .in() id lists must stay under URL-length limits; chunk() is what
// enforces that. Losing or duplicating an id across chunks would silently
// drop or double a member's reminder.

import { assertEquals } from "jsr:@std/assert@1";
import { chunk } from "../_shared/chunk.ts";

Deno.test("chunk splits into full chunks plus a remainder", () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test("chunk preserves order and every element exactly once", () => {
  const items = Array.from({ length: 450 }, (_, i) => i);
  const chunks = chunk(items, 200);
  assertEquals(chunks.length, 3);
  assertEquals(chunks.flat(), items);
});

Deno.test("chunk of an empty list is an empty list", () => {
  assertEquals(chunk([], 200), []);
});

Deno.test("chunk smaller than size returns a single chunk", () => {
  assertEquals(chunk(["a"], 200), [["a"]]);
});

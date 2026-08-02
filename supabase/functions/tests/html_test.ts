// Locks the escaping contract both reminder emails rely on: member- and
// event-supplied strings must not survive as live markup in email HTML.

import { assertEquals } from "jsr:@std/assert@1";
import { escapeHtml } from "../_shared/html.ts";

Deno.test("escapeHtml neutralizes markup-significant characters", () => {
  assertEquals(
    escapeHtml(`<a href="https://evil.example">Click & 'win'</a>`),
    "&lt;a href=&quot;https://evil.example&quot;&gt;Click &amp; &#039;win&#039;&lt;/a&gt;",
  );
});

Deno.test("escapeHtml escapes & first so entities are not double-mangled", () => {
  assertEquals(escapeHtml("&lt;"), "&amp;lt;");
});

Deno.test("escapeHtml passes plain text through unchanged", () => {
  assertEquals(escapeHtml("Sunday Potluck 2026"), "Sunday Potluck 2026");
});

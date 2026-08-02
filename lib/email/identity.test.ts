// Unit tests for the RFC 5322 From: construction boundary (CWA-55). Pure
// units: formatFromHeader and parseAddress take strings to strings — no
// network, no database, no request context.

import { describe, expect, it } from "vitest";
import { formatFromHeader, parseAddress } from "@/lib/email/identity";

const ADDRESS = "noreply@example.org";

describe("formatFromHeader", () => {
  it("emits a plain name unquoted", () => {
    expect(formatFromHeader("two42", ADDRESS)).toBe(`two42 <${ADDRESS}>`);
  });

  it("keeps dots on the plain branch (PLAIN_NAME includes `.`)", () => {
    expect(formatFromHeader("Dr. Smith", ADDRESS)).toBe(`Dr. Smith <${ADDRESS}>`);
  });

  it("strips CR/LF unconditionally (header injection)", () => {
    const result = formatFromHeader("Evil\r\nBcc: attacker@evil.com", ADDRESS);
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    // The stripped remainder contains `:` and `@`, so it takes the quoted
    // branch — inert display text, not a second header.
    expect(result).toBe(`"EvilBcc: attacker@evil.com" <${ADDRESS}>`);
  });

  it("emits the bare address for empty and whitespace-only names", () => {
    expect(formatFromHeader("", ADDRESS)).toBe(ADDRESS);
    expect(formatFromHeader("   ", ADDRESS)).toBe(ADDRESS);
    expect(formatFromHeader("\r\n", ADDRESS)).toBe(ADDRESS);
  });

  it("quotes names outside the plain subset", () => {
    expect(formatFromHeader("Smith, Dr", ADDRESS)).toBe(`"Smith, Dr" <${ADDRESS}>`);
  });

  it("escapes double quotes inside the quoted string", () => {
    expect(formatFromHeader('Say "Hi"', ADDRESS)).toBe(`"Say \\"Hi\\"" <${ADDRESS}>`);
  });

  it("escapes backslashes inside the quoted string", () => {
    expect(formatFromHeader("a\\b", ADDRESS)).toBe(`"a\\\\b" <${ADDRESS}>`);
  });

  it("neutralizes an embedded-address injection attempt", () => {
    const result = formatFromHeader('Evil" <x@evil.com> "', ADDRESS);
    // The whole payload stays inside one quoted string; the only address a
    // parser finds at the tail is the real one.
    expect(parseAddress(result)).toBe(ADDRESS);
    expect(result.endsWith(`<${ADDRESS}>`)).toBe(true);
  });

  it("passes non-ASCII names through the quoted branch unmangled", () => {
    expect(formatFromHeader("Iglesia Café", ADDRESS)).toBe(`"Iglesia Café" <${ADDRESS}>`);
  });

  it("handles an oversized name without throwing and emits one address", () => {
    const huge = "x".repeat(10_000);
    const result = formatFromHeader(huge, ADDRESS);
    expect(result.split("<").length - 1).toBe(1);
    expect(result.endsWith(`<${ADDRESS}>`)).toBe(true);
  });
});

describe("parseAddress", () => {
  it("extracts the address from a display-name form", () => {
    expect(parseAddress(`two42 <${ADDRESS}>`)).toBe(ADDRESS);
  });

  it("returns a bare address unchanged", () => {
    expect(parseAddress("a@b.org")).toBe("a@b.org");
  });

  it("trims surrounding whitespace", () => {
    expect(parseAddress("  a@b.org  ")).toBe("a@b.org");
    expect(parseAddress("Name <x@y.z>   ")).toBe("x@y.z");
  });

  it("falls back to the whole trimmed input on nested/garbage angle brackets", () => {
    // `<([^<>]+)>` cannot match across the doubled closer, and the match is
    // anchored to the tail — so no partial address is invented.
    expect(parseAddress("a <b <c@d.e>>")).toBe("a <b <c@d.e>>");
  });
});

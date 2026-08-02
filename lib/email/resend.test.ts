// Unit tests for the HTML-escaping boundary in email bodies (CWA-55). Pure
// units — escapeHtml is a string transform; nothing here touches the Resend
// client (getResend() is lazy, so importing the module sends nothing).

import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/email/resend";

describe("escapeHtml", () => {
  it("escapes all five HTML entities", () => {
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
    expect(escapeHtml('"')).toBe("&quot;");
    expect(escapeHtml("'")).toBe("&#39;");
  });

  it("escapes & first so entities are not double-escaped", () => {
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
    // An already-escaped entity is re-escaped (correct: input is plain text).
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("neutralizes an XSS payload", () => {
    const escaped = escapeHtml('<img src=x onerror=alert(1)>');
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("leaves benign text untouched", () => {
    expect(escapeHtml("Grace Chapel — Sunday 9:30")).toBe("Grace Chapel — Sunday 9:30");
  });
});

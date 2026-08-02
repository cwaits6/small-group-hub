// Shared HTML escaping for email templates. All member- or event-supplied
// strings interpolated into email HTML must pass through this — Resend renders
// the markup as-is, so an unescaped event title or name is a live injection
// point into our own transactional template.

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

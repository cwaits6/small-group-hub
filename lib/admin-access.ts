// content_editor may reach the admin overview plus its two content pages;
// every other /admin/* path stays admin-only.
export const CONTENT_EDITOR_ADMIN_PATHS = ["/admin", "/admin/pages", "/admin/about"];

export function isContentEditorAllowed(pathname: string): boolean {
  return CONTENT_EDITOR_ADMIN_PATHS.some(
    (p) => pathname === p || (p !== "/admin" && pathname.startsWith(p + "/"))
  );
}

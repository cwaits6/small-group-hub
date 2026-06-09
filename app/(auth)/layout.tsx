/**
 * Auth route-group layout — intentionally minimal.
 * Omits the global Header / AppShell / Footer so that
 * the full-bleed two-column AuthShell design can take
 * over the entire viewport.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

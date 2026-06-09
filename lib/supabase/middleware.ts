import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// Narrow the CSP img-src allowlist to the specific Supabase project
// origin rather than a wildcard. Falls back empty if not configured.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

export async function updateSession(request: NextRequest) {
  // Generate a nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Create request headers with nonce for downstream RSC access
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Build CSP dynamically with nonce instead of unsafe-inline
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://maps.googleapis.com https://maps.gstatic.com blob:`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " http://127.0.0.1:* http://localhost:*" : ""}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://maps.googleapis.com https://places.googleapis.com https://maps.gstatic.com blob:${isDev ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*" : ""}`,
    "frame-src 'self' https://www.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src blob:",
    "manifest-src 'self'",
  ].join("; ");

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes - require authentication
  const protectedPaths = ["/dashboard", "/announcements", "/update-password", "/events", "/lectures"];
  const adminPaths = ["/admin"];

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAdmin = adminPaths.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Set CSP header on the response
  supabaseResponse.headers.set("Content-Security-Policy", cspHeader);

  return supabaseResponse;
}

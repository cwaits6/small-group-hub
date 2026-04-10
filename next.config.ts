import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-inline without nonce-based CSP middleware.
      // Do NOT add unsafe-eval — production builds don't need it, and it
      // opens the door to eval-based XSS. If something breaks, investigate
      // what's calling eval() rather than blanket-allowing it.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: https://*.supabase.co${isDev ? " http://127.0.0.1:* http://localhost:*" : ""}`,
      "font-src 'self'",
      // Supabase realtime + API, Vercel Analytics
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com${isDev ? " http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*" : ""}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // Restrict form submissions and worker scripts.
      "form-action 'self'",
      "worker-src 'none'",
      "manifest-src 'self'",
    ].join("; "),
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Incouragers",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "A welcoming community of faith, growing together in God's Word.",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE || "Encouraging one another daily",
  churchName:
    process.env.NEXT_PUBLIC_CHURCH_NAME || "First Redeemer Church",
  logoMonogram: process.env.NEXT_PUBLIC_LOGO_MONOGRAM || "I",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  email: {
    from:
      process.env.NEXT_PUBLIC_EMAIL_FROM ||
      "Incouragers <noreply@incouragers.org>",
  },
  colors: {
    primary: process.env.NEXT_PUBLIC_COLOR_PRIMARY || "#0d4f3c",
    primaryLight: process.env.NEXT_PUBLIC_COLOR_PRIMARY_LIGHT || "#059669",
    accent: process.env.NEXT_PUBLIC_COLOR_ACCENT || "#f43f5e",
    warm: process.env.NEXT_PUBLIC_COLOR_WARM || "#f59e0b",
    backgroundLight: process.env.NEXT_PUBLIC_COLOR_BG_LIGHT || "#ecfdf5",
    backgroundMuted: process.env.NEXT_PUBLIC_COLOR_BG_MUTED || "#d1fae5",
  },
};

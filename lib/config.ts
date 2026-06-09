export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Incouragers",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "A welcoming community of faith, growing together in God's Word.",
  tagline:
    process.env.NEXT_PUBLIC_APP_TAGLINE ||
    "To be the body of Christ through fellowship, discipleship and the faithful study of the Word of God.",
  churchName:
    process.env.NEXT_PUBLIC_CHURCH_NAME || "First Redeemer Church",
  brandLine:
    process.env.NEXT_PUBLIC_BRAND_LINE || "First Redeemer · Est. 2014",
  logoMonogram: process.env.NEXT_PUBLIC_LOGO_MONOGRAM || "I",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  email: {
    from:
      process.env.NEXT_PUBLIC_EMAIL_FROM ||
      "Incouragers <noreply@incouragers.org>",
  },
  colors: {
    primary: process.env.NEXT_PUBLIC_COLOR_PRIMARY || "#2F6BA8",
    primaryLight: process.env.NEXT_PUBLIC_COLOR_PRIMARY_LIGHT || "#3F506B",
    accent: process.env.NEXT_PUBLIC_COLOR_ACCENT || "#E8A93C",
    warm: process.env.NEXT_PUBLIC_COLOR_WARM || "#E2ECF7",
    backgroundLight: process.env.NEXT_PUBLIC_COLOR_BG_LIGHT || "#FAEBC2",
    backgroundMuted: process.env.NEXT_PUBLIC_COLOR_BG_MUTED || "#E5E0D4",
  },
};

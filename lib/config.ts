export const siteConfig = {
  name: "Incouragers",
  description: "A welcoming community of faith, growing together in God's Word.",
  tagline: "Encouraging one another daily",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  email: {
    from: "Incouragers <noreply@incouragers.org>",
  },
} as const;

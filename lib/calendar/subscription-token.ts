import crypto from "crypto";

/**
 * Sliding TTL: extended on every successful ICS fetch, so actively-polled
 * subscriptions never expire in practice, while abandoned or leaked links
 * go stale after this many days of disuse.
 */
export const SUBSCRIPTION_TOKEN_TTL_DAYS = 400;

export function hashSubscriptionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function subscriptionTokenExpiryDate(): string {
  return new Date(
    Date.now() + SUBSCRIPTION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

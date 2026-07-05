/**
 * Signed action links for serving emails. Lets members act straight from an
 * email without logging in (configurable — see lib/serving/config.ts).
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 * The Deno edge function (send-serving-reminders) mints tokens in the same
 * format — keep the payload shape in sync.
 */
import crypto from "crypto";

export interface ServingLinkPayload {
  v: 1;
  /** What the link does when confirmed */
  a: "signup" | "cancel";
  /** Group (team) id */
  g: string;
  /** Service date YYYY-MM-DD */
  d: string;
  /** Profile id the link acts on behalf of */
  p: string;
  /** Expiry, unix seconds */
  exp: number;
}

function getSecret(): string {
  const secret = process.env.SERVING_LINK_SECRET;
  if (!secret) {
    throw new Error("SERVING_LINK_SECRET is not set");
  }
  return secret;
}

function sign(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createServingToken(
  payload: Omit<ServingLinkPayload, "v" | "exp">,
  ttlDays = 60
): string {
  const full: ServingLinkPayload = {
    v: 1,
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const payloadB64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Returns the payload when the token is authentic and unexpired, else null. */
export function verifyServingToken(token: string): ServingLinkPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: ServingLinkPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.v !== 1) return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (payload.a !== "signup" && payload.a !== "cancel") return null;
  return payload;
}

import type { PaymentMethodKey } from "@/lib/types";

/**
 * Payment method metadata for the Give page.
 *
 * Two kinds: "link" methods (Venmo, PayPal, Cash App) deep-link straight into
 * the payer's app; "copy" methods (Zelle, Apple/Google Pay) have no public
 * profile URLs, so the handle is copied to the clipboard instead.
 *
 * Brand-tinted text chips only — no trademarked logos.
 */
export interface PaymentMethodMeta {
  key: PaymentMethodKey;
  name: string;
  color: string;
  glyph: string;
  kind: "link" | "copy";
  verb: string;
  /** Shown before the handle for context, e.g. "paypal.me/" */
  prefix: string;
  placeholder: string;
}

export const PAYMENT_METHODS: Record<PaymentMethodKey, PaymentMethodMeta> = {
  venmo: {
    key: "venmo",
    name: "Venmo",
    color: "#008CFF",
    glyph: "V",
    kind: "link",
    verb: "Open Venmo",
    prefix: "",
    placeholder: "@your-venmo",
  },
  paypal: {
    key: "paypal",
    name: "PayPal",
    color: "#0070BA",
    glyph: "P",
    kind: "link",
    verb: "Open PayPal",
    prefix: "paypal.me/",
    placeholder: "yourpaypalme",
  },
  cashapp: {
    key: "cashapp",
    name: "Cash App",
    color: "#00C244",
    glyph: "$",
    kind: "link",
    verb: "Open Cash App",
    prefix: "",
    placeholder: "$yourcashtag",
  },
  zelle: {
    key: "zelle",
    name: "Zelle",
    color: "#6D1ED4",
    glyph: "Z",
    kind: "copy",
    verb: "Tap to copy",
    prefix: "",
    placeholder: "email or phone",
  },
  wallet: {
    key: "wallet",
    name: "Apple / Google Pay",
    color: "#1A1A2E",
    glyph: "◑",
    kind: "copy",
    verb: "Tap to copy",
    prefix: "",
    placeholder: "phone number",
  },
};

export const METHOD_ORDER: PaymentMethodKey[] = [
  "venmo",
  "paypal",
  "cashapp",
  "zelle",
  "wallet",
];

/** External deep link for "link" methods; undefined for copy methods */
export function methodHref(
  key: PaymentMethodKey,
  handle: string
): string | undefined {
  switch (key) {
    case "venmo":
      return `https://venmo.com/u/${encodeURIComponent(handle.replace(/^@/, ""))}`;
    case "paypal":
      return `https://paypal.me/${encodeURIComponent(handle.replace(/^paypal\.me\//i, ""))}`;
    case "cashapp":
      return `https://cash.app/${encodeURIComponent(handle.startsWith("$") ? handle : "$" + handle)}`;
    default:
      return undefined;
  }
}

/** A fund method with its handle resolved (custom override ?? steward profile handle) */
export interface ResolvedMethod {
  method: PaymentMethodKey;
  handle: string;
  meta: PaymentMethodMeta;
}

/**
 * Resolve a fund's methods against the steward's profile handles.
 * Methods with no custom handle and no profile handle are dropped —
 * a toggled-on method with nothing to show is a dead button.
 */
export function resolveFundMethods(
  fundMethods: { method: PaymentMethodKey; custom_handle: string | null; display_order: number }[],
  stewardHandles: Map<PaymentMethodKey, string>
): ResolvedMethod[] {
  return fundMethods
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .flatMap((fm) => {
      const handle = fm.custom_handle ?? stewardHandles.get(fm.method);
      if (!handle) return [];
      return [{ method: fm.method, handle, meta: PAYMENT_METHODS[fm.method] }];
    });
}

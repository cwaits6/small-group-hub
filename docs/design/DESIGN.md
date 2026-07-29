# two42 — Design System

A living design system for two42. Changes come via PR. When guidance conflicts, precedence is: the maintainer's explicit words → this document → the project's existing tokens.

---

## Brand

**Name:** two42 — always lowercase. It reads aloud as "two forty-two" → **Acts 2:42** (the early church: teaching, fellowship, breaking bread, and prayer). The reference is carried by how the name is said; there is no literal colon.

**What it is:** software for church **connection groups**. Each **church is an organization** that contains its **groups**. Open source under **AGPL-3.0** and self-hostable; the hosted service is the business. Every feature is open — nothing is gated behind a paid tier.

**Voice:** plain, functional copy — verb+noun labels, no salesy subtitles or cute metaphors. The audience runs from adults in their 30s–50s (the core) up to their 80s; design for the oldest members (large type, high contrast, generous touch targets) without feeling dated to the youngest. See [Accessibility floor](#accessibility-floor).

---

## Wordmark

Canonical assets are outlined SVGs in [`public/brand/`](../../public/brand) — Fraunces converted to vector paths, so the mark never silently falls back to a system font.

- **Lockup:** `two` (lowercase word) + `42` (numeral), read together as "two forty-two."
- **The `42` is the focal element** — heavier weight plus the accent color. `two` ≈ weight 360; `42` ≈ weight 620.
- **Typeface:** Fraunces (variable display serif, high-contrast, display optical size).

| File | Use |
|---|---|
| `two42-wordmark.svg` | ink `two` + accent `42` — **light** backgrounds |
| `two42-wordmark-dark.svg` | bone `two` + accent `42` — **dark** backgrounds |
| `two42-mark.svg` | the `42` tile (white on accent, rounded square) — favicon, avatar, app icon |

**Rules**
- Never re-typeset the wordmark in a live font — ship the SVG.
- Clearspace: keep at least the height of the `4` clear on all sides.
- Minimum wordmark width ≈ 96px; below that, use the tile.
- Don't recolor beyond the provided light/dark variants; don't stretch, skew, outline, or add effects.

---

## Typography

| Role | Typeface |
|---|---|
| Wordmark / display / headings | **Fraunces** (variable serif) — warmth + authority |
| UI / body | **Inter** (variable sans) — legible from captions to headers |
| Data / mono | **JetBrains Mono** — tabular numerals |

Fraunces and Inter load via `next/font/google`.

---

## Color

Warm and earthen — deliberately not the church-tech default blue.

- Ground: warm bone `#F1EBDF` (light) / warm near-black `#17150F` (dark)
- Ink: `#221F19` (light) / bone (dark)
- **Accent: terracotta** `#B85C38`, deep `#8A4227` (the text-safe variant on light grounds). Used for primary actions, active nav, and highlights.
- Semantic colors (success / warning / danger) are separate from the accent.

The accent is the one color a tenant can override (see [Theming](#theming-multi-tenant)).

---

## Theming (multi-tenant)

Tokens come in two layers.

**1. Product tokens — fixed.** Defined as CSS custom properties in `app/globals.css` (`@theme`): the Fraunces wordmark, shell chrome, structural neutrals, spacing, radii, and semantic colors. Not overridable by a tenant.

**2. Tenant tokens — per-org.** Stored on **`organizations.branding`** (jsonb):

| Key | Meaning |
|---|---|
| `display_name` | the church/group name shown within their space |
| `logo_url` | their logo (falls back to their name set in Fraunces) |
| `accent` | a single accent color, validated for contrast |

Tenant tokens are resolved for the active org and applied to the app root at runtime. There is no per-tenant CSS bundle.

A tenant may not change layout, typography, structural or semantic colors, or the two42 wordmark on platform-level surfaces (sign-in, "powered by").

---

## Accessibility floor

- Body text ≥ 16px; never below 14px for meaningful content.
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text); the terracotta accent is text-safe only in its deep variant on light grounds.
- Touch targets ≥ 44×44px, with generous spacing.
- Never encode meaning in color alone; pair it with a label or icon.
- Assignment/roster UIs show current members by default with an explicit "add" mode — never full toggle lists.

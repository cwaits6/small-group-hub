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
- **The `42` is the focal element — set apart by color, not weight.** `two` and `42` share one weight (Fraunces ≈ 580, `-0.02em` tracking, display optical size); the `42` carries the accent color while `two` takes the ink color. The canonical SVGs are generated this way.
- **Typeface:** Fraunces (variable display serif, high-contrast, display optical size).

| File | Use |
|---|---|
| `two42-wordmark.svg` | Espresso `two` + Clay `42` — **light** backgrounds |
| `two42-wordmark-dark.svg` | Warm Paper `two` + Marigold `42` — **dark** backgrounds |
| `two42-mark.svg` | the `42` tile (Marigold on a Clay ground, rounded square) — favicon, avatar, app icon |

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

Warm and earthen — deliberately not the church-tech default blue. Four brand colors, taken directly from the "The Table" wordmark study:

| Name | Hex | Role |
|---|---|---|
| **Clay** | `#B85C38` | primary accent — primary actions, active nav, and the `42` on light grounds. Deep clay `#8A4227` for gradients and as the text-safe variant on light grounds. |
| **Marigold** | `#E8A33D` | secondary highlight — the `42` on dark grounds, plus accents and highlights |
| **Espresso** | `#2A211A` | ink on light grounds / dark-mode ground |
| **Warm Paper** | `#F4EEE2` | light-mode ground / text on dark grounds |

Semantic colors (success / warning / danger) are separate from these four.

Clay (the primary accent) is the one color a tenant can override (see [Theming](#theming-multi-tenant)).

---

## Theming (multi-tenant)

Tokens come in two layers.

**1. Product tokens — fixed.** Defined as CSS custom properties in `app/globals.css` (`@theme`): the Fraunces wordmark, shell chrome, structural neutrals, spacing, radii, and semantic colors. Not overridable by a tenant.

**2. Tenant tokens — per-org (planned).** The **`organizations.branding`** (jsonb) column exists in the schema (Phase 1, #210) but nothing reads or applies it yet — the API and runtime below describe the intended design, not current behavior:

| Key | Meaning |
|---|---|
| `display_name` | the church/group name shown within their space |
| `logo_url` | their logo (falls back to their name set in Fraunces) |
| `accent` | a single accent color, validated for contrast |

Once built, tenant tokens will be resolved for the active org and applied to the app root at runtime; there will be no per-tenant CSS bundle.

A tenant may not change layout, typography, structural or semantic colors, or the two42 wordmark on platform-level surfaces (sign-in, "powered by").

---

## Accessibility floor

- Body text ≥ 16px; never below 14px for meaningful content.
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text); Clay is text-safe as body text only in its deep variant (`#8A4227`) on light grounds.
- Touch targets ≥ 44×44px, with generous spacing.
- Never encode meaning in color alone; pair it with a label or icon.
- Assignment/roster UIs show current members by default with an explicit "add" mode — never full toggle lists.

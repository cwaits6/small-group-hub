# Two42 — Design System

A living design system. It evolves; changes come via PR. **Precedence** when guidance conflicts: the user's/maintainer's explicit words → this document → the project's existing tokens → ad-hoc choices.

---

## Brand

**Name:** Two42. It reads aloud as "two forty-two" → **Acts 2:42** — the founding description of the early church: *teaching, fellowship, breaking bread, and prayer.* The reference is carried by how the name is said; there is no literal colon in the wordmark.

**What it is:** software for church **connection groups** (small groups). Moving to multi-tenant SaaS — each **church is an organization** that contains its **groups**. Open source under **AGPL-3.0** and self-hostable; the hosted service is the business. Everything is open — features are never gated behind a paid/proprietary tier.

**Voice:** plain, functional copy — verb+noun labels, no salesy subtitles or cute metaphors. The audience spans adults from their 30s–50s (the core) up to their 80s; design for the oldest members (large type, high contrast, generous touch targets) without feeling dated to the youngest. See [Accessibility floor](#accessibility-floor).

---

## Wordmark

Canonical assets live in [`public/brand/`](../../public/brand) as **outlined SVGs** (Fraunces converted to vector paths) so the mark never silently falls back to a system font.

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

| Role | Typeface | Notes |
|---|---|---|
| Wordmark / display / headings | **Fraunces** (variable serif) | warmth + authority; load via `next/font/google` |
| UI / body | **Inter** (variable sans) | legible from captions to headers |
| Data / mono | JetBrains Mono (existing) | tabular numerals |

**Migration note:** the app currently loads Cormorant Garamond + Inter Tight (`app/layout.tsx`) — the older "Morning" brand. The re-skin swaps the display serif → **Fraunces** and body → **Inter**. This is deferred to a visual-rebrand pass and is **not** a dependency of the multi-tenant work.

---

## Color

Two42's palette is warm and earthen — deliberately **not** the church-tech default blue. Status: the wordmark and accent are locked; the full product palette is finalized in the visual-rebrand pass.

- Neutral ground: warm bone `#F1EBDF` (light) / warm near-black `#17150F` (dark)
- Ink: `#221F19` (light) / bone (dark)
- **Accent (default): terracotta** `#B85C38`, deep `#8A4227` (text-safe on light). Signals hospitality / "the table"; chosen over gold, which read as "Masters / autumn."
- Semantic colors (success / warning / danger) are **separate** from the accent.

The **accent is tenant-overridable** (see below). Terracotta is Two42's *own* default — used in the product's marketing and platform-level chrome.

---

## Theming architecture (multi-tenant) — the load-bearing contract

Tokens come in **two layers**:

**1. Product tokens — fixed, in code.** Two42's own identity: the Fraunces wordmark, shell chrome, structural neutrals, spacing, radii, and semantic colors. Never overridable by a tenant. Defined as CSS custom properties in `app/globals.css` (`@theme`).

**2. Tenant tokens — per-org, at runtime.** Stored on **`organizations.branding`** (jsonb). A tenant (church) may override only:

| Key | Meaning |
|---|---|
| `display_name` | the church/group name shown within *their* space |
| `logo_url` | their logo (falls back to their name set in Fraunces) |
| `accent` | a single accent color (validated for contrast) — primary actions, active nav, highlights |

A tenant **may not** change: layout, the Two42 wordmark on platform-level surfaces (sign-in, "powered by"), structural or semantic colors, or typography.

**Runtime:** for each request, resolve the current org's `branding` and set the tenant CSS vars (e.g. `--accent`) on the app root; product vars come from `globals.css`. Server components read `organizations.branding` for the active `org_id`. There is **no** per-tenant CSS bundle.

> This is the contract the rearchitecture builds against:
> **`organizations.branding = { display_name, logo_url, accent }`.**

---

## Accessibility floor

- Body text ≥ 16px; never below 14px for meaningful content.
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text); the terracotta accent is text-safe only in its deep variant on light grounds.
- Touch targets ≥ 44×44px; generous spacing.
- Don't encode meaning in color alone; pair with label/icon.
- Assignment/roster UIs show current members by default with an explicit "add" mode — never full toggle lists.

---

## Explorations (reference)

Interactive studies behind these decisions, published (durable) — the source HTML lived in an ephemeral scratchpad, so these URLs are the surviving copies:

- Wordmark font study (8 typefaces, Fraunces chosen): https://claude.ai/code/artifact/b630b671-ac14-41c8-a660-9c3d230c266c
- Dashboard palette — green: https://claude.ai/code/artifact/b92297d9-3b66-4c32-a5d9-62160f918783
- Dashboard palette — clay: https://claude.ai/code/artifact/6ea0fde3-33ea-4a9c-9810-c288dea86d0d
- Dashboard palette — blue: https://claude.ai/code/artifact/82913220-2a1f-4fe9-af0d-49248edc5ad3

---

## Status

- [x] Name, meaning, wordmark (Fraunces), tile / favicon
- [x] Theming contract (product vs tenant tokens) → drives `organizations.branding`
- [ ] Final product palette (visual-rebrand pass)
- [ ] App re-skin: Fraunces swap + `globals.css` token retune + wordmark in the header
- [ ] Wire the tenant `accent` override at runtime (part of the multi-tenant build)

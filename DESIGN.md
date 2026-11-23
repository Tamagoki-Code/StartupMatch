---
name: StartupMatch
description: A dense, businesslike campus marketplace connecting student developers with local enterprises
colors:
  primary: "#2563EB"
  primary-fg: "#ffffff"
  success: "#16A34A"
  warning: "#D97706"
  danger: "#DC2626"
  slate-50: "#F8FAFC"
  slate-100: "#F1F5F9"
  slate-200: "#E2E8F0"
  slate-300: "#CBD5E1"
  slate-400: "#94A3B8"
  slate-500: "#64748B"
  slate-600: "#475569"
  slate-700: "#334155"
  slate-800: "#1E293B"
  slate-900: "#0F172A"
typography:
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "99px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "#ffffff"
    textColor: "{colors.slate-700}"
    rounded: "{rounded.lg}"
---

# Design System: StartupMatch

## Overview

**Creative North Star: "The Campus Ledger"**

StartupMatch reads like a trusted institutional back-office tool, not a consumer marketplace: dense data tables, status pills, and compact cards that favor scanning many records over browsing a few. The tone is civic-service and verification-driven (PSITS academic/business review queues, contract phase tracking), so the UI leans functional and a little formal rather than playful — think a campus registrar's ledger rendered as a modern web app. Nothing is decorative; every color, badge, and shadow carries status information (verified vs. pending, awarded vs. disputed, paid vs. owed).

Surfaces sit almost flush with the page at rest; elevation is reserved for things that must interrupt — modals, dropdowns, the one active workflow in front of the user.

**Key Characteristics:**
- Dense, data-forward layouts (cards, tables, sidebars) over spacious marketing-style pages
- Status is always color-coded and labeled (pills, dots) — never implied by position alone
- Confident, saturated blue as the single call-to-action color; everything else is slate/neutral or a semantic status color
- Bold-leaning type (500–800 weight) at small sizes (11–16px) — built for scanning, not reading prose

## Colors

Confident Utility Blue: one saturated, no-nonsense primary against cool slate neutrals; status colors (green/amber/red) carry all other meaning.

### Primary
- **Confident Utility Blue** (`#2563EB`): the one call-to-action color — primary buttons, active nav state, links, the brand accent. Reserve it for action and selection; don't use it decoratively.

### Neutral
- **Slate 50–900** (`#F8FAFC` → `#0F172A`): the entire structural palette — page background (slate-50), card borders (slate-200), secondary text (slate-500/600), primary text (slate-700), headings (slate-900).
- **White** (`#FFFFFF`): card and modal surfaces.

### Status (semantic, not decorative)
- **Success** (`#16A34A`): Verified / Active / Approved states, on a light `#F0FDF4` tint with `#BBF7D0` border.
- **Warning** (`#D97706`): Pending Review state, on `#FFFBEB` tint with `#FDE68A` border.
- **Danger** (`#DC2626`): Rejected / Suspended / Disputed states, on `#FEF2F2` tint with `#FECACA` border.
- **Info** (reuses Primary Blue): Under Review state, on `#EFF6FF` tint with `#BFDBFE` border.

### Named Rules
**The One Action Rule.** Saturated blue (`#2563EB`) appears only on the single primary action per view (submit, award, approve) or active nav/tab state — never as a background fill or decoration elsewhere.
**The Status-Is-Color Rule.** Any record with a lifecycle (verification, bid, contract phase) always shows a colored pill with a matching dot, text, light background tint, and border in the same hue — status is never conveyed by icon or position alone.

## Typography

**Body/Display Font:** Inter (with `system-ui, sans-serif` fallback) — the only font family in the system.

**Character:** A single, bold-leaning grotesque used at small sizes throughout; there is no separate display face — hierarchy comes from weight and size, not font change.

### Hierarchy
- **Title** (700–800 weight, 20–24px): page/section headers, modal titles.
- **Subtitle** (600–700 weight, 14–16px): card titles, panel headers.
- **Body** (500 weight, 12.5–13.5px): primary row/card content, descriptions.
- **Label** (600 weight, 11–11.5px): status pills, form labels, table headers, metadata — frequently uppercase or letter-spaced.

### Named Rules
**The No-Regular-Weight Rule.** Body text is never below 500 weight; the system has no light or regular-weight prose, which keeps dense layouts legible at small sizes.

## Layout

Compact, information-dense layouts built around sidebars (role-specific: `AdminSidebar`, `DevSidebar`) plus a scrollable content area of stacked cards or rows. Density is deliberately high — small gaps (8–16px), small type (11–14px) — favoring "see more at once" over generous whitespace. Responsive behavior narrows to a single column and collapses the sidebar (`isMobile` prop threading, e.g. in `MarketplaceFeed`).

## Elevation & Depth

Mostly flat at rest: cards use a barely-there ambient shadow (`0 1px 3px rgba(0,0,0,0.08)`) with a 1px slate-200 border doing most of the separation work. Real elevation — a visibly bigger, softer shadow — is reserved for things that must float above the page: modals and overlays (`0px 8px 24px rgba(0,0,0,0.16)`).

### Shadow Vocabulary
- **ambient** (`box-shadow: 0 1px 3px rgba(0,0,0,0.08)`): default resting shadow for cards and panels; pairs with a slate-200 border.
- **overlay** (`box-shadow: 0px 8px 24px rgba(0,0,0,0.16)`): modals, dropdowns, anything that must read as above the page.

### Named Rules
**The Flat-By-Default Rule.** Cards and panels stay flush with the page (border + ambient shadow only). A heavier shadow is earned only by leaving the page's normal flow (modal, popover, floating menu).

## Shapes

Small, consistent corner radii rather than sharp or heavily rounded forms: `8px` is the default for buttons, inputs, and most interactive controls; `12px` for cards/panels; `99px` (full pill) exclusively for status badges and tags. Borders are thin (1px, slate-200) and are the primary way surfaces separate from the page, more than shadow.

## Components

### Buttons
- **Shape:** 8px radius (`{rounded.md}`).
- **Primary:** `background: #2563EB`, `color: #fff`, no border, `padding: 8px 16px`, `fontSize: 13px`, `fontWeight: 600`.
- **Disabled/busy:** `opacity: 0.7`, `cursor: default` (no separate disabled color token — opacity carries the state).

### Status Pills (signature component)
- **Shape:** full pill (`99px` radius), `padding: 3px 10px`.
- **Style:** a small leading dot (5px) in the status color, label text in the status color, light tint background, matching-hue 1px border. `fontSize: 11.5px`, `fontWeight: 600`.
- **States:** Pending Review (amber), Verified/Active/Approved (green), Rejected/Suspended/Disputed (red), Under Review (blue).

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** white (`#fff`).
- **Shadow Strategy:** ambient only (see Elevation & Depth); never the overlay shadow unless the card is itself a floating element.
- **Border:** 1px solid `#E2E8F0` (slate-200) — does more visual work than the shadow.

### Navigation (Sidebars)
- Role-specific sidebar components (`AdminSidebar`, `DevSidebar`) rather than one shared nav — each scoped to the pages that role can reach (see `roleAccess.ts`). Active/selected state uses the primary blue; inactive items sit in slate neutrals.

## Do's and Don'ts

### Do:
- **Do** keep the single saturated blue reserved for the one primary action or active state per view.
- **Do** pair every status (verification, bid, contract phase) with a colored pill: dot + label + tint background + matching border, never color alone.
- **Do** keep body text at 500 weight or heavier, even at small sizes — this system has no light/regular weight.
- **Do** use the 8px / 12px / 99px radius scale consistently (controls / cards / pills); don't introduce a fourth radius without reason.

### Don't:
- **Don't** add a heavier "card" shadow outside modals/overlays — flat-by-default is load-bearing for the dense layout reading calmly.
- **Don't** introduce a second accent color; all non-primary color in this system is either a slate neutral or one of the four semantic status colors.
- **Don't** widen spacing or type size "for breathing room" on list/table-like views — density is the point; airiness belongs only to empty states and onboarding, not the working UI.

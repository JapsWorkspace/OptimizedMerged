# Responsive Mobile Foundation Design

Date: 2026-08-10
Project: SagipBayan DRRMO web frontend
Scope: Public landing page, shared admin shell, shared dashboard/card/button patterns first; queue-style and inventory-style modules second

## Goal

Improve mobile usability across the web frontend without changing the established desktop visual design. The first pass should remove the most disruptive small-screen problems: clipped headers, oversized controls, stacked elements overflowing the viewport, side padding that wastes width, rigid card grids, and action rows that do not wrap.

The work should create reusable responsive patterns rather than isolated page hacks, so later module cleanup can reuse the same mobile behavior with less risk.

## Problem Summary

Current mobile problems visible from the screenshots and the code structure:

- Public landing page header content truncates early and wastes horizontal space.
- Toolbar controls and action buttons stay in desktop rows, causing overflow and overlap.
- Shared admin/dashboard shells keep desktop spacing and card widths on narrow screens.
- Landing page navigation chips and hero controls do not reflow cleanly on smaller devices.
- Some sections appear centered inside fixed-width shells that leave large empty gutters on mobile.
- Similar issues likely repeat in queue-style and inventory-style pages because they share card, action-row, and section layout patterns.

## Constraints

- Preserve the current desktop look and interaction model as closely as possible.
- Avoid large JSX rewrites unless a layout cannot be repaired cleanly with CSS and small structural adjustments.
- Prefer shared responsive utilities and targeted breakpoints over per-page one-off overrides.
- Keep the first phase focused on the highest-traffic and most visibly broken screens.

## Design Approach

Recommended approach: shared-first mobile repair.

This pass will add a mobile responsiveness layer on top of the current desktop styling. The implementation should begin with the layout primitives that drive the landing page and admin shell, then extend into repeated dashboard patterns such as cards, control bars, stat blocks, and action groups.

The intent is:

- desktop remains visually familiar
- mobile gets narrower spacing, wrapped controls, stacked grids, and safe-width cards
- repeated modules inherit the fixes instead of re-solving the same layout problem

## Phase Breakdown

### Phase 1: Responsive Foundation

Targets:

- public landing page
- shared admin shell/header/sidebar behavior
- shared dashboard cards, action rows, section headers, and button groups

Expected outcomes:

- landing page header, search, mode controls, and section chips fit within mobile width
- hero and landing sections collapse into a readable vertical flow
- admin pages stop forcing desktop spacing on phones
- primary action buttons become full-width or wrap safely when needed
- card grids collapse to one column on phones and controlled multi-column on tablets

### Phase 2: Module Families

Targets:

- queue-style modules
- inventory-style modules
- similar dashboard/list/form modules that share the same card and control patterns

Expected outcomes:

- mobile fixes from phase 1 are reused with fewer custom overrides
- tables or dense list layouts either stack, scroll safely, or switch to card presentation where needed
- filter bars and top action rows become usable without horizontal scrolling

## Responsive Architecture

### 1. Breakpoint Strategy

Use a small set of predictable breakpoints instead of scattered overrides:

- `<= 1200px`: tighten larger desktop/tablet layouts where needed
- `<= 992px`: switch wide two-column shells into friendlier stacked or asymmetrical layouts
- `<= 768px`: primary mobile breakpoint for headers, cards, action rows, and section spacing
- `<= 576px`: compact phone refinement for typography, icon buttons, chips, and touch sizing

These breakpoints should be concentrated in the shared CSS files rather than duplicated across many components.

### 2. Shared Layout Rules

The following layout behaviors should become the default mobile repair rules:

- reduce horizontal padding on narrow screens
- allow flex rows to wrap instead of forcing a single line
- convert multi-column grids to single-column at phone widths
- remove fixed min-width values that force overflow unless they are essential
- make cards and panels use `width: 100%` with `min-width: 0`
- ensure text blocks can shrink with `min-width: 0` and proper word wrapping
- keep touch targets large enough while avoiding desktop-sized whitespace

### 3. Landing Page Strategy

The landing page needs the most careful treatment because it mixes a public marketing-style layout with editor/admin controls.

Mobile behavior should be:

- top identity block stacks cleanly with logo, municipality text, and subtitle
- search control spans the available width
- editor/visitor/back controls wrap into multiple rows instead of squeezing horizontally
- hero content becomes a single readable column
- section chips/navigation become horizontally scrollable only if wrapping cannot preserve clarity; wrapping is preferred for short sets
- map, updates, tips, and side cards stack vertically with consistent spacing
- embedded media, map frames, and virtual twin panels maintain aspect ratio without causing page overflow

Desktop behavior should remain unchanged except where tiny spacing corrections are needed to support the new responsive rules.

### 4. Shared Admin Shell Strategy

The admin side appears to have recurring shell issues: oversized top spacing, preserved desktop gutters, and control groups that do not compress well.

Mobile behavior should be:

- shell containers use smaller padding and gap values
- page headers stack title, actions, and secondary controls vertically
- icon-only controls stay tappable but shrink appropriately
- side navigation or drawer triggers remain reachable without overlapping page titles
- cards align flush to the content column instead of appearing inside a desktop-centered frame

### 5. Shared Card and Action Pattern Strategy

Many modules reuse the same kinds of UI pieces. These should be standardized for mobile:

- stat cards: one column on phones, two columns only where space safely allows
- action rows: wrap with consistent vertical spacing
- button groups: full width on phones for important actions, auto width on larger screens
- filter/tool rows: stack labels, selects, search inputs, and export buttons in a logical vertical order
- section heads: move title/copy above actions on narrow screens

### 6. Queue and Inventory Module Strategy

These modules should not be redesigned independently unless their structure truly differs. Instead, they should inherit the foundation rules and then receive small module-specific adjustments.

Likely adjustments:

- queue cards and status panels stack vertically
- table-like controls switch to wrapped filters plus safe overflow handling
- inventory action buttons and exports become stacked or split into multiple rows
- dense analytics or summary cards collapse to simpler one-column mobile arrangements

## File Strategy

Primary likely touchpoints based on current repo structure:

- `tests/src/components/entry/Dashboard.js`
- `tests/src/components/css/Dashboard.css`
- shared shell/layout component files used across admin pages
- component CSS files that define repeated control rows, cards, and page shells

Implementation should begin by finding the highest-leverage shared CSS blocks before editing module-specific styles. If repeated patterns are currently duplicated, phase 1 may extract a few shared responsive rules, but this should stay incremental and low-risk.

## Error Handling and Risk Control

Main risks:

- fixing mobile by weakening desktop spacing or alignment
- adding conflicting media queries in multiple files
- patching one screen with brittle selector overrides that break related screens

Risk controls:

- always check desktop and mobile behavior for touched shared selectors
- prefer editing existing selector groups and existing media query regions when practical
- keep naming aligned with current CSS architecture instead of introducing a second styling system
- make structural JSX changes only when CSS alone cannot solve the overflow or order problem

## Testing and Verification

Manual verification should cover at minimum:

- public landing page on narrow phone width
- admin landing/editor states on narrow phone width
- at least one queue-style page
- at least one inventory-style page
- desktop regression check on the main landing page and a representative admin dashboard

Responsive checks should confirm:

- no clipped titles or controls at phone widths
- no horizontal page overflow in main screens
- action buttons remain reachable and readable
- cards do not exceed the viewport width
- map/media areas do not break layout or overlap controls

## Success Criteria

Phase 1 is successful when:

- the landing page is comfortably usable on mobile
- the shared admin shell no longer feels desktop-locked on phones
- common dashboard cards and action bars reflow cleanly on mobile
- desktop presentation remains substantially unchanged

Phase 2 is successful when:

- queue and inventory-style modules inherit the shared mobile improvements
- remaining module fixes are narrow and intentional, not foundational

## Recommendation

Proceed with a two-phase responsive overhaul:

1. repair the shared mobile foundation first while preserving desktop visuals
2. apply the same responsive system to queue-style and inventory-style modules next

This gives the highest user impact with the lowest redesign risk and sets up the rest of the frontend for faster cleanup.

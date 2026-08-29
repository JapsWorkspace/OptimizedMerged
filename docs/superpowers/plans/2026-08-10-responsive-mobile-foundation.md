# Responsive Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public landing page, shared admin shell, and shared dashboard/action patterns usable on mobile while preserving the established desktop design.

**Architecture:** Add a mobile repair layer on top of the current CSS architecture instead of redesigning the JSX tree. Concentrate changes in the existing shared CSS files and only make small structural JSX updates where a control row or wrapper cannot reflow correctly with CSS alone. Reuse those responsive patterns in the queue and inventory modules rather than building page-specific mobile hacks.

**Tech Stack:** React 19, React Router, CRA (`react-scripts`), component-scoped CSS files in `tests/src/components/css`, React Testing Library, manual responsive verification in browser DevTools

---

## File Map

- Modify: `tests/src/components/entry/Dashboard.js`
  - Public landing page structure, header controls, hero content, section chip navigation, and editor controls.
- Modify: `tests/src/components/css/Dashboard.css`
  - Shared landing page layout, public header, hero grid, content grid, map/media shells, and landing editor modal behavior.
- Modify: `tests/src/components/layout/DashboardShell.js`
  - Shared admin shell wrapper, topbar ordering, and mobile sidebar trigger behavior if markup adjustments are required.
- Modify: `tests/src/components/css/sidebar.css`
  - Shared admin shell, topbar, sidebar overlay, page gutters, and mobile content spacing rules.
- Modify: `tests/src/components/Donations/Inventory.js`
  - Inventory action groups and any wrapper classes that need a small structural adjustment for clean mobile stacking.
- Modify: `tests/src/components/css/Inventory.css`
  - Inventory page cards, control rows, exports/actions, table wrappers, and planner/tool sections for mobile widths.
- Modify: `tests/src/components/Donations/DonationValidationQueue.js`
  - Queue action bar or detail panel wrappers if CSS alone cannot produce a clean mobile flow.
- Modify: `tests/src/components/css/DonationValidationQueue.css`
  - Queue cards, controls, detail panes, and confirmation/footer action behavior on small screens.
- Optional Verify: `tests/src/components/IncidentReport.js`
  - Check whether shared admin shell fixes already improve this page enough before widening scope.
- Test: `tests/src/App.test.js`
  - Add or update a light render smoke test only if JSX changes introduce new branch conditions that need coverage.

## Task 1: Audit and Lock Shared Responsive Targets

**Files:**
- Modify: `docs/superpowers/specs/2026-08-10-responsive-mobile-foundation-design.md`
- Modify: `docs/superpowers/plans/2026-08-10-responsive-mobile-foundation.md`

- [ ] **Step 1: Record the exact selector groups and wrapper components that control phase-1 responsive behavior**

Use these audit commands before editing code:

```powershell
rg -n "landing-wide-shell|dashboard-header-shell|header-public-actions|landing-hero-grid|landing-content-grid|landing-map-layout|landing-editor" tests/src/components/entry/Dashboard.js tests/src/components/css/Dashboard.css
rg -n "admin-layout|mobile-sidebar-toggle|sidebar-backdrop|dashboard-topbar|shell-topbar-actions|admin-main" tests/src/components/layout/DashboardShell.js tests/src/components/css/sidebar.css
rg -n "inventory|toolbar|actions|filter|card|table|planner" tests/src/components/Donations/Inventory.js tests/src/components/css/Inventory.css
rg -n "queue|card|actions|detail|toolbar|footer" tests/src/components/Donations/DonationValidationQueue.js tests/src/components/css/DonationValidationQueue.css
```

Expected: concrete line hits in the existing landing, shell, inventory, and queue files so phase 1 stays anchored to shared selectors.

- [ ] **Step 2: Confirm the local verification commands for the frontend**

Run:

```powershell
Get-Content tests/package.json
```

Expected: `react-scripts test` and `react-scripts build` are available for frontend verification.

- [ ] **Step 3: Commit the planning artifacts**

```bash
git add docs/superpowers/specs/2026-08-10-responsive-mobile-foundation-design.md docs/superpowers/plans/2026-08-10-responsive-mobile-foundation.md
git commit -m "docs: add responsive mobile foundation spec and plan"
```

## Task 2: Repair Public Landing Page Mobile Layout

**Files:**
- Modify: `tests/src/components/entry/Dashboard.js`
- Modify: `tests/src/components/css/Dashboard.css`
- Test: `tests/src/App.test.js`

- [ ] **Step 1: Write the failing test for landing page render stability**

Add a lightweight smoke test in `tests/src/App.test.js` that renders the app shell route or `Dashboard` entry component without crashing after the layout edits.

```javascript
import { render } from "@testing-library/react";
import Dashboard from "./components/entry/Dashboard";

test("renders public dashboard shell without crashing", () => {
  render(<Dashboard />);
});
```

If direct `Dashboard` rendering needs router context, wrap it with `MemoryRouter`:

```javascript
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import Dashboard from "./components/entry/Dashboard";

test("renders public dashboard shell without crashing", () => {
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
});
```

- [ ] **Step 2: Run the targeted frontend test to verify the current setup fails or needs adjustment**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: either an existing failure caused by missing layout-safe test setup or a passing smoke test that becomes the guardrail for the JSX changes. If it fails for environment/setup reasons, fix the test harness before editing production code.

- [ ] **Step 3: Tighten landing page wrappers and control rows in `Dashboard.js` only where CSS cannot safely reflow the current structure**

Prefer minimal wrapper changes such as splitting overly dense control clusters into named rows. Example target shape:

```jsx
<div className="header-public-actions">
  <div className="header-search-wrap">...</div>
  <div className="header-control-row">
    <div className="header-mode-actions">...</div>
    <div className="header-twin-links">...</div>
  </div>
</div>
```

For landing nav chips, preserve desktop order but allow a wrapper class that can wrap or scroll safely on mobile:

```jsx
<nav className="landing-nav-chip-row" aria-label="Landing sections">
  {NAV_ITEMS.map((item) => (
    <button key={item.id} type="button" className="landing-nav-chip">
      {item.label}
    </button>
  ))}
</nav>
```

- [ ] **Step 4: Add the minimal CSS mobile repair layer in `Dashboard.css`**

Implement shared landing rules near existing responsive blocks rather than scattering new breakpoints. Start with this shape and adapt selectors to the current file:

```css
@media (max-width: 768px) {
  .landing-wide-shell,
  .dashboard-header-shell,
  .dashboard-nav-shell {
    width: min(100% - 24px, 100%);
  }

  .dashboard-header-shell,
  .dashboard-nav-shell,
  .header-public-actions,
  .header-control-row,
  .landing-hero-grid,
  .landing-content-grid,
  .landing-map-layout {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .brand-left,
  .brand-text,
  .header-search-wrap,
  .header-twin-links,
  .landing-hero-copy,
  .landing-hero-side,
  .landing-map-column,
  .landing-side-column {
    min-width: 0;
    width: 100%;
  }

  .landing-nav-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
}
```

Also add compact phone refinements around `576px` for title size, chip sizing, search height, and landing editor modal padding.

- [ ] **Step 5: Run the targeted landing smoke test**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: PASS

- [ ] **Step 6: Run a production build check after landing CSS/JSX changes**

Run:

```bash
npm run build
```

Working directory:

```text
tests
```

Expected: build completes successfully with exit code `0`

- [ ] **Step 7: Commit the landing page responsive foundation**

```bash
git add tests/src/components/entry/Dashboard.js tests/src/components/css/Dashboard.css tests/src/App.test.js
git commit -m "feat(frontend): improve public landing mobile responsiveness"
```

## Task 3: Repair Shared Admin Shell Mobile Layout

**Files:**
- Modify: `tests/src/components/layout/DashboardShell.js`
- Modify: `tests/src/components/css/sidebar.css`

- [ ] **Step 1: Write the failing test for shared shell render stability if the shell markup changes**

If `DashboardShell.js` gains new structural wrappers or aria-labeled controls, add a focused test in `tests/src/App.test.js` or a new `DashboardShell.test.js`:

```javascript
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import DashboardShell from "./components/layout/DashboardShell";

test("renders shell mobile toggle", () => {
  render(
    <MemoryRouter>
      <DashboardShell variant="drrmo">
        <div>Child content</div>
      </DashboardShell>
    </MemoryRouter>
  );

  expect(screen.getByLabelText(/open sidebar/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted shell test**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: FAIL only if the new shell assertion is not yet satisfied; otherwise keep the test as a guardrail and continue.

- [ ] **Step 3: Make minimal shell markup adjustments in `DashboardShell.js` for mobile ordering**

Keep the existing desktop structure, but allow the topbar brand and actions to stack safely:

```jsx
<header className="dashboard-topbar">
  <div className="shell-system-brand" aria-label="System identity">...</div>
  <div className="shell-topbar-actions">
    <div className="shell-quick-actions" aria-label="Quick actions">...</div>
    <div className="shell-profile-actions">...</div>
  </div>
</header>
```

Do not replace the sidebar pattern; only expose wrapper classes that the CSS can target for stacking and width control.

- [ ] **Step 4: Add shared admin shell responsive rules in `sidebar.css`**

Adapt the existing shell selectors to this responsive pattern:

```css
@media (max-width: 768px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }

  .admin-main,
  .admin-content {
    min-width: 0;
    padding-inline: 12px;
  }

  .dashboard-topbar,
  .shell-topbar-actions,
  .shell-quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .dashboard-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .shell-quick-action-btn {
    inline-size: 48px;
    block-size: 48px;
  }
}
```

Also ensure the mobile sidebar toggle and backdrop do not overlap the topbar title on narrow devices.

- [ ] **Step 5: Re-run the shared shell test**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: PASS

- [ ] **Step 6: Re-run the frontend build**

Run:

```bash
npm run build
```

Working directory:

```text
tests
```

Expected: build completes successfully with exit code `0`

- [ ] **Step 7: Commit the shared shell work**

```bash
git add tests/src/components/layout/DashboardShell.js tests/src/components/css/sidebar.css tests/src/App.test.js
git commit -m "feat(frontend): improve admin shell mobile layout"
```

## Task 4: Reuse the Mobile Patterns in Inventory and Queue Modules

**Files:**
- Modify: `tests/src/components/Donations/Inventory.js`
- Modify: `tests/src/components/css/Inventory.css`
- Modify: `tests/src/components/Donations/DonationValidationQueue.js`
- Modify: `tests/src/components/css/DonationValidationQueue.css`

- [ ] **Step 1: Write a failing or strengthening smoke test for the module family pages**

If the current test harness allows it, add a lightweight render test for both pages:

```javascript
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import Inventory from "./components/Donations/Inventory";
import DonationValidationQueue from "./components/Donations/DonationValidationQueue";

test("renders inventory module shell", () => {
  render(
    <MemoryRouter>
      <Inventory />
    </MemoryRouter>
  );
});

test("renders donation validation queue shell", () => {
  render(
    <MemoryRouter>
      <DonationValidationQueue />
    </MemoryRouter>
  );
});
```

If these components need providers that are too heavy for a safe smoke test, document that in the commit message and rely on build + manual responsive verification for this task.

- [ ] **Step 2: Run the targeted module smoke test**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: either a valid failing test due to missing wrappers/providers or a passing baseline that protects the module edits.

- [ ] **Step 3: Add minimal wrapper classes in `Inventory.js` and `DonationValidationQueue.js` only where CSS needs a reliable mobile target**

Examples:

```jsx
<div className="inventory-toolbar-row">...</div>
<div className="inventory-action-stack">...</div>
<div className="dqv-toolbar-row">...</div>
<div className="dqv-detail-stack">...</div>
```

Keep the logic untouched; this step is for layout targeting only.

- [ ] **Step 4: Apply shared mobile card/action/overflow behavior in `Inventory.css` and `DonationValidationQueue.css`**

Add or adapt breakpoints so repeated control patterns stack cleanly:

```css
@media (max-width: 768px) {
  .inventory-toolbar-row,
  .inventory-action-stack,
  .dqv-toolbar-row,
  .dqv-detail-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .inventory-toolbar-row > *,
  .inventory-action-stack > *,
  .dqv-toolbar-row > *,
  .dqv-detail-stack > * {
    width: 100%;
    min-width: 0;
  }

  .inventory-table-shell,
  .dqv-table-shell {
    overflow-x: auto;
  }
}
```

Use the page’s existing naming conventions if these exact selectors do not exist yet.

- [ ] **Step 5: Run the targeted module smoke test again**

Run:

```bash
npm test -- --watchAll=false --runTestsByPath src/App.test.js
```

Working directory:

```text
tests
```

Expected: PASS, or unchanged known provider/setup limitation with no new errors introduced.

- [ ] **Step 6: Run the production build after module CSS changes**

Run:

```bash
npm run build
```

Working directory:

```text
tests
```

Expected: build completes successfully with exit code `0`

- [ ] **Step 7: Commit the module family responsive cleanup**

```bash
git add tests/src/components/Donations/Inventory.js tests/src/components/css/Inventory.css tests/src/components/Donations/DonationValidationQueue.js tests/src/components/css/DonationValidationQueue.css tests/src/App.test.js
git commit -m "feat(frontend): improve inventory and queue mobile responsiveness"
```

## Task 5: Final Verification and Manual Responsive Checklist

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-responsive-mobile-foundation.md`

- [ ] **Step 1: Run the full frontend test suite**

Run:

```bash
npm test -- --watchAll=false
```

Working directory:

```text
tests
```

Expected: all frontend tests pass, or pre-existing unrelated failures are clearly identified and separated from this work.

- [ ] **Step 2: Run the final production build**

Run:

```bash
npm run build
```

Working directory:

```text
tests
```

Expected: build completes successfully with exit code `0`

- [ ] **Step 3: Complete the manual responsive verification checklist**

Check these screens in browser responsive mode:

```text
1. Public landing page at 375x812
2. Public landing page at 768x1024
3. DRRMO/admin dashboard shell at 375x812
4. Inventory page at 375x812
5. Donation validation queue at 375x812
6. Desktop regression for landing page and admin shell at 1440px+
```

Required outcomes:

```text
- No horizontal page overflow
- Header title remains readable
- Search and action controls wrap or stack cleanly
- Cards stay inside viewport width
- Queue and inventory actions remain reachable
- Desktop layout remains visually familiar
```

- [ ] **Step 4: Commit any final verification-only notes if needed**

```bash
git status --short
```

Expected: no unexpected files remain unstaged before handoff.

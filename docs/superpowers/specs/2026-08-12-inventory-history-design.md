# Inventory History Design

**Date:** August 12, 2026

## Goal

Add a year-bounded inventory history view for both the main inventory screen and the inventory intake screen so users can inspect past inventory state by month or by exact date within the current calendar year. The view must show exact historical inventory state, disable future dates, and preserve the current inventory design language.

## Requirements

- Support both monthly quick filters and a custom `as of` date picker.
- Limit history to the active calendar year.
- Disable future months and future dates after Wednesday, August 12, 2026.
- Show totals first, then expandable item lists.
- Keep the UI consistent with the existing inventory pages.
- Reconstruct the exact inventory state as of the selected date instead of filtering current live records.
- Do not mutate live inventory data while viewing history.

## Recommended Approach

Use an event-based inventory history endpoint backed by inventory records and inventory logs. The server will reconstruct the inventory state up to a selected date and return both summary totals and item details. The frontend will add a `History View` control group to the existing filter area in both inventory pages and switch between live mode and history mode without changing the surrounding page layout.

This approach is preferred because it provides audit-friendly exact history, naturally resets per year, and does not require inventing a separate shadow inventory store.

## Backend Design

### New Endpoint

Add a dedicated read-only endpoint:

- `GET /api/inventory/history`

### Query Parameters

- `asOf=YYYY-MM-DD`
- `type=goods|monetary|appliance|all`
- optional `month=YYYY-MM`
- optional `includeItems=true`

### Date Rules

- Allow dates from `2026-01-01` through `2026-08-12`
- Reject dates after `2026-08-12`
- Reject dates outside the current calendar year window

### Response Shape

Return a payload that includes:

- `yearWindow`
  - `start`
  - `end`
  - `maxSelectableDate`
- `historyMode`
  - `live`
  - `month`
  - `as_of_date`
- `summary`
  - total goods quantity
  - total appliance quantity
  - total monetary amount
  - record counts by type
- `months`
  - label, value, disabled, resolvedAsOfDate
- `items`
  - reconstructed inventory items for the selected date
- `timelineMeta`
  - last included event timestamp
  - reconstruction reliability

### Reconstruction Rules

- Start from inventory creation events.
- Apply later inventory events in chronological order up to and including the selected `asOf` date.
- Respect:
  - create
  - update
  - archive
  - release
- Use `InventoryItem.createdAt`, `InventoryItem.updatedAt`, and `InventoryLog` entries as the primary event sources.
- Exclude records that were not yet created as of the selected date.
- Exclude records archived on or before the selected date from the active historical state.
- Reflect quantity and amount changes exactly as they existed at that time.

### Reliability Handling

If older records cannot be reconstructed exactly because required historical events are missing, return a `historyReliability` indicator:

- `exact`
- `partial`

The frontend should surface a small note when the reliability is `partial`.

## Frontend Design

### Affected Screens

- `tests/src/components/Donations/Inventory.js`
- `tests/src/components/Donations/InventoryAdd.js`

### History View Controls

Add a `History View` panel near the current search and filter controls. Reuse existing card and filter styling where possible.

Controls:

- year badge, for example `2026 Inventory History`
- month chips from `Jan` through `Dec`
- `Sep` through `Dec` disabled while the current date is August 12, 2026
- custom `As of date` picker
- `Back to Live Inventory` button

### Month Resolution

- Completed past months resolve to the last day of that month
- The current month resolves to the current date, `2026-08-12`
- Future months remain disabled

Examples:

- `Jul 2026` resolves to `2026-07-31`
- `Aug 2026` resolves to `2026-08-12`

### Custom Date Rules

- Minimum date: `2026-01-01`
- Maximum date: `2026-08-12`
- Future dates must be disabled and not selectable

### History Mode UI Behavior

When history mode is active:

- show a banner such as `Viewing inventory as of August 12, 2026`
- replace live totals with historical totals
- replace live item tables with reconstructed historical item data
- keep existing type tabs, summary cards, spacing, and table patterns
- show totals first, then expandable item lists grouped by type

### Item Display

Show:

- total goods units
- total monetary amount
- total appliance units
- record counts

Below the totals, render grouped inventory sections:

- goods
- monetary
- appliance

Each section should be expandable and visually aligned with the existing inventory table style so the feature feels native to the current module.

## Testing Plan

### Backend Tests

Add tests for:

- valid past dates in the current year
- rejected future dates after `2026-08-12`
- rejected out-of-year dates
- monthly preset resolution
- exact reconstruction across create, update, archive, and release events
- summary totals and grouped item payloads
- reliability flag behavior when history is incomplete

### Frontend Tests

Add tests for:

- rendering the history controls in both inventory screens
- disabled future month chips
- disabled future dates in the date picker
- switching between live mode and history mode
- summary cards updating with history results
- grouped item sections using the returned historical data
- restoring live inventory after clicking `Back to Live Inventory`

### UX Checks

- verify the feature keeps the current inventory visual style
- verify the history banner is clear enough to prevent confusion with live data
- verify the controls stay usable on desktop and mobile layouts already used by the inventory module

## Rollout Order

1. Add backend history reconstruction utility and endpoint
2. Add backend tests
3. Add `History View` controls and state to `Inventory.js`
4. Add the same history pattern to `InventoryAdd.js`
5. Add frontend tests
6. Add reliability note and empty-state polish

## Non-Goals

- Do not create a separate reporting page
- Do not allow future-date monitoring
- Do not change the existing live inventory flow
- Do not create a permanent monthly snapshot store in the first version

## Success Criteria

- Users can inspect inventory by month or exact date within calendar year 2026.
- Future dates are disabled.
- History mode shows exact historical inventory state instead of filtered live data.
- Both inventory screens behave consistently.
- The design feels like part of the existing inventory system.

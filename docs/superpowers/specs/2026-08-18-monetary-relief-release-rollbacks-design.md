# Monetary Relief Release Rollback Design

## Goal

Fix the monetary relief release workflow so that:

- monetary inventory is reduced immediately when a release is created
- only the exact released amount is restored if that release is later reported as `not received`
- partial release history stays accurate across admin, accountant, and barangay flows

## Scope

This design applies to:

- `MyApp/server/controllers/reliefReleaseController.js`
- `MyApp/server/controllers/reliefRequestController.js`
- `MyApp/server/models/ReliefRelease.js`
- `MyApp/server/models/InventoryLog.js`
- tests covering monetary release creation and not-received rollback behavior

This design does not include:

- changing the existing rule that admin/accountant can release monetary requests while DRRMO cannot
- changing request approval rules
- changing goods or appliance rollback behavior unless needed for consistency
- UI redesign

## Problem Summary

The current server flow already deducts monetary inventory during release creation:

- `createReliefRelease` allocates monetary stock across one or more `InventoryItem` records
- each allocated inventory record is reduced immediately
- an `InventoryLog` entry is written with action `release`

That part already matches the desired release-time deduction rule.

The gap is in the barangay `not received` path:

- `reportReliefRequestNotReceived` currently refreshes request progress and sends audit/notification events
- it does not restore released monetary inventory
- it does not target a specific release allocation trail

That means the system can lose monetary inventory permanently after a failed delivery, even though the request was never actually received.

## Recommended Approach

Persist the exact monetary inventory allocation details on each `ReliefRelease`, then use those stored allocations to reverse only that release when it is reported `not received`.

This is the best fit for the current system because:

- release records already exist as the real unit of fulfillment
- monetary deduction already happens per release, not only at request completion
- partial releases must remain accurate
- restoring to the exact source inventory entries preserves per-entry balances and audit history

## Behavioral Rules

### Release-time deduction

When a monetary relief release is created:

- inventory is reduced immediately
- the release stores the exact monetary allocation splits used for that release
- each split records:
  - `inventoryItemId`
  - `itemName`
  - `amountReleased`

If a single release pulls from multiple monetary inventory entries, all of those splits must be stored.

### Not-received rollback

When a barangay reports a release as `not received`:

- only the affected unreveived release must be restored
- the released amount must be returned to the same monetary inventory entries that funded it
- the same release must not be restorable twice

This rollback must not restore:

- other releases tied to the same request
- already received releases
- cancelled or already rolled-back releases

### Request-level status refresh

After rollback:

- recompute request fulfillment from the remaining valid releases
- recompute the request status from the refreshed fulfillment totals

Expected outcome examples:

- if no remaining active releases exist, the request should move back to `approved`
- if some releases still remain active, the request may stay `partially_released`
- the request must not remain inflated by the rolled-back monetary release

### Inventory logging

Rollback must write explicit inventory history.

Recommended change:

- extend `InventoryLog.action` to support a restore-style action such as `return` or `rollback`

Recommended action name:

- `rollback`

Reason:

- `rollback` clearly communicates that this is a system reversal of a previously released relief amount
- it avoids confusion with donor-side `return` flows or normal intake operations

Each rollback log should include:

- `inventoryItem`
- `itemName`
- `itemType`
- `action: "rollback"`
- `amount`
- `performedBy`
- remarks referencing the release number and request number

## Data Model Changes

### ReliefRelease

Add a release-level field for monetary source tracking.

Recommended shape:

```js
monetaryAllocations: [
  {
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    itemName: { type: String, default: "", trim: true },
    amountReleased: { type: Number, default: 0, min: 0 },
  },
]
```

Add a flag or status marker that prevents double restoration.

Recommended minimal approach:

- keep using `releaseStatus` for the main lifecycle
- add a boolean such as `inventoryRestored`

Recommended shape:

```js
inventoryRestored: {
  type: Boolean,
  default: false,
}
```

Reason:

- this avoids overloading `releaseStatus`
- a release can still be historically visible as a released delivery that later failed, while separately tracking whether inventory has already been returned

### InventoryLog

Extend the enum:

```js
enum: ["create", "update", "archive", "release", "rollback"]
```

## Flow Changes

### In `createReliefRelease`

For monetary releases:

1. allocate monetary inventory as it already does
2. reduce each source `InventoryItem.amount`
3. write `release` inventory logs as it already does
4. persist `monetaryAllocations` on the created `ReliefRelease`

Each stored allocation must match the actual split amounts deducted.

### In barangay not-received handling

The current request-level `not received` endpoint should be upgraded to operate on actual release records.

Preferred behavior:

1. find active releases for the request that are still in `released` state
2. target only the unreveived release or releases being rejected by the barangay action
3. for each targeted release:
   - skip if `inventoryRestored` is already true
   - restore each saved `monetaryAllocation.amountReleased` to its source inventory item
   - write `rollback` inventory logs
   - mark `inventoryRestored = true`
   - mark the release lifecycle so it no longer counts as active fulfillment

Recommended release lifecycle update:

- set `releaseStatus = "cancelled"` for a not-received release that has been rolled back

Reason:

- `cancelled` already exists in the release schema
- a cancelled release should no longer count toward released fulfillment
- this fits the existing lifecycle better than inventing a separate `not_received` release status

### Fulfillment recomputation

After updating release state:

- rebuild fulfillment from releases
- exclude cancelled releases from release totals
- ensure rolled-back monetary amounts no longer contribute to `releasedMonetaryAmount`

## Testing

Minimum coverage:

1. creating a monetary release deducts the released amount from inventory
2. creating a monetary release stores the exact monetary allocation splits on the release
3. reporting that release as `not received` restores only that release amount
4. rollback restores amounts to the exact original monetary inventory entries
5. rollback writes `InventoryLog` records with action `rollback`
6. rollback cannot happen twice for the same release
7. request fulfillment/status recomputes correctly after rollback
8. one rolled-back release does not restore monetary amounts from a different release on the same request

## Risks and Mitigations

### Risk: restoring the wrong inventory entry

Mitigation:

- persist exact allocation splits on the release itself
- restore from those persisted splits, not from a fresh “best guess” allocation query

### Risk: double restoration

Mitigation:

- store `inventoryRestored`
- set it atomically inside the rollback transaction

### Risk: request totals remain inflated after rollback

Mitigation:

- always refresh request fulfillment after release cancellation/rollback
- derive totals from valid releases only

### Risk: future reports and history become inconsistent

Mitigation:

- add explicit `rollback` inventory logs
- keep cancelled releases visible historically instead of deleting them

## Recommended Decision

The most proper behavior for this system is:

- deduct money immediately when a monetary relief release is created
- store the exact inventory split used for that release
- if that release is later reported `not received`, restore only that release’s split amounts to the exact source monetary inventory entries
- mark that release cancelled and restored so it no longer affects request fulfillment

This matches the current release-centric architecture and keeps inventory, request progress, and audit history aligned.

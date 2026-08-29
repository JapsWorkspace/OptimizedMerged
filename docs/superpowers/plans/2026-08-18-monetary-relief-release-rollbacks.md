# Monetary Relief Release Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure monetary inventory is deducted when a monetary relief release is created and restored only for the specific release that is later reported as not received.

**Architecture:** Persist exact monetary allocation splits on each `ReliefRelease` during release creation, then reuse those saved splits to restore inventory during the barangay `not received` flow. Keep request progress derived from release records by cancelling rolled-back releases, adding explicit inventory rollback logs, and refreshing request fulfillment/status after every rollback.

**Tech Stack:** Node.js, Express, Mongoose, MongoDB transactions, plain Node test files

---

### Task 1: Extend the release and inventory models for monetary rollback tracking

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\models\ReliefRelease.js`
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\models\InventoryLog.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\models\ReliefRelease.js`

- [ ] **Step 1: Add release-level monetary allocation storage and restoration guard fields**

Update `ReliefRelease.js` by adding a reusable subdocument schema for monetary allocations and a boolean restoration guard:

```js
const monetaryAllocationSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    itemName: {
      type: String,
      default: "",
      trim: true,
    },
    amountReleased: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);
```

Add these fields inside `reliefReleaseSchema`:

```js
monetaryAllocations: {
  type: [monetaryAllocationSchema],
  default: [],
},

inventoryRestored: {
  type: Boolean,
  default: false,
},
```

- [ ] **Step 2: Extend inventory log actions to support rollback entries**

Update `InventoryLog.js`:

```js
action: {
  type: String,
  enum: ["create", "update", "archive", "release", "rollback"],
  required: true
},
```

- [ ] **Step 3: Sanitize stored monetary allocations during release validation**

Inside the `reliefReleaseSchema.pre("validate", ...)` hook, normalize the new array:

```js
this.monetaryAllocations = Array.isArray(this.monetaryAllocations)
  ? this.monetaryAllocations
      .map((entry) => ({
        inventoryItemId: entry?.inventoryItemId || null,
        itemName: String(entry?.itemName || "").trim(),
        amountReleased: Number(entry?.amountReleased || 0),
      }))
      .filter(
        (entry) => entry.inventoryItemId && Number(entry.amountReleased) > 0
      )
  : [];
```

- [ ] **Step 4: Verify the model files still load**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node -e "require('./models/ReliefRelease'); require('./models/InventoryLog'); console.log('models ok')"
```

Expected:

```text
models ok
```

- [ ] **Step 5: Commit the model-layer changes**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- MyApp/server/models/ReliefRelease.js MyApp/server/models/InventoryLog.js
git commit -m "feat(server): track monetary release allocations"
```

Expected:

```text
[finalmerged <hash>] feat(server): track monetary release allocations
```

### Task 2: Add a failing controller test for monetary release rollback behavior

**Files:**
- Create: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestNotReceivedRollback.test.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestNotReceivedRollback.test.js`

- [ ] **Step 1: Create a focused failing test harness for the rollback path**

Create `reliefRequestNotReceivedRollback.test.js` with mocked models and assertions around release-specific restoration:

```js
const assert = require("assert");
const Module = require("module");

const ReliefRequest = {};
const ReliefRelease = {};
const InventoryItem = {};
const InventoryLog = {};
const Notification = {};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "../models/ReliefRequest") return ReliefRequest;
  if (request === "../models/ReliefRelease") return ReliefRelease;
  if (request === "../models/InventoryItem") return InventoryItem;
  if (request === "../models/InventoryLog") return InventoryLog;
  if (request === "../models/Notification") return Notification;
  if (request === "../models/Audit") return {};
  if (request === "../models/Barangay") return {};
  if (request === "../models/ReliefDistributionRecord") return {};
  if (request === "../utils/createNotification") return async () => {};
  return originalLoad(request, parent, isMain);
};

const controller = require("./reliefRequestController");
Module._load = originalLoad;

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function testRollsBackOnlyTargetRelease() {
  let itemAAmount = 6000;
  let itemBAmount = 4000;
  const rollbackLogs = [];

  const inventoryDocs = {
    a: {
      _id: "inv-a",
      name: "Cash Pool A",
      amount: itemAAmount,
      async save() {
        itemAAmount = this.amount;
      },
    },
    b: {
      _id: "inv-b",
      name: "Cash Pool B",
      amount: itemBAmount,
      async save() {
        itemBAmount = this.amount;
      },
    },
  };

  const requestDoc = {
    _id: "req-1",
    barangayId: "brgy-1",
    barangayName: "San Jose",
    requestNo: "RR-2026-0010",
    requestType: "monetary",
    status: "released",
    isArchived: false,
  };

  const targetedRelease = {
    _id: "rel-1",
    reliefRequestId: "req-1",
    releaseNo: "RL-2026-0100",
    releaseStatus: "released",
    releasedMonetaryAmount: 3000,
    monetaryAllocations: [
      { inventoryItemId: "inv-a", itemName: "Cash Pool A", amountReleased: 1000 },
      { inventoryItemId: "inv-b", itemName: "Cash Pool B", amountReleased: 2000 },
    ],
    inventoryRestored: false,
    async save() {
      return this;
    },
  };

  const untouchedRelease = {
    _id: "rel-2",
    reliefRequestId: "req-1",
    releaseNo: "RL-2026-0101",
    releaseStatus: "released",
    releasedMonetaryAmount: 500,
    monetaryAllocations: [
      { inventoryItemId: "inv-a", itemName: "Cash Pool A", amountReleased: 500 },
    ],
    inventoryRestored: false,
    async save() {
      return this;
    },
  };

  ReliefRequest.findOne = async () => requestDoc;
  ReliefRelease.find = async (query) => {
    if (String(query.reliefRequestId) !== "req-1") return [];
    return [targetedRelease, untouchedRelease];
  };
  InventoryItem.findById = async (id) => {
    if (String(id) === "inv-a") return inventoryDocs.a;
    if (String(id) === "inv-b") return inventoryDocs.b;
    return null;
  };
  InventoryLog.create = async (docs) => {
    rollbackLogs.push(...docs);
    return docs;
  };

  const originalRefresh = controller.refreshRequestProgress;
  controller.refreshRequestProgress = async () => ({
    _id: "req-1",
    status: "approved",
    fulfillment: {
      releasedMonetaryAmount: 500,
      receivedMonetaryAmount: 0,
    },
  });

  const req = {
    params: { id: "req-1" },
    body: { releaseId: "rel-1" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  controller.refreshRequestProgress = originalRefresh;

  assert.equal(res.statusCode, 200);
  assert.equal(itemAAmount, 7000);
  assert.equal(itemBAmount, 6000);
  assert.equal(targetedRelease.releaseStatus, "cancelled");
  assert.equal(targetedRelease.inventoryRestored, true);
  assert.equal(untouchedRelease.releaseStatus, "released");
  assert.equal(rollbackLogs.length, 2);
  assert.deepEqual(
    rollbackLogs.map((log) => log.action),
    ["rollback", "rollback"]
  );
}

testRollsBackOnlyTargetRelease()
  .then(() => console.log("reliefRequestNotReceivedRollback tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

- [ ] **Step 2: Run the rollback test to verify it fails first**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node controllers/reliefRequestNotReceivedRollback.test.js
```

Expected:

```text
AssertionError
```

The failure should show that inventory amounts were not restored, the release was not cancelled/restored, or rollback logs were not created.

- [ ] **Step 3: Commit the red test harness only if your execution mode wants red-green commits**

If you prefer strict red-green commits:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- MyApp/server/controllers/reliefRequestNotReceivedRollback.test.js
git commit -m "test(server): add monetary release rollback coverage"
```

Otherwise leave it unstaged and proceed directly to implementation.

### Task 3: Persist exact monetary allocation splits during release creation

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefReleaseController.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestNotReceivedRollback.test.js`

- [ ] **Step 1: Capture monetary split details while inventory is being deducted**

Inside `createReliefRelease`, add a local array before the monetary allocation loop:

```js
let monetaryAllocationDetails = [];
```

Populate it inside the existing loop:

```js
for (const split of monetaryAllocation.allocations) {
  split.inventoryDoc.amount =
    toNumber(split.inventoryDoc.amount) - split.amount;

  await split.inventoryDoc.save({ session });

  monetaryAllocationDetails.push({
    inventoryItemId: split.inventoryDoc._id,
    itemName: split.inventoryDoc.name,
    amountReleased: split.amount,
  });

  await InventoryLog.create(
    [
      {
        inventoryItem: split.inventoryDoc._id,
        itemName: split.inventoryDoc.name,
        itemType: split.inventoryDoc.type,
        action: "release",
        quantity: undefined,
        amount: split.amount,
        performedBy: username,
        remarks: `Released monetary support for relief request ${reliefRequest.requestNo}`,
      },
    ],
    { session }
  );
}
```

- [ ] **Step 2: Persist the stored splits on the created release**

Add the field to the `ReliefRelease.create(...)` payload:

```js
monetaryAllocations: monetaryAllocationDetails,
inventoryRestored: false,
```

- [ ] **Step 3: Run the rollback test again to confirm it still fails for the not-received path only**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node controllers/reliefRequestNotReceivedRollback.test.js
```

Expected:

```text
AssertionError
```

The failing assertion should now be in the rollback path rather than “missing monetaryAllocations”.

- [ ] **Step 4: Commit the release-side allocation persistence**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- MyApp/server/controllers/reliefReleaseController.js
git commit -m "feat(server): persist monetary release allocations"
```

Expected:

```text
[finalmerged <hash>] feat(server): persist monetary release allocations
```

### Task 4: Restore inventory for a specific unreveived release

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestController.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestNotReceivedRollback.test.js`

- [ ] **Step 1: Accept a specific release identifier in the request-level not-received flow**

At the start of `reportReliefRequestNotReceived`, read:

```js
const targetReleaseId = String(req.body?.releaseId || "").trim();
```

If missing, return:

```js
return res.status(400).json({
  message: "Release ID is required when reporting a relief delivery as not received.",
});
```

- [ ] **Step 2: Load and validate the specific release for this request**

Replace the current “notify only” behavior with a targeted release lookup:

```js
const release = await ReliefRelease.findOne({
  _id: targetReleaseId,
  reliefRequestId: request._id,
  isArchived: false,
});

if (!release) {
  return res.status(404).json({ message: "Relief release not found." });
}

if (String(release.releaseStatus) !== "released") {
  return res.status(400).json({
    message: "Only active released deliveries can be reported as not received.",
  });
}

if (release.inventoryRestored) {
  return res.status(400).json({
    message: "This release was already restored to inventory.",
  });
}
```

- [ ] **Step 3: Restore exact monetary allocations and mark the release cancelled**

Inside the rollback block, restore each saved split:

```js
for (const allocation of Array.isArray(release.monetaryAllocations)
  ? release.monetaryAllocations
  : []) {
  const inventoryDoc = await InventoryItem.findById(allocation.inventoryItemId);

  if (!inventoryDoc) {
    throw new Error(
      `Monetary inventory source ${allocation.inventoryItemId} was not found for rollback.`
    );
  }

  inventoryDoc.amount =
    toNumber(inventoryDoc.amount) + toNumber(allocation.amountReleased);

  await inventoryDoc.save();

  await InventoryLog.create([
    {
      inventoryItem: inventoryDoc._id,
      itemName: inventoryDoc.name,
      itemType: inventoryDoc.type,
      action: "rollback",
      quantity: undefined,
      amount: toNumber(allocation.amountReleased),
      performedBy: String(req.session?.username || req.session?.userId || ""),
      remarks: `Rolled back monetary release ${release.releaseNo} for relief request ${request.requestNo}`,
    },
  ]);
}

release.releaseStatus = "cancelled";
release.inventoryRestored = true;
release.receivedMonetaryAmount = 0;
release.receivedAt = null;
release.receivedBy = "";
await release.save();
```

- [ ] **Step 4: Refresh request progress and preserve the current notification/audit behavior**

Keep the existing audit and notification calls, but refresh after the rollback:

```js
const updatedRequest = await refreshRequestProgress(request._id);
```

Also include release details in metadata where useful:

```js
metadata: {
  requestType: request.requestType,
  releaseNo: release.releaseNo,
  releaseId: release._id,
}
```

- [ ] **Step 5: Run the rollback test to verify it passes**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node controllers/reliefRequestNotReceivedRollback.test.js
```

Expected:

```text
reliefRequestNotReceivedRollback tests passed
```

- [ ] **Step 6: Commit the rollback implementation**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- MyApp/server/controllers/reliefRequestController.js MyApp/server/controllers/reliefRequestNotReceivedRollback.test.js
git commit -m "fix(server): restore monetary inventory on failed relief delivery"
```

Expected:

```text
[finalmerged <hash>] fix(server): restore monetary inventory on failed relief delivery
```

### Task 5: Verify request progress and inventory history integration

**Files:**
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\utils\inventoryHistoryUtils.js`
- Modify: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\utils\inventoryHistoryUtils.test.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\utils\inventoryHistoryUtils.test.js`

- [ ] **Step 1: Teach inventory history reconstruction to reverse rollback logs**

In `applyInventoryLogToItem`, add rollback handling for monetary and quantity-based items:

```js
if (action === "rollback") {
  if (itemType === "monetary") {
    next.amount = toNumber(next.amount) + toNumber(log.amount);
  } else {
    next.quantity = toNumber(next.quantity) + toNumber(log.quantity);
  }
  return next;
}
```

Place this beside the existing `release` handling so history views stay accurate after restored releases.

- [ ] **Step 2: Add a focused inventory history regression**

Add a test like:

```js
test("restores monetary inventory totals when rollback logs are applied", () => {
  const result = reconstructInventoryStateAsOf({
    inventoryItems: [
      {
        _id: "money-1",
        type: "monetary",
        amount: 1000,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    logs: [
      {
        inventoryItem: "money-1",
        action: "release",
        amount: 250,
        createdAt: "2026-02-01T00:00:00.000Z",
      },
      {
        inventoryItem: "money-1",
        action: "rollback",
        amount: 250,
        createdAt: "2026-02-02T00:00:00.000Z",
      },
    ],
  });

  assert.equal(result.items.monetary[0].amount, 1000);
});
```

- [ ] **Step 3: Run the inventory history test file**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node utils/inventoryHistoryUtils.test.js
```

Expected:

```text
inventoryHistoryUtils tests passed
```

- [ ] **Step 4: Commit the history integration**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged
git add -- MyApp/server/utils/inventoryHistoryUtils.js MyApp/server/utils/inventoryHistoryUtils.test.js
git commit -m "test(server): support rollback-aware inventory history"
```

Expected:

```text
[finalmerged <hash>] test(server): support rollback-aware inventory history
```

### Task 6: Final verification and manual QA

**Files:**
- Modify: none
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\controllers\reliefRequestNotReceivedRollback.test.js`
- Test: `C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server\utils\inventoryHistoryUtils.test.js`

- [ ] **Step 1: Run the targeted server regression tests together**

Run:

```bash
cd C:\Users\jason\OneDrive\Desktop\mergednadis\BackupB4op\.worktrees\finalmerged\MyApp\server
node controllers/reliefRequestNotReceivedRollback.test.js
node utils/inventoryHistoryUtils.test.js
```

Expected:

```text
reliefRequestNotReceivedRollback tests passed
inventoryHistoryUtils tests passed
```

- [ ] **Step 2: Manually verify the release lifecycle in the app**

Manual QA checklist:

```text
1. Approve a monetary relief request as admin or accountant.
2. Release the full approved monetary amount.
3. Confirm the corresponding monetary inventory total is immediately lower.
4. Log in as the barangay and report that specific release as not received.
5. Confirm the inventory total returns by exactly that release amount.
6. Confirm a different release on the same request is not restored.
7. Confirm the request status returns to approved or partially_released based on remaining active releases.
8. Confirm the same release cannot be rolled back twice.
```

- [ ] **Step 3: Leave unrelated frontend dirty files untouched**

Do not stage or alter these existing unrelated worktree changes while implementing this rollback fix:

```text
tests/src/App.test.js
tests/src/components/css/Dashboard.css
tests/src/components/css/DonationValidationQueue.css
tests/src/components/css/Inventory.css
tests/src/components/css/sidebar.css
tests/src/components/entry/Dashboard.inlineValidation.test.js
tests/src/components/entry/Dashboard.js
tests/src/components/layout/DashboardShell.js
```

## Self-Review

- Spec coverage: The plan covers release-time monetary deduction tracking, release-specific rollback, restoration to exact source inventory entries, rollback logging, status refresh, and inventory history integration.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation steps remain; each task includes concrete code targets and commands.
- Type consistency: The plan consistently uses `monetaryAllocations`, `inventoryRestored`, `rollback`, `releasedMonetaryAmount`, and `receivedMonetaryAmount` across models, controllers, and tests.

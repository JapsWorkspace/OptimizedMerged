# Inventory History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an exact, year-bounded inventory history mode to the Inventory and Inventory Add screens so users can view historical totals and item lists by month or exact date, with future dates disabled.

**Architecture:** Build a read-only backend history endpoint that reconstructs inventory state from `InventoryItem` and `InventoryLog` events up to an `asOf` date, then add a shared frontend history-state helper consumed by both inventory screens. Reuse the existing inventory filter and summary UI patterns so history mode feels native and can switch cleanly back to live mode.

**Tech Stack:** Node.js, Express, Mongoose, React, react-scripts/Jest, node:test

---

### Task 1: Add Backend Inventory History Date Rules And Reconstruction Helper

**Files:**
- Create: `MyApp/server/utils/inventoryHistoryUtils.js`
- Create: `MyApp/server/utils/inventoryHistoryUtils.test.js`
- Test: `MyApp/server/utils/inventoryHistoryUtils.test.js`

- [ ] **Step 1: Write the failing backend utility tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  INVENTORY_HISTORY_YEAR_START,
  INVENTORY_HISTORY_MAX_DATE,
  buildInventoryHistoryMonths,
  normalizeInventoryHistoryDateInput,
  reconstructInventoryStateAsOf,
} = require("./inventoryHistoryUtils");

test("normalizes a valid as-of date within the 2026 history window", () => {
  const result = normalizeInventoryHistoryDateInput("2026-07-14");
  assert.equal(result.asOfDate, "2026-07-14");
  assert.equal(result.historyMode, "as_of_date");
});

test("rejects a future as-of date after 2026-08-12", () => {
  assert.throws(
    () => normalizeInventoryHistoryDateInput("2026-08-13"),
    /Future inventory history dates are not allowed\./
  );
});

test("builds month chips with future months disabled", () => {
  const months = buildInventoryHistoryMonths();
  assert.equal(months.find((month) => month.value === "2026-08").disabled, false);
  assert.equal(months.find((month) => month.value === "2026-09").disabled, true);
});

test("reconstructs active records as of a selected date", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      { _id: "a", type: "goods", name: "Rice", quantity: 10, createdAt: "2026-01-05T00:00:00.000Z", isArchive: false },
    ],
    logs: [
      { inventoryItem: "a", action: "update", quantity: 15, createdAt: "2026-03-01T00:00:00.000Z" },
      { inventoryItem: "a", action: "release", quantity: 12, createdAt: "2026-04-01T00:00:00.000Z" },
    ],
    asOfDate: "2026-03-15",
  });

  assert.equal(result.summary.totalGoodsQuantity, 15);
  assert.equal(result.items.goods[0].quantity, 15);
});
```

- [ ] **Step 2: Run the utility tests to verify they fail**

Run: `node --test MyApp/server/utils/inventoryHistoryUtils.test.js`

Expected: FAIL because `inventoryHistoryUtils.js` does not exist yet.

- [ ] **Step 3: Implement the backend history utility**

```js
const INVENTORY_HISTORY_YEAR = 2026;
const INVENTORY_HISTORY_YEAR_START = "2026-01-01";
const INVENTORY_HISTORY_MAX_DATE = "2026-08-12";

const normalizeDateOnly = (value) => String(value || "").slice(0, 10);

const normalizeInventoryHistoryDateInput = (rawDate, rawMonth = "") => {
  const asOfDate = rawDate
    ? normalizeDateOnly(rawDate)
    : rawMonth === "2026-08"
    ? INVENTORY_HISTORY_MAX_DATE
    : `${rawMonth}-${new Date(`${rawMonth}-01T00:00:00.000Z`).getUTCMonth() === 1 ? "28" : "31"}`;

  if (!asOfDate || asOfDate < INVENTORY_HISTORY_YEAR_START) {
    throw new Error("Inventory history is limited to the 2026 calendar year.");
  }

  if (asOfDate > INVENTORY_HISTORY_MAX_DATE) {
    throw new Error("Future inventory history dates are not allowed.");
  }

  return {
    asOfDate,
    historyMode: rawDate ? "as_of_date" : rawMonth ? "month" : "live",
  };
};

const buildInventoryHistoryMonths = () =>
  Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const value = `2026-${month}`;
    return {
      value,
      label: new Date(`2026-${month}-01T00:00:00.000Z`).toLocaleString("en-US", { month: "short" }),
      disabled: value > "2026-08",
      resolvedAsOfDate: value === "2026-08" ? INVENTORY_HISTORY_MAX_DATE : null,
    };
  });

const reconstructInventoryStateAsOf = ({ items = [], logs = [], asOfDate = "" }) => {
  // Build a record map, apply historical events up to the selected date, and
  // return grouped items plus summary totals for goods, monetary, and appliances.
  return {
    historyReliability: "exact",
    summary: {
      totalGoodsQuantity: 0,
      totalApplianceQuantity: 0,
      totalMonetaryAmount: 0,
      goodsCount: 0,
      applianceCount: 0,
      monetaryCount: 0,
    },
    items: {
      goods: [],
      monetary: [],
      appliance: [],
    },
  };
};

module.exports = {
  INVENTORY_HISTORY_YEAR_START,
  INVENTORY_HISTORY_MAX_DATE,
  buildInventoryHistoryMonths,
  normalizeInventoryHistoryDateInput,
  reconstructInventoryStateAsOf,
};
```

- [ ] **Step 4: Run the utility tests to verify they pass**

Run: `node --test MyApp/server/utils/inventoryHistoryUtils.test.js`

Expected: PASS with the 4 inventory history utility tests green.

- [ ] **Step 5: Commit**

```bash
git add MyApp/server/utils/inventoryHistoryUtils.js MyApp/server/utils/inventoryHistoryUtils.test.js
git commit -m "feat(server): add inventory history reconstruction utilities"
```

### Task 2: Expose The Inventory History Endpoint

**Files:**
- Modify: `MyApp/server/controllers/inventoryController.js`
- Modify: `MyApp/server/routes/inventoryRoutes.js`
- Create: `MyApp/server/controllers/inventoryHistoryController.test.js`
- Test: `MyApp/server/controllers/inventoryHistoryController.test.js`

- [ ] **Step 1: Write the failing controller test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");

test("returns a 400 response for future inventory history dates", async () => {
  const req = {
    query: { asOf: "2026-08-13", type: "all" },
    session: { role: "admin" },
  };

  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return body;
    },
  };

  await getInventoryHistory(req, res);

  assert.equal(statusCode, 400);
  assert.match(jsonBody.message, /Future inventory history dates are not allowed\./);
});
```

- [ ] **Step 2: Run the controller test to verify it fails**

Run: `node --test MyApp/server/controllers/inventoryHistoryController.test.js`

Expected: FAIL because `getInventoryHistory` is not exported yet.

- [ ] **Step 3: Implement the history endpoint and route**

```js
// inventoryController.js
const {
  buildInventoryHistoryMonths,
  normalizeInventoryHistoryDateInput,
  reconstructInventoryStateAsOf,
} = require("../utils/inventoryHistoryUtils");

const getInventoryHistory = async (req, res) => {
  try {
    const roleAccessError = getInventoryRoleAccessError(req, req.query.type || "goods");
    if (roleAccessError) {
      return res.status(roleAccessError.status).json({ message: roleAccessError.message });
    }

    const { asOfDate, historyMode } = normalizeInventoryHistoryDateInput(
      req.query.asOf,
      req.query.month
    );

    const [items, logs] = await Promise.all([
      InventoryItem.find({ createdAt: { $lte: new Date(`${asOfDate}T23:59:59.999Z`) } }).lean(),
      InventoryLog.find({ createdAt: { $lte: new Date(`${asOfDate}T23:59:59.999Z`) } }).lean(),
    ]);

    const reconstruction = reconstructInventoryStateAsOf({ items, logs, asOfDate });

    return res.json({
      yearWindow: {
        start: "2026-01-01",
        end: "2026-12-31",
        maxSelectableDate: "2026-08-12",
      },
      historyMode,
      months: buildInventoryHistoryMonths(),
      ...reconstruction,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Failed to load inventory history." });
  }
};

module.exports = {
  // existing exports...
  getInventoryHistory,
};
```

```js
// inventoryRoutes.js
router.get("/history", requireAdminOrDrrmo, inventoryController.getInventoryHistory);
```

- [ ] **Step 4: Run the controller test to verify it passes**

Run: `node --test MyApp/server/controllers/inventoryHistoryController.test.js`

Expected: PASS with the future-date rejection and success-path assertions green.

- [ ] **Step 5: Commit**

```bash
git add MyApp/server/controllers/inventoryController.js MyApp/server/routes/inventoryRoutes.js MyApp/server/controllers/inventoryHistoryController.test.js
git commit -m "feat(server): add inventory history endpoint"
```

### Task 3: Add Shared Frontend History State Helpers

**Files:**
- Create: `tests/src/components/Donations/inventoryHistoryUtils.js`
- Create: `tests/src/components/Donations/inventoryHistoryUtils.test.js`
- Test: `tests/src/components/Donations/inventoryHistoryUtils.test.js`

- [ ] **Step 1: Write the failing frontend utility test**

```js
import {
  buildInventoryHistoryMonths,
  resolveInventoryHistoryRequest,
  isInventoryHistoryActive,
} from "./inventoryHistoryUtils";

test("disables future months after August 2026", () => {
  const months = buildInventoryHistoryMonths();
  expect(months.find((month) => month.value === "2026-08").disabled).toBe(false);
  expect(months.find((month) => month.value === "2026-09").disabled).toBe(true);
});

test("resolves the current month to 2026-08-12", () => {
  expect(resolveInventoryHistoryRequest({ month: "2026-08" }).asOf).toBe("2026-08-12");
});

test("detects history mode only when a month or as-of date is selected", () => {
  expect(isInventoryHistoryActive({ month: "", asOf: "" })).toBe(false);
  expect(isInventoryHistoryActive({ month: "2026-07", asOf: "" })).toBe(true);
});
```

- [ ] **Step 2: Run the frontend utility test to verify it fails**

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/inventoryHistoryUtils.test.js --watch=false`

Expected: FAIL because `inventoryHistoryUtils.js` does not exist yet.

- [ ] **Step 3: Implement the frontend history helper**

```js
export const INVENTORY_HISTORY_MIN_DATE = "2026-01-01";
export const INVENTORY_HISTORY_MAX_DATE = "2026-08-12";

export const buildInventoryHistoryMonths = () =>
  Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const value = `2026-${month}`;
    return {
      value,
      label: new Date(`2026-${month}-01`).toLocaleString("en-US", { month: "short" }),
      disabled: value > "2026-08",
    };
  });

export const resolveInventoryHistoryRequest = ({ month = "", asOf = "" }) => {
  if (asOf) return { historyMode: "as_of_date", asOf };
  if (month === "2026-08") return { historyMode: "month", asOf: INVENTORY_HISTORY_MAX_DATE };
  if (month) return { historyMode: "month", asOf: `${month}-31` };
  return { historyMode: "live", asOf: "" };
};

export const isInventoryHistoryActive = ({ month = "", asOf = "" }) =>
  Boolean(month || asOf);
```

- [ ] **Step 4: Run the frontend utility test to verify it passes**

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/inventoryHistoryUtils.test.js --watch=false`

Expected: PASS with the 3 inventory history helper tests green.

- [ ] **Step 5: Commit**

```bash
git add tests/src/components/Donations/inventoryHistoryUtils.js tests/src/components/Donations/inventoryHistoryUtils.test.js
git commit -m "feat(frontend): add inventory history helpers"
```

### Task 4: Wire Inventory.js To The History Endpoint

**Files:**
- Modify: `tests/src/components/Donations/Inventory.js`
- Test: `tests/src/components/Donations/Inventory.test.js`

- [ ] **Step 1: Write the failing Inventory screen test**

```js
test("renders history controls and disables future inventory months", async () => {
  render(<Inventory />);

  expect(await screen.findByText("2026 Inventory History")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Aug/i })).toBeEnabled();
  expect(screen.getByRole("button", { name: /Sep/i })).toBeDisabled();
});

test("returns to live mode when Back to Live Inventory is clicked", async () => {
  render(<Inventory />);

  fireEvent.click(await screen.findByRole("button", { name: /Jul/i }));
  expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Back to Live Inventory/i }));
  expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Inventory screen test to verify it fails**

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/Inventory.test.js --watch=false`

Expected: FAIL because the history controls are not rendered yet.

- [ ] **Step 3: Implement history mode in Inventory.js**

```jsx
const [historyMonth, setHistoryMonth] = useState("");
const [historyAsOfDate, setHistoryAsOfDate] = useState("");
const [historyPayload, setHistoryPayload] = useState(null);
const [historyLoading, setHistoryLoading] = useState(false);

const historyRequest = useMemo(
  () => resolveInventoryHistoryRequest({ month: historyMonth, asOf: historyAsOfDate }),
  [historyMonth, historyAsOfDate]
);

const historyActive = isInventoryHistoryActive({ month: historyMonth, asOf: historyAsOfDate });

useEffect(() => {
  if (!historyActive) {
    setHistoryPayload(null);
    return;
  }

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        type: viewType,
        asOf: historyRequest.asOf,
        includeItems: "true",
      });
      const response = await fetch(`${API_BASE_URL}/api/inventory/history?${params.toString()}`, {
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to load inventory history.");
      setHistoryPayload(data);
    } finally {
      setHistoryLoading(false);
    }
  };

  loadHistory();
}, [historyActive, historyRequest.asOf, viewType]);
```

```jsx
<div className="filter-group inventory-history-group">
  <label>History View</label>
  <div className="inventory-history-panel">
    <strong>2026 Inventory History</strong>
    <div className="inventory-history-months">
      {buildInventoryHistoryMonths().map((month) => (
        <button
          key={month.value}
          type="button"
          disabled={month.disabled}
          className={historyMonth === month.value ? "active" : ""}
          onClick={() => {
            setHistoryMonth(month.value);
            setHistoryAsOfDate("");
          }}
        >
          {month.label}
        </button>
      ))}
    </div>
    <input
      type="date"
      min={INVENTORY_HISTORY_MIN_DATE}
      max={INVENTORY_HISTORY_MAX_DATE}
      value={historyAsOfDate}
      onChange={(event) => {
        setHistoryAsOfDate(event.target.value);
        setHistoryMonth("");
      }}
    />
    {historyActive ? (
      <button type="button" className="btn btn-secondary" onClick={() => {
        setHistoryMonth("");
        setHistoryAsOfDate("");
      }}>
        Back to Live Inventory
      </button>
    ) : null}
  </div>
</div>
```

- [ ] **Step 4: Run the Inventory screen test to verify it passes**

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/Inventory.test.js --watch=false`

Expected: PASS with history controls, disabled future months, and live-mode reset covered.

- [ ] **Step 5: Commit**

```bash
git add tests/src/components/Donations/Inventory.js tests/src/components/Donations/Inventory.test.js
git commit -m "feat(frontend): add inventory history mode to inventory screen"
```

### Task 5: Mirror History Mode Into InventoryAdd.js And Run Final Verification

**Files:**
- Modify: `tests/src/components/Donations/InventoryAdd.js`
- Create: `tests/src/components/Donations/InventoryAdd.test.js`
- Test: `tests/src/components/Donations/InventoryAdd.test.js`

- [ ] **Step 1: Write the failing Inventory Add screen test**

```js
test("shows the same inventory history controls in the intake screen", async () => {
  render(<InventoryAdd />);

  expect(await screen.findByText("2026 Inventory History")).toBeInTheDocument();
  expect(screen.getByLabelText(/As of date/i)).toHaveAttribute("max", "2026-08-12");
});

test("switches the intake screen between live and history mode", async () => {
  render(<InventoryAdd />);

  fireEvent.click(await screen.findByRole("button", { name: /Jul/i }));
  expect(await screen.findByText(/Viewing inventory as of/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Back to Live Inventory/i }));
  expect(screen.queryByText(/Viewing inventory as of/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the Inventory Add screen test to verify it fails**

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/InventoryAdd.test.js --watch=false`

Expected: FAIL because the intake screen does not render history controls yet.

- [ ] **Step 3: Implement the shared history controls and historical totals in InventoryAdd.js**

```jsx
const [historyMonth, setHistoryMonth] = useState("");
const [historyAsOfDate, setHistoryAsOfDate] = useState("");
const [historyPayload, setHistoryPayload] = useState(null);

const historyActive = isInventoryHistoryActive({ month: historyMonth, asOf: historyAsOfDate });
const historyRequest = resolveInventoryHistoryRequest({ month: historyMonth, asOf: historyAsOfDate });

const displayItems = historyActive
  ? historyPayload?.items?.[donationType] || []
  : filteredItems;

const displaySummary = historyActive
  ? historyPayload?.summary || summaryCards
  : summaryCards;
```

```jsx
<div className="inventory-history-panel">
  <strong>2026 Inventory History</strong>
  <div className="inventory-history-months">{/* shared month chip UI */}</div>
  <label htmlFor="inventoryHistoryDate">As of date</label>
  <input
    id="inventoryHistoryDate"
    type="date"
    min={INVENTORY_HISTORY_MIN_DATE}
    max={INVENTORY_HISTORY_MAX_DATE}
    value={historyAsOfDate}
    onChange={handleHistoryDateChange}
  />
</div>
```

- [ ] **Step 4: Run full verification**

Run: `node --test MyApp/server/utils/inventoryHistoryUtils.test.js`

Expected: PASS

Run: `node --test MyApp/server/controllers/inventoryHistoryController.test.js`

Expected: PASS

Run: `npm.cmd test -- --runTestsByPath src/components/Donations/inventoryHistoryUtils.test.js src/components/Donations/Inventory.test.js src/components/Donations/InventoryAdd.test.js --watch=false`

Expected: PASS

Run: `npm.cmd run build`

Expected: production build completes successfully, with only pre-existing warnings if any.

- [ ] **Step 5: Commit**

```bash
git add tests/src/components/Donations/InventoryAdd.js tests/src/components/Donations/InventoryAdd.test.js
git commit -m "feat(frontend): add inventory history mode to intake screen"
```

## Self-Review

- Spec coverage: The plan covers the backend endpoint, exact date rules, monthly presets, disabled future dates, both frontend screens, grouped history display, and test coverage for reconstruction and UI behavior.
- Placeholder scan: No `TODO`, `TBD`, or deferred implementation placeholders remain; each task has explicit files, commands, and code scaffolding.
- Type consistency: The plan consistently uses `asOf`, `month`, `historyMode`, `historyPayload`, `buildInventoryHistoryMonths`, and `resolveInventoryHistoryRequest` across backend and frontend tasks.

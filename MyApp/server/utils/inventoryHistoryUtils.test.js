const test = require("node:test");
const assert = require("node:assert/strict");

const {
  INVENTORY_HISTORY_YEAR,
  INVENTORY_HISTORY_YEAR_START,
  INVENTORY_HISTORY_MAX_DATE,
  buildInventoryHistoryMonths,
  normalizeInventoryHistoryDateInput,
  reconstructInventoryStateAsOf,
} = require("./inventoryHistoryUtils");

test("normalizes a valid as-of date within the active history window", () => {
  const result = normalizeInventoryHistoryDateInput(`${INVENTORY_HISTORY_YEAR}-07-14`);
  assert.equal(result.asOfDate, `${INVENTORY_HISTORY_YEAR}-07-14`);
  assert.equal(result.historyMode, "as_of_date");
  assert.equal(INVENTORY_HISTORY_YEAR_START, `${INVENTORY_HISTORY_YEAR}-01-01`);
  assert.match(INVENTORY_HISTORY_MAX_DATE, /^\d{4}-\d{2}-\d{2}$/);
});

test("rejects a future as-of date after the current max date", () => {
  const [yearText, monthText, dayText] = INVENTORY_HISTORY_MAX_DATE.split("-");
  const futureDateObject = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText) + 1
  );
  const futureDate = `${futureDateObject.getFullYear()}-${String(
    futureDateObject.getMonth() + 1
  ).padStart(2, "0")}-${String(futureDateObject.getDate()).padStart(2, "0")}`;
  assert.throws(
    () => normalizeInventoryHistoryDateInput(futureDate),
    /Future inventory history dates are not allowed\./
  );
});

test("rejects malformed explicit as-of dates", () => {
  assert.throws(
    () => normalizeInventoryHistoryDateInput(`${INVENTORY_HISTORY_YEAR}-02-31`),
    new RegExp(`Inventory history is limited to the ${INVENTORY_HISTORY_YEAR} calendar year\\.`)
  );

  assert.throws(
    () => normalizeInventoryHistoryDateInput(`${INVENTORY_HISTORY_YEAR}-02-xx`),
    new RegExp(`Inventory history is limited to the ${INVENTORY_HISTORY_YEAR} calendar year\\.`)
  );
});

test("defaults empty inventory history input to live mode at the current max date", () => {
  const result = normalizeInventoryHistoryDateInput();
  assert.equal(result.asOfDate, INVENTORY_HISTORY_MAX_DATE);
  assert.equal(result.historyMode, "live");
});

test("builds month chips with future months disabled after the current month", () => {
  const months = buildInventoryHistoryMonths();
  const currentMonth = INVENTORY_HISTORY_MAX_DATE.slice(0, 7);
  const currentMonthChip = months.find((month) => month.value === currentMonth);
  const nextMonthDate = new Date(INVENTORY_HISTORY_YEAR, Number(currentMonth.slice(5, 7)), 1);
  const nextMonthValue = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthChip = months.find((month) => month.value === nextMonthValue);

  assert.equal(currentMonthChip?.disabled, false);
  if (nextMonthChip) {
    assert.equal(nextMonthChip.disabled, true);
  }
});

test("reconstructs active records as of a selected date", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      {
        _id: "a",
        type: "goods",
        name: "Rice",
        quantity: 10,
        createdAt: "2026-01-05T00:00:00.000Z",
        isArchive: false,
      },
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

test("reconstructs mixed-case inventory types consistently", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      {
        _id: "goods-1",
        type: "Goods",
        name: "Rice",
        quantity: "10",
        createdAt: "2026-01-05T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "money-1",
        type: "Monetary",
        name: "Fund",
        amount: "500",
        createdAt: "2026-01-06T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "appliance-1",
        type: "Appliance",
        name: "Generator",
        quantity: "2",
        createdAt: "2026-01-07T00:00:00.000Z",
        isArchive: false,
      },
    ],
    logs: [
      { inventoryItem: "goods-1", action: "release", quantity: 3, createdAt: "2026-02-01T00:00:00.000Z" },
      { inventoryItem: "money-1", action: "release", amount: 125, createdAt: "2026-02-02T00:00:00.000Z" },
      { inventoryItem: "appliance-1", action: "update", quantity: 4, createdAt: "2026-02-03T00:00:00.000Z" },
    ],
    asOfDate: "2026-02-15",
  });

  assert.equal(result.summary.totalGoodsQuantity, 7);
  assert.equal(result.summary.totalMonetaryAmount, 375);
  assert.equal(result.summary.totalApplianceQuantity, 4);
  assert.equal(result.items.goods[0].quantity, 7);
  assert.equal(result.items.monetary[0].amount, 375);
  assert.equal(result.items.appliance[0].quantity, 4);
});

test("restores released inventory when rollback logs are applied", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      {
        _id: "money-1",
        type: "monetary",
        name: "Emergency Fund",
        amount: 1000,
        createdAt: "2026-01-01T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "goods-1",
        type: "goods",
        name: "Rice",
        quantity: 30,
        createdAt: "2026-01-01T00:00:00.000Z",
        isArchive: false,
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
      {
        inventoryItem: "goods-1",
        action: "release",
        quantity: 5,
        createdAt: "2026-02-03T00:00:00.000Z",
      },
      {
        inventoryItem: "goods-1",
        action: "rollback",
        quantity: 5,
        createdAt: "2026-02-04T00:00:00.000Z",
      },
    ],
    asOfDate: "2026-02-15",
  });

  assert.equal(result.summary.totalMonetaryAmount, 1000);
  assert.equal(result.summary.totalGoodsQuantity, 30);
  assert.equal(result.items.monetary[0].amount, 1000);
  assert.equal(result.items.goods[0].quantity, 30);
});

test("reconstructs inventory history from Mongo Date objects", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      {
        _id: "money-1",
        type: "monetary",
        name: "Emergency Fund",
        amount: 2500,
        createdAt: new Date("2026-08-18T09:00:00.000Z"),
        isArchive: false,
      },
    ],
    logs: [
      {
        inventoryItem: "money-1",
        action: "release",
        amount: 500,
        createdAt: new Date("2026-08-20T12:00:00.000Z"),
      },
    ],
    asOfDate: "2026-08-21",
  });

  assert.equal(result.summary.totalMonetaryAmount, 2000);
  assert.equal(result.summary.monetaryCount, 1);
  assert.equal(result.items.monetary.length, 1);
  assert.equal(result.items.monetary[0].amount, 2000);
});

test("excludes undated items and logs from exact reconstruction", () => {
  const result = reconstructInventoryStateAsOf({
    items: [
      {
        _id: "dated-goods",
        type: "goods",
        name: "Rice",
        quantity: 10,
        createdAt: "2026-01-05T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "undated-goods",
        type: "goods",
        name: "Beans",
        quantity: 99,
        isArchive: false,
      },
    ],
    logs: [
      { inventoryItem: "dated-goods", action: "update", quantity: 15, createdAt: "2026-02-01T00:00:00.000Z" },
      { inventoryItem: "dated-goods", action: "release", quantity: 12 },
      { inventoryItem: "undated-goods", action: "release", quantity: 50, createdAt: "2026-02-02T00:00:00.000Z" },
    ],
    asOfDate: "2026-02-15",
  });

  assert.equal(result.summary.totalGoodsQuantity, 15);
  assert.equal(result.summary.goodsCount, 1);
  assert.equal(result.items.goods.length, 1);
  assert.equal(result.items.goods[0]._id, "dated-goods");
  assert.equal(result.items.goods[0].quantity, 15);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const {
  INVENTORY_HISTORY_MAX_DATE,
  INVENTORY_HISTORY_YEAR_START,
} = require("../utils/inventoryHistoryUtils");

const InventoryItem = {};
const InventoryLog = {};
const Donation = {};
const InventoryProofFile = {};
const Notification = {};
const ReliefRelease = {};
const cloudinary = { uploader: { upload_stream() {}, upload() {} } };
const createNotification = async () => {};
const aiAnalyticsProvider = { callAiAnalyticsProvider: async () => ({}) };

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "pdfkit") {
    return class PDFDocument {};
  }

  if (request === "../models/Donation") {
    return Donation;
  }

  if (request === "../models/InventoryItem") {
    return InventoryItem;
  }

  if (request === "../models/InventoryProofFile") {
    return InventoryProofFile;
  }

  if (request === "../models/InventoryLog") {
    return InventoryLog;
  }

  if (request === "../models/Notification") {
    return Notification;
  }

  if (request === "../models/ReliefRelease") {
    return ReliefRelease;
  }

  if (request === "../config/cloudinary") {
    return cloudinary;
  }

  if (request === "../utils/createNotification") {
    return createNotification;
  }

  if (request === "../utils/aiAnalyticsProvider") {
    return aiAnalyticsProvider;
  }

  return originalLoad.call(this, request, parent, isMain);
};

const { getInventoryHistory } = require("./inventoryController");

test("returns a 400 response for future inventory history dates", async () => {
  const [yearText, monthText, dayText] = INVENTORY_HISTORY_MAX_DATE.split("-");
  const futureDateObject = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText) + 1
  );
  const futureDate = `${futureDateObject.getFullYear()}-${String(
    futureDateObject.getMonth() + 1
  ).padStart(2, "0")}-${String(futureDateObject.getDate()).padStart(2, "0")}`;
  const req = {
    query: { asOf: futureDate, type: "all" },
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

test("returns a 400 response for invalid inventory history type values", async () => {
  const req = {
    query: { type: "invalid-type" },
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
  assert.equal(jsonBody.message, "Invalid inventory history type.");
});

test("returns a 500 response for internal inventory history query failures", async () => {
  const originalInventoryItemFind = InventoryItem.find;

  InventoryItem.find = () => ({
    lean: async () => {
      throw new Error("Database unavailable");
    },
  });

  try {
    const req = {
      query: { type: "all" },
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

    assert.equal(statusCode, 500);
    assert.equal(jsonBody.message, "Database unavailable");
  } finally {
    InventoryItem.find = originalInventoryItemFind;
  }
});

test("returns reconstructed inventory history for the current live history window", async () => {
  const originalInventoryItemFind = InventoryItem.find;
  const originalInventoryLogFind = InventoryLog.find;

  const items = [
    {
      _id: "goods-1",
      type: "goods",
      name: "Rice",
      quantity: 10,
        createdAt: `${INVENTORY_HISTORY_YEAR_START}T00:00:00.000Z`,
        isArchive: false,
      },
      {
        _id: "money-1",
        type: "monetary",
        name: "Cash Fund",
        amount: 500,
        createdAt: `${INVENTORY_HISTORY_YEAR_START.slice(0, 4)}-06-01T00:00:00.000Z`,
        isArchive: false,
      },
    ];
  const logs = [
    {
      inventoryItem: "goods-1",
      action: "release",
      quantity: 3,
      createdAt: `${INVENTORY_HISTORY_YEAR_START.slice(0, 4)}-08-10T00:00:00.000Z`,
    },
    {
      inventoryItem: "money-1",
      action: "release",
      amount: 125,
      createdAt: `${INVENTORY_HISTORY_YEAR_START.slice(0, 4)}-08-12T00:00:00.000Z`,
    },
  ];

  let itemQuery = null;
  let logQuery = null;

  InventoryItem.find = (query) => {
    itemQuery = query;
    return {
      lean: async () => items,
    };
  };

  InventoryLog.find = (query) => {
    logQuery = query;
    return {
      lean: async () => logs,
    };
  };

  try {
    const req = {
      query: { type: "all" },
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

    assert.equal(statusCode, 200);
    assert.deepEqual(itemQuery, {
      createdAt: { $lte: new Date(`${INVENTORY_HISTORY_MAX_DATE}T23:59:59.999Z`) },
    });
    assert.deepEqual(logQuery, {
      createdAt: { $lte: new Date(`${INVENTORY_HISTORY_MAX_DATE}T23:59:59.999Z`) },
    });
    assert.equal(jsonBody.yearWindow.start, INVENTORY_HISTORY_YEAR_START);
    assert.equal(jsonBody.yearWindow.maxSelectableDate, INVENTORY_HISTORY_MAX_DATE);
    assert.equal(jsonBody.historyMode, "live");
    assert.equal(jsonBody.historyReliability, "exact");
    assert.equal(jsonBody.summary.totalGoodsQuantity, 7);
    assert.equal(jsonBody.summary.totalMonetaryAmount, 375);
    assert.equal(jsonBody.items.goods.length, 1);
    assert.equal(jsonBody.items.monetary.length, 1);
    assert.equal(
      jsonBody.months.find((month) => month.value === "2026-08").resolvedAsOfDate,
      INVENTORY_HISTORY_MAX_DATE
    );
    assert.equal(jsonBody.months.find((month) => month.value === "2026-09").disabled, true);
  } finally {
    InventoryItem.find = originalInventoryItemFind;
    InventoryLog.find = originalInventoryLogFind;
  }
});

test("returns only the requested inventory type slice when a valid specific type is selected", async () => {
  const originalInventoryItemFind = InventoryItem.find;
  const originalInventoryLogFind = InventoryLog.find;

  InventoryItem.find = () => ({
    lean: async () => [
      {
        _id: "goods-1",
        type: "goods",
        name: "Rice",
        quantity: 10,
        createdAt: "2026-01-05T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "money-1",
        type: "monetary",
        name: "Cash Fund",
        amount: 500,
        createdAt: "2026-06-01T00:00:00.000Z",
        isArchive: false,
      },
    ],
  });

  InventoryLog.find = () => ({
    lean: async () => [
      {
        inventoryItem: "goods-1",
        action: "release",
        quantity: 3,
        createdAt: "2026-08-10T00:00:00.000Z",
      },
      {
        inventoryItem: "money-1",
        action: "release",
        amount: 125,
        createdAt: "2026-08-12T00:00:00.000Z",
      },
    ],
  });

  try {
    const req = {
      query: { type: "monetary" },
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

    assert.equal(statusCode, 200);
    assert.equal(jsonBody.summary.totalMonetaryAmount, 375);
    assert.equal(jsonBody.summary.monetaryCount, 1);
    assert.equal(jsonBody.summary.totalGoodsQuantity, 0);
    assert.equal(jsonBody.summary.goodsCount, 0);
    assert.equal(jsonBody.items.monetary.length, 1);
    assert.equal(jsonBody.items.goods.length, 0);
    assert.equal(jsonBody.items.appliance.length, 0);
  } finally {
    InventoryItem.find = originalInventoryItemFind;
    InventoryLog.find = originalInventoryLogFind;
  }
});

test("filters the default history response by viewer role permissions", async () => {
  const originalInventoryItemFind = InventoryItem.find;
  const originalInventoryLogFind = InventoryLog.find;

  InventoryItem.find = () => ({
    lean: async () => [
      {
        _id: "goods-1",
        type: "goods",
        name: "Rice",
        quantity: 10,
        createdAt: "2026-01-05T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "appliance-1",
        type: "appliance",
        name: "Generator",
        quantity: 2,
        createdAt: "2026-03-01T00:00:00.000Z",
        isArchive: false,
      },
      {
        _id: "money-1",
        type: "monetary",
        name: "Cash Fund",
        amount: 500,
        createdAt: "2026-06-01T00:00:00.000Z",
        isArchive: false,
      },
    ],
  });

  InventoryLog.find = () => ({
    lean: async () => [],
  });

  try {
    const req = {
      query: { type: "all" },
      session: { role: "accountant" },
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

    assert.equal(statusCode, 200);
    assert.equal(jsonBody.items.goods.length, 0);
    assert.equal(jsonBody.items.appliance.length, 0);
    assert.equal(jsonBody.items.monetary.length, 1);
    assert.equal(jsonBody.summary.goodsCount, 0);
    assert.equal(jsonBody.summary.applianceCount, 0);
    assert.equal(jsonBody.summary.monetaryCount, 1);
    assert.equal(jsonBody.summary.totalMonetaryAmount, 500);
  } finally {
    InventoryItem.find = originalInventoryItemFind;
    InventoryLog.find = originalInventoryLogFind;
  }
});

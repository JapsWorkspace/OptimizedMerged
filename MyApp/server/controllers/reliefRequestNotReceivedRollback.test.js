const assert = require("assert");
const Module = require("module");

let lastSession = null;
const mongoose = {
  startSession: async () => {
    lastSession = {
      started: false,
      committed: false,
      aborted: false,
      ended: false,
      startTransaction() {
        this.started = true;
      },
      async commitTransaction() {
        this.committed = true;
      },
      async abortTransaction() {
        this.aborted = true;
      },
      inTransaction() {
        return this.started && !this.committed && !this.aborted;
      },
      async endSession() {
        this.ended = true;
      },
    };
    return lastSession;
  },
};

const ReliefRequest = {};
const ReliefRelease = {};
const InventoryItem = {};
const InventoryLog = {};
let createNotificationMock = async () => {};
let createAuditEventMock = async () => {};
let capturedNotifications = [];
let capturedAuditEvents = [];

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mongoose") return mongoose;
  if (request === "../models/ReliefRequest") return ReliefRequest;
  if (request === "../models/ReliefRelease") return ReliefRelease;
  if (request === "../models/InventoryItem") return InventoryItem;
  if (request === "../models/InventoryLog") return InventoryLog;
  if (request === "../models/Barangay") return {};
  if (request === "../models/EvacPlace") return {};
  if (request === "../utils/sendReliefRequestEmail") return async () => {};
  if (request === "../utils/createNotification") {
    return async (...args) => {
      capturedNotifications.push(args[0]);
      return createNotificationMock(...args);
    };
  }
  if (request === "../utils/createAuditEvent") {
    return async (...args) => {
      capturedAuditEvents.push(args[0]);
      return createAuditEventMock(...args);
    };
  }
  if (request === "../utils/pdfTheme") return {};
  return originalLoad(request, parent, isMain);
};

const controller = require("./reliefRequestController");
Module._load = originalLoad;

const queryResult = (value) => ({
  session: async () => value,
  sort() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const createRes = () => ({
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
});

const buildRequestDoc = (overrides = {}) => ({
  _id: "req-1",
  barangayId: "brgy-1",
  barangayName: "San Jose",
  requestNo: "RR-2026-0010",
  requestType: "monetary",
  supportTypes: ["monetary"],
  totals: { requestedMonetaryAmount: 3000 },
  fulfillment: { releasedMonetaryAmount: 3000, receivedMonetaryAmount: 0 },
  rows: [],
  status: "released",
  currentStage: "released_waiting_receipt",
  isArchived: false,
  async save() {},
  ...overrides,
});

const buildReleaseDoc = (overrides = {}) => ({
  _id: "rel-1",
  reliefRequestId: "req-1",
  releaseNo: "RL-2026-0100",
  releaseStatus: "released",
  foodPacksReleased: 0,
  items: [],
  releasedMonetaryAmount: 3000,
  receivedMonetaryAmount: 250,
  monetaryAllocations: [
    { inventoryItemId: "inv-a", itemName: "Cash Pool A", amountReleased: 1000 },
    { inventoryItemId: "inv-b", itemName: "Cash Pool B", amountReleased: 2000 },
  ],
  inventoryRestored: false,
  receiptProofFiles: ["proof-a.png"],
  receivedAt: new Date("2026-08-18T10:00:00.000Z"),
  receivedBy: "reader",
  async save() {},
  ...overrides,
});

async function testRollsBackOnlyTargetReleaseAndRefreshesRequest() {
  capturedNotifications = [];
  capturedAuditEvents = [];
  createNotificationMock = async () => {};
  createAuditEventMock = async () => {};
  const rollbackLogs = [];
  const inventoryDocs = {
    "inv-a": {
      _id: "inv-a",
      name: "Cash Pool A",
      type: "monetary",
      amount: 6000,
      async save() {},
    },
    "inv-b": {
      _id: "inv-b",
      name: "Cash Pool B",
      type: "monetary",
      amount: 4000,
      async save() {},
    },
  };
  const requestDoc = buildRequestDoc();
  const targetedRelease = buildReleaseDoc();
  const untouchedRelease = buildReleaseDoc({
    _id: "rel-2",
    releaseNo: "RL-2026-0101",
    releaseStatus: "cancelled",
    releasedMonetaryAmount: 500,
    monetaryAllocations: [
      { inventoryItemId: "inv-a", itemName: "Cash Pool A", amountReleased: 500 },
    ],
    inventoryRestored: true,
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRequest.findById = () => queryResult(requestDoc);
  ReliefRelease.findOne = (query) =>
    queryResult(
      query._id === "rel-1" && String(query.reliefRequestId) === "req-1"
        ? targetedRelease
        : null
    );
  ReliefRelease.find = () => queryResult([targetedRelease, untouchedRelease]);
  InventoryItem.findById = (id) => queryResult(inventoryDocs[id] || null);
  InventoryLog.create = async (entries) => {
    rollbackLogs.push(...entries);
    return entries;
  };

  const req = {
    params: { id: "req-1" },
    body: { releaseId: "rel-1" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(inventoryDocs["inv-a"].amount, 7000);
  assert.equal(inventoryDocs["inv-b"].amount, 6000);
  assert.equal(targetedRelease.releaseStatus, "cancelled");
  assert.equal(targetedRelease.inventoryRestored, true);
  assert.equal(targetedRelease.receivedMonetaryAmount, 0);
  assert.equal(targetedRelease.receivedAt, null);
  assert.equal(targetedRelease.receivedBy, "");
  assert.deepEqual(targetedRelease.receiptProofFiles, []);
  assert.equal(untouchedRelease.releaseStatus, "cancelled");
  assert.equal(untouchedRelease.inventoryRestored, true);
  assert.equal(res.body.request.status, "approved");
  assert.equal(res.body.request.currentStage, "approved_waiting_release");
  assert.equal(res.body.request.fulfillment.releasedMonetaryAmount, 0);
  assert.equal(res.body.request.fulfillment.receivedMonetaryAmount, 0);
  assert.equal(capturedAuditEvents.length, 1);
  assert.equal(capturedNotifications.length, 1);
  assert.deepEqual(
    rollbackLogs.map((log) => ({
      inventoryItem: log.inventoryItem,
      amount: log.amount,
      action: log.action,
    })),
    [
      { inventoryItem: "inv-a", amount: 1000, action: "rollback" },
      { inventoryItem: "inv-b", amount: 2000, action: "rollback" },
    ]
  );
}

async function testRejectsMissingMonetaryAllocations() {
  capturedNotifications = [];
  capturedAuditEvents = [];
  createNotificationMock = async () => {};
  createAuditEventMock = async () => {};
  const inventoryDocs = {
    "inv-a": {
      _id: "inv-a",
      name: "Cash Pool A",
      type: "monetary",
      amount: 6000,
      async save() {},
    },
  };
  const requestDoc = buildRequestDoc({
    _id: "req-2",
    barangayId: "brgy-2",
    barangayName: "San Roque",
    requestNo: "RR-2026-0011",
    totals: { requestedMonetaryAmount: 1500 },
    fulfillment: { releasedMonetaryAmount: 1500, receivedMonetaryAmount: 0 },
  });
  const brokenRelease = buildReleaseDoc({
    _id: "rel-bad",
    reliefRequestId: "req-2",
    releaseNo: "RL-2026-0102",
    releasedMonetaryAmount: 1500,
    monetaryAllocations: [],
    async save() {
      throw new Error("should not save broken release");
    },
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRelease.findOne = () => queryResult(brokenRelease);
  InventoryItem.findById = (id) => queryResult(inventoryDocs[id] || null);
  InventoryLog.create = async () => {
    throw new Error("should not log rollback for broken allocation data");
  };

  const req = {
    params: { id: "req-2" },
    body: { releaseId: "rel-bad" },
    session: { userId: "brgy-2", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(inventoryDocs["inv-a"].amount, 6000);
  assert.equal(brokenRelease.releaseStatus, "released");
  assert.equal(brokenRelease.inventoryRestored, false);
  assert.match(
    res.body.message,
    /complete monetary allocation breakdown/i
  );
}

async function testRejectsNonMonetaryReleaseRollback() {
  const requestDoc = buildRequestDoc({ _id: "req-3", requestNo: "RR-2026-0012" });
  const releaseDoc = buildReleaseDoc({
    _id: "rel-food",
    reliefRequestId: "req-3",
    foodPacksReleased: 5,
    releasedMonetaryAmount: 0,
    monetaryAllocations: [],
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRelease.findOne = () => queryResult(releaseDoc);
  InventoryItem.findById = () => queryResult(null);
  InventoryLog.create = async () => {
    throw new Error("should not create logs for non-monetary rollback");
  };

  const req = {
    params: { id: "req-3" },
    body: { releaseId: "rel-food" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /only monetary releases/i);
}

async function testRejectsInvalidMonetarySourceInventoryType() {
  const inventoryDoc = {
    _id: "inv-goods",
    name: "Rice",
    type: "goods",
    amount: 10,
    async save() {
      throw new Error("should not save goods inventory during monetary rollback");
    },
  };
  const requestDoc = buildRequestDoc({ _id: "req-4", requestNo: "RR-2026-0013" });
  const releaseDoc = buildReleaseDoc({
    _id: "rel-invalid-source",
    reliefRequestId: "req-4",
    monetaryAllocations: [
      { inventoryItemId: "inv-goods", itemName: "Rice", amountReleased: 3000 },
    ],
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRelease.findOne = () => queryResult(releaseDoc);
  InventoryItem.findById = () => queryResult(inventoryDoc);
  InventoryLog.create = async () => {
    throw new Error("should not create logs for invalid inventory type");
  };

  const req = {
    params: { id: "req-4" },
    body: { releaseId: "rel-invalid-source" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /not a monetary inventory record/i);
  assert.equal(inventoryDoc.amount, 10);
  assert.equal(releaseDoc.releaseStatus, "released");
}

async function testAllowsDecimalMonetaryAllocations() {
  const rollbackLogs = [];
  const inventoryDocs = {
    "inv-c": {
      _id: "inv-c",
      name: "Cash Pool C",
      type: "monetary",
      amount: 10,
      async save() {},
    },
    "inv-d": {
      _id: "inv-d",
      name: "Cash Pool D",
      type: "monetary",
      amount: 20,
      async save() {},
    },
  };
  const requestDoc = buildRequestDoc({
    _id: "req-5",
    requestNo: "RR-2026-0014",
    totals: { requestedMonetaryAmount: 0.3 },
    fulfillment: { releasedMonetaryAmount: 0.3, receivedMonetaryAmount: 0 },
  });
  const releaseDoc = buildReleaseDoc({
    _id: "rel-decimal",
    reliefRequestId: "req-5",
    releaseNo: "RL-2026-0103",
    releasedMonetaryAmount: 0.3,
    receivedMonetaryAmount: 0.3,
    monetaryAllocations: [
      { inventoryItemId: "inv-c", itemName: "Cash Pool C", amountReleased: 0.1 },
      { inventoryItemId: "inv-d", itemName: "Cash Pool D", amountReleased: 0.2 },
    ],
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRequest.findById = () => queryResult(requestDoc);
  ReliefRelease.findOne = () => queryResult(releaseDoc);
  ReliefRelease.find = () => queryResult([releaseDoc]);
  InventoryItem.findById = (id) => queryResult(inventoryDocs[id] || null);
  InventoryLog.create = async (entries) => {
    rollbackLogs.push(...entries);
    return entries;
  };

  const req = {
    params: { id: "req-5" },
    body: { releaseId: "rel-decimal" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(inventoryDocs["inv-c"].amount, 10.1);
  assert.equal(inventoryDocs["inv-d"].amount, 20.2);
  assert.equal(rollbackLogs.length, 2);
}

async function testKeepsSuccessResponseWhenPostCommitSideEffectsFail() {
  capturedNotifications = [];
  capturedAuditEvents = [];
  createAuditEventMock = async () => {
    throw new Error("audit down");
  };
  createNotificationMock = async () => {
    throw new Error("notification down");
  };

  const inventoryDoc = {
    _id: "inv-z",
    name: "Cash Pool Z",
    type: "monetary",
    amount: 100,
    async save() {},
  };
  const requestDoc = buildRequestDoc({
    _id: "req-6",
    requestNo: "RR-2026-0015",
    totals: { requestedMonetaryAmount: 50 },
    fulfillment: { releasedMonetaryAmount: 50, receivedMonetaryAmount: 0 },
  });
  const releaseDoc = buildReleaseDoc({
    _id: "rel-post-commit",
    reliefRequestId: "req-6",
    releaseNo: "RL-2026-0104",
    releasedMonetaryAmount: 50,
    monetaryAllocations: [
      { inventoryItemId: "inv-z", itemName: "Cash Pool Z", amountReleased: 50 },
    ],
  });

  ReliefRequest.findOne = () => queryResult(requestDoc);
  ReliefRequest.findById = () => queryResult(requestDoc);
  ReliefRelease.findOne = () => queryResult(releaseDoc);
  ReliefRelease.find = () => queryResult([releaseDoc]);
  InventoryItem.findById = () => queryResult(inventoryDoc);
  InventoryLog.create = async (entries) => entries;

  const req = {
    params: { id: "req-6" },
    body: { releaseId: "rel-post-commit" },
    session: { userId: "brgy-1", username: "barangay-user" },
  };
  const res = createRes();

  await controller.reportReliefRequestNotReceived(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(lastSession?.committed, true);
  assert.equal(lastSession?.aborted, false);
  assert.equal(inventoryDoc.amount, 150);
  assert.equal(releaseDoc.releaseStatus, "cancelled");
  assert.equal(capturedAuditEvents.length, 1);
  assert.equal(capturedNotifications.length, 1);
}

Promise.resolve()
  .then(testRollsBackOnlyTargetReleaseAndRefreshesRequest)
  .then(testRejectsMissingMonetaryAllocations)
  .then(testRejectsNonMonetaryReleaseRollback)
  .then(testRejectsInvalidMonetarySourceInventoryType)
  .then(testAllowsDecimalMonetaryAllocations)
  .then(testKeepsSuccessResponseWhenPostCommitSideEffectsFail)
  .then(() => console.log("reliefRequestNotReceivedRollback tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

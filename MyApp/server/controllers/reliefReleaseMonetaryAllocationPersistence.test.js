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
const FoodPackTemplate = {};

let capturedReleasePayload = null;
let auditCalls = [];
let notificationCalls = [];

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "mongoose") return mongoose;
  if (request === "../models/ReliefRequest") return ReliefRequest;
  if (request === "../models/ReliefRelease") return ReliefRelease;
  if (request === "../models/InventoryItem") return InventoryItem;
  if (request === "../models/InventoryLog") return InventoryLog;
  if (request === "../models/FoodPackTemplate") return FoodPackTemplate;
  if (request === "../utils/createNotification") {
    return async (payload) => {
      notificationCalls.push(payload);
    };
  }
  if (request === "../utils/createAuditEvent") {
    return async (payload) => {
      auditCalls.push(payload);
    };
  }
  if (request === "../utils/pdfTheme") return {};
  return originalLoad(request, parent, isMain);
};

const controller = require("./reliefReleaseController");
Module._load = originalLoad;

const queryResult = (value) => ({
  session: async () => value,
  sort() {
    return this;
  },
  lean: async () => value,
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

async function testPersistsMonetaryAllocationsOnReleaseCreation() {
  auditCalls = [];
  notificationCalls = [];
  capturedReleasePayload = null;

  const moneyA = {
    _id: "money-a",
    name: "Cash Pool A",
    type: "monetary",
    amount: 1000,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    async save() {},
  };
  const moneyB = {
    _id: "money-b",
    name: "Cash Pool B",
    type: "monetary",
    amount: 2500,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    async save() {},
  };

  const reliefRequestDoc = {
    _id: "req-1",
    barangayId: "brgy-1",
    barangayName: "San Jose",
    requestNo: "RR-2026-0020",
    requestType: "monetary",
    supportTypes: ["monetary"],
    totals: { requestedMonetaryAmount: 3000 },
    fulfillment: {
      releasedFoodPacks: 0,
      releasedMonetaryAmount: 0,
      releasedApplianceQuantity: 0,
    },
    status: "approved",
    isArchived: false,
    disaster: "flood",
    async save() {},
  };

  const createdReleaseDoc = {
    _id: "release-1",
    reliefRequestId: "req-1",
    releaseNo: "RL-2026-0001",
    releaseStatus: "released",
    releasedMonetaryAmount: 3000,
    monetaryAllocations: [],
  };

  ReliefRequest.findById = () => queryResult(reliefRequestDoc);
  ReliefRelease.findOne = () => queryResult(null);
  ReliefRelease.find = () => queryResult([createdReleaseDoc]);
  ReliefRelease.findById = async () => createdReleaseDoc;
  ReliefRelease.create = async (docs) => {
    capturedReleasePayload = docs[0];
    Object.assign(createdReleaseDoc, docs[0]);
    return [createdReleaseDoc];
  };
  InventoryItem.find = () => queryResult([moneyA, moneyB]);
  InventoryLog.create = async (entries) => entries;

  const req = {
    body: {
      reliefRequestId: "req-1",
      releasedMonetaryAmount: 3000,
      remarks: "Release full approved amount",
    },
    files: [{ filename: "proof.png", path: "C:\\temp\\proof.png" }],
    session: {
      userId: "admin-1",
      username: "admin-user",
      role: "admin",
    },
  };
  const res = createRes();

  await controller.createReliefRelease(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(capturedReleasePayload);
  assert.deepEqual(capturedReleasePayload.monetaryAllocations, [
    {
      inventoryItemId: "money-a",
      itemName: "Cash Pool A",
      amountReleased: 1000,
    },
    {
      inventoryItemId: "money-b",
      itemName: "Cash Pool B",
      amountReleased: 2000,
    },
  ]);
  assert.equal(capturedReleasePayload.inventoryRestored, false);
  assert.equal(moneyA.amount, 0);
  assert.equal(moneyB.amount, 500);
  assert.equal(lastSession?.committed, true);
  assert.equal(lastSession?.aborted, false);
  assert.equal(auditCalls.length, 1);
  assert.equal(notificationCalls.length, 1);
}

Promise.resolve()
  .then(testPersistsMonetaryAllocationsOnReleaseCreation)
  .then(() =>
    console.log("reliefReleaseMonetaryAllocationPersistence tests passed")
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

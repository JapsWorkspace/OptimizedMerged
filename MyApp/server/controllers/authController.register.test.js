const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const User = {};
const Barangay = {};
const ArchivedAccount = {};
const AccountApprovalRequest = {};
const AccountUpdateApprovalRequest = {};
const TimeLog = {};
const AdminLog = {};
const sendAccountApprovalEmail = async () => {};
const sendAccountUpdateApprovalEmail = async () => {};
const createAuditEvent = async () => {};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "../models/UserStaff.js") return User;
  if (request === "../models/Barangay.js") return Barangay;
  if (request === "../models/ArchivedAccount.js") return ArchivedAccount;
  if (request === "../models/AccountApprovalRequest.js") return AccountApprovalRequest;
  if (request === "../models/AccountUpdateApprovalRequest.js") return AccountUpdateApprovalRequest;
  if (request === "../models/TimeLog") return TimeLog;
  if (request === "../models/AdminLog") return AdminLog;
  if (request === "../utils/sendAccountApprovalEmail") return sendAccountApprovalEmail;
  if (request === "../utils/sendAccountUpdateApprovalEmail") return sendAccountUpdateApprovalEmail;
  if (request === "../utils/createAuditEvent") return createAuditEvent;
  return originalLoad.call(this, request, parent, isMain);
};

const { register } = require("./authController");

test("rejects admin registration when the username is already used by an active staff account", async () => {
  const originalUserFindOne = User.findOne;
  const originalBarangayFindOne = Barangay.findOne;
  const originalArchivedFindOne = ArchivedAccount.findOne;
  const originalApprovalFindOne = AccountApprovalRequest.findOne;

  User.findOne = async (query) => {
    if (query?.username instanceof RegExp) {
      return { _id: "staff-1", username: "takenUser" };
    }

    return null;
  };
  Barangay.findOne = async () => null;
  ArchivedAccount.findOne = async () => null;
  AccountApprovalRequest.findOne = async () => null;

  try {
    const req = {
      body: {
        role: "drrmo",
        username: "TakenUser",
        email: "fresh@example.com",
        password: "Strongpass1!",
        phoneNumber: "09123456789",
        hotline: "",
        address: "Jaen, Nueva Ecija",
      },
      session: {
        userId: "admin-1",
        username: "admin",
        role: "admin",
      },
      protocol: "https",
      get(name) {
        return name === "host" ? "example.com" : "";
      },
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

    await register(req, res);

    assert.equal(statusCode, 400);
    assert.equal(jsonBody.message, "Username already exists");
    assert.equal(jsonBody.error, "USERNAME_EXISTS");
    assert.equal(jsonBody.field, "username");
  } finally {
    User.findOne = originalUserFindOne;
    Barangay.findOne = originalBarangayFindOne;
    ArchivedAccount.findOne = originalArchivedFindOne;
    AccountApprovalRequest.findOne = originalApprovalFindOne;
  }
});

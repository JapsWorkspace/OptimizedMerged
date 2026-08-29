const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("History model enum includes verification update actions", () => {
  const historyModelPath = path.join(
    __dirname,
    "..",
    "..",
    "MyApp",
    "server",
    "models",
    "History.js"
  );

  const source = fs.readFileSync(historyModelPath, "utf8");

  assert.match(source, /VERIFICATION_UPDATE/);
});

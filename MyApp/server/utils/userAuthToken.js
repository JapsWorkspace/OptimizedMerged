const crypto = require("crypto");

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.USER_AUTH_TOKEN_SECRET || process.env.SESSION_SECRET || "";
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  const secret = getSecret();
  if (!secret) throw new Error("USER_AUTH_TOKEN_SECRET or SESSION_SECRET is required.");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issueUserAuthToken(userId) {
  const payload = encode(JSON.stringify({ sub: String(userId), exp: Date.now() + TOKEN_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function verifyUserAuthToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded?.sub || Number(decoded.exp) <= Date.now()) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

function requireUserToken(req, res, next) {
  try {
    const header = String(req.get("authorization") || "");
    const match = header.match(/^Bearer\s+(.+)$/i);
    const claims = verifyUserAuthToken(match?.[1]);
    if (!claims) return res.status(401).json({ message: "Your session has expired. Please log in again." });
    req.authUserId = claims.sub;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }
}

module.exports = { issueUserAuthToken, verifyUserAuthToken, requireUserToken };

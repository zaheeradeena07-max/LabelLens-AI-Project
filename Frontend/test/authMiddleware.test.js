const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../src/middleware/authMiddleware");

function runMiddleware(authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test("rejects requests without a bearer token", () => {
  const { res, nextCalled } = runMiddleware();
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects malformed or invalid tokens", () => {
  const { res, nextCalled } = runMiddleware("Bearer not-a-jwt");
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("accepts a valid bearer token and attaches its claims", () => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-tests";
  const token = jwt.sign({ id: "user-123" }, process.env.JWT_SECRET, { expiresIn: "1m" });
  const { req, res, nextCalled } = runMiddleware(`Bearer ${token}`);
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, "user-123");
});

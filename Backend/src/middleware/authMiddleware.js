const jwt = require("jsonwebtoken");

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const value = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!value) return null;
  try { return decodeURIComponent(value.slice(name.length + 1)); } catch { return null; }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : readCookie(req, "labelLensSession");
  if (!token) {
    return res.status(401).json({ msg: "Authentication required" });
  }
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ msg: "Invalid token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Invalid token" });
  }
}

function requireCsrf(req, res, next) {
  const supplied = req.get("x-csrf-token") || "";
  const expected = req.user?.csrf || "";
  const crypto = require("node:crypto");
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (!supplied || !expected || suppliedBytes.length !== expectedBytes.length ||
      !crypto.timingSafeEqual(suppliedBytes, expectedBytes)) {
    return res.status(403).json({ msg: "Invalid or missing CSRF token" });
  }
  return next();
}

module.exports = authMiddleware;
module.exports.requireCsrf = requireCsrf;

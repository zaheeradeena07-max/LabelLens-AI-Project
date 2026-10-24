require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ credentials: true, origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin not allowed by CORS"));
} }));
app.use(express.json({ limit: "10kb" }));
app.use("/api/upload", authMiddleware, authMiddleware.requireCsrf, require("./routes/uploadRoutes"));

// 🔓 Public routes (no token required)
app.use("/api/auth", require("./routes/authRoutes"));

// 🔐 Protected routes (token required)
app.use("/api/recommendations", authMiddleware, require("./routes/recommendationRoutes"));

app.get("/", (req, res) => {
  res.send("API Running...");
});

app.get("/healthz", (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: "unhealthy", database: "disconnected" });
  }
  return res.status(200).json({ status: "ok", database: "connected" });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({ error: "This frontend origin is not allowed. Add it to CORS_ORIGINS." });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ msg: "Invalid JSON request body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ msg: "Request body too large" });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  return res.status(status).json({ msg: status < 500 ? "Invalid request" : "Server error" });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  if (process.env.NODE_ENV === "production") {
    const origins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
    if (!origins.length || origins.some((origin) => !/^https:\/\//i.test(origin))) {
      throw new Error("Set CORS_ORIGINS to the deployed frontend HTTPS origin(s)");
    }
    if (!new Set(["none", "lax", "strict"]).has((process.env.COOKIE_SAME_SITE || "none").toLowerCase())) {
      throw new Error("COOKIE_SAME_SITE must be none, lax, or strict");
    }
  }

  await connectDB();
  const port = Number(process.env.PORT) || 5000;
  return app.listen(port, "0.0.0.0", () => console.log(`Server running on 0.0.0.0:${port}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };

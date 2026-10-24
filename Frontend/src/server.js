require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authMiddleware = require("./middleware/authMiddleware");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use("/api/upload", require("./routes/uploadRoutes"));

// 🔓 Public routes (no token required)
app.use("/api/auth", require("./routes/authRoutes"));

// 🔐 Protected routes (token required)
app.use("/api/recommendations", authMiddleware, require("./routes/recommendationRoutes"));

app.get("/", (req, res) => {
  res.send("API Running...");
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
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

  await connectDB();
  const port = Number(process.env.PORT) || 5000;
  return app.listen(port, () => console.log(`Server running on port ${port}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };

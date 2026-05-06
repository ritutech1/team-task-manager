require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { initDb } = require("./src/db");
const authRoutes = require("./src/routes/auth");
const projectRoutes = require("./src/routes/projects");
const taskRoutes = require("./src/routes/tasks");
const dashboardRoutes = require("./src/routes/dashboard");
const { errorHandler, notFound } = require("./src/middleware/errors");

initDb();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Team Task Manager" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Team Task Manager running on port ${port}`);
});

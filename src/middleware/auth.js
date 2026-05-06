const jwt = require("jsonwebtoken");
const { db } = require("../db");
const { createError } = require("./errors");

const jwtSecret = process.env.JWT_SECRET || "development-only-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(createError(401, "Authentication required"));

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(payload.id);
    if (!user) return next(createError(401, "Invalid session"));
    req.user = user;
    return next();
  } catch (_err) {
    return next(createError(401, "Invalid or expired token"));
  }
}

function requireAdmin(req, _res, next) {
  if (req.user.role !== "ADMIN") return next(createError(403, "Admin access required"));
  return next();
}

function canAccessProject(projectId, user) {
  if (user.role === "ADMIN") return true;
  const member = db.prepare(`
    SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
  `).get(projectId, user.id);
  return Boolean(member);
}

function requireProjectAccess(req, _res, next) {
  const projectId = Number(req.params.projectId || req.params.id || req.body.projectId);
  if (!Number.isInteger(projectId)) return next(createError(400, "Valid project id is required"));
  if (!canAccessProject(projectId, req.user)) return next(createError(403, "You do not have access to this project"));
  req.projectId = projectId;
  return next();
}

module.exports = { signToken, requireAuth, requireAdmin, canAccessProject, requireProjectAccess };

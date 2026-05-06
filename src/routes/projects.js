const express = require("express");
const { db } = require("../db");
const { requireAuth, requireAdmin, requireProjectAccess } = require("../middleware/auth");
const { createError } = require("../middleware/errors");
const { projectSchema, memberSchema, validate } = require("../validators");

const router = express.Router();

router.use(requireAuth);

function getProject(id) {
  return db.prepare(`
    SELECT p.id, p.name, p.description, p.owner_id AS ownerId, p.created_at AS createdAt,
      u.name AS ownerName
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.id = ?
  `).get(id);
}

function projectPayload(project) {
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.project_id = ?
    ORDER BY u.name COLLATE NOCASE
  `).all(project.id);
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'TODO' THEN 1 ELSE 0 END) AS todo,
      SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done
    FROM tasks
    WHERE project_id = ?
  `).get(project.id);
  return { ...project, members, stats };
}

router.get("/", (req, res) => {
  const sql = req.user.role === "ADMIN"
    ? `
      SELECT p.id, p.name, p.description, p.owner_id AS ownerId, p.created_at AS createdAt,
        u.name AS ownerName
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `
    : `
      SELECT p.id, p.name, p.description, p.owner_id AS ownerId, p.created_at AS createdAt,
        u.name AS ownerName
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
    `;
  const projects = req.user.role === "ADMIN"
    ? db.prepare(sql).all()
    : db.prepare(sql).all(req.user.id);
  res.json({ projects: projects.map(projectPayload) });
});

router.post("/", requireAdmin, (req, res, next) => {
  try {
    const input = validate(projectSchema, req.body);
    const result = db.prepare(`
      INSERT INTO projects (name, description, owner_id)
      VALUES (?, ?, ?)
    `).run(input.name, input.description, req.user.id);
    db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)").run(result.lastInsertRowid, req.user.id);
    res.status(201).json({ project: projectPayload(getProject(result.lastInsertRowid)) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireProjectAccess, (req, res, next) => {
  const project = getProject(req.projectId);
  if (!project) return next(createError(404, "Project not found"));
  return res.json({ project: projectPayload(project) });
});

router.put("/:id", requireProjectAccess, requireAdmin, (req, res, next) => {
  try {
    const input = validate(projectSchema, req.body);
    const project = getProject(req.projectId);
    if (!project) throw createError(404, "Project not found");
    db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?")
      .run(input.name, input.description, req.projectId);
    res.json({ project: projectPayload(getProject(req.projectId)) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireProjectAccess, requireAdmin, (req, res, next) => {
  const project = getProject(req.projectId);
  if (!project) return next(createError(404, "Project not found"));
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.projectId);
  return res.status(204).end();
});

router.post("/:id/members", requireProjectAccess, requireAdmin, (req, res, next) => {
  try {
    const input = validate(memberSchema, req.body);
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(input.userId);
    if (!user) throw createError(404, "User not found");
    db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)")
      .run(req.projectId, input.userId);
    res.status(201).json({ project: projectPayload(getProject(req.projectId)) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/members/:userId", requireProjectAccess, requireAdmin, (req, res, next) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId)) return next(createError(400, "Valid user id is required"));
  db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(req.projectId, userId);
  return res.status(204).end();
});

module.exports = router;

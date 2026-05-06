const express = require("express");
const { db } = require("../db");
const { requireAuth, requireAdmin, canAccessProject } = require("../middleware/auth");
const { createError } = require("../middleware/errors");
const { taskSchema, taskUpdateSchema, validate } = require("../validators");

const router = express.Router();
router.use(requireAuth);

function taskRow(id) {
  return db.prepare(`
    SELECT t.id, t.project_id AS projectId, p.name AS projectName, t.title, t.description,
      t.assigned_to AS assignedTo, assignee.name AS assignedToName,
      t.status, t.priority, t.due_date AS dueDate, t.created_by AS createdBy,
      creator.name AS createdByName, t.created_at AS createdAt, t.updated_at AS updatedAt
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN users creator ON creator.id = t.created_by
    LEFT JOIN users assignee ON assignee.id = t.assigned_to
    WHERE t.id = ?
  `).get(id);
}

function ensureTaskAccess(task, user) {
  if (!task) throw createError(404, "Task not found");
  if (!canAccessProject(task.projectId, user)) throw createError(403, "You do not have access to this task");
}

function ensureAssigneeAllowed(projectId, assignedTo) {
  if (!assignedTo) return;
  const member = db.prepare(`
    SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?
  `).get(projectId, assignedTo);
  if (!member) throw createError(400, "Assignee must be a member of the project");
}

router.get("/", (req, res, next) => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const mine = req.query.mine === "true";
    const status = req.query.status;

    const clauses = [];
    const params = [];

    if (projectId) {
      if (!canAccessProject(projectId, req.user)) throw createError(403, "You do not have access to this project");
      clauses.push("t.project_id = ?");
      params.push(projectId);
    } else if (req.user.role !== "ADMIN") {
      clauses.push("t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)");
      params.push(req.user.id);
    }

    if (mine) {
      clauses.push("t.assigned_to = ?");
      params.push(req.user.id);
    }
    if (status) {
      clauses.push("t.status = ?");
      params.push(status);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const tasks = db.prepare(`
      SELECT t.id, t.project_id AS projectId, p.name AS projectName, t.title, t.description,
        t.assigned_to AS assignedTo, assignee.name AS assignedToName,
        t.status, t.priority, t.due_date AS dueDate, t.created_by AS createdBy,
        creator.name AS createdByName, t.created_at AS createdAt, t.updated_at AS updatedAt
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN users creator ON creator.id = t.created_by
      LEFT JOIN users assignee ON assignee.id = t.assigned_to
      ${where}
      ORDER BY
        CASE t.priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
        COALESCE(t.due_date, '9999-12-31'),
        t.created_at DESC
    `).all(...params);

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
});

router.post("/", (req, res, next) => {
  try {
    const input = validate(taskSchema, req.body);
    if (!canAccessProject(input.projectId, req.user)) throw createError(403, "You do not have access to this project");
    if (req.user.role !== "ADMIN") throw createError(403, "Only admins can create tasks");
    ensureAssigneeAllowed(input.projectId, input.assignedTo);

    const result = db.prepare(`
      INSERT INTO tasks (project_id, title, description, assigned_to, status, priority, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.projectId,
      input.title,
      input.description,
      input.assignedTo || null,
      input.status,
      input.priority,
      input.dueDate || null,
      req.user.id
    );

    res.status(201).json({ task: taskRow(result.lastInsertRowid) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw createError(400, "Valid task id is required");
    const current = taskRow(id);
    ensureTaskAccess(current, req.user);

    const input = validate(taskUpdateSchema, req.body);
    if (input.assignedTo !== undefined) ensureAssigneeAllowed(current.projectId, input.assignedTo);

    const nextTask = {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      assignedTo: input.assignedTo === undefined ? current.assignedTo : input.assignedTo,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
      dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate
    };

    const adminFields = ["title", "description", "assignedTo", "priority", "dueDate"];
    const touchedAdminFields = adminFields.some((field) => input[field] !== undefined);
    if (req.user.role !== "ADMIN" && touchedAdminFields) {
      throw createError(403, "Members can only update task status");
    }

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, assigned_to = ?, status = ?, priority = ?, due_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      nextTask.title,
      nextTask.description,
      nextTask.assignedTo || null,
      nextTask.status,
      nextTask.priority,
      nextTask.dueDate || null,
      id
    );

    res.json({ task: taskRow(id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw createError(400, "Valid task id is required");
    const current = taskRow(id);
    ensureTaskAccess(current, req.user);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const scopeJoin = req.user.role === "ADMIN"
    ? ""
    : "JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = @userId";

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN t.status = 'TODO' THEN 1 ELSE 0 END) AS todo,
      SUM(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgress,
      SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN t.status != 'DONE' AND t.due_date < DATE('now') THEN 1 ELSE 0 END) AS overdue
    FROM tasks t
    ${scopeJoin}
  `).get({ userId: req.user.id });

  const projectCount = req.user.role === "ADMIN"
    ? db.prepare("SELECT COUNT(*) AS count FROM projects").get().count
    : db.prepare("SELECT COUNT(*) AS count FROM project_members WHERE user_id = ?").get(req.user.id).count;

  const myOpenTasks = db.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.due_date AS dueDate,
      p.name AS projectName
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assigned_to = ? AND t.status != 'DONE'
    ORDER BY COALESCE(t.due_date, '9999-12-31'), t.created_at DESC
    LIMIT 8
  `).all(req.user.id);

  const overdueSql = `
    SELECT t.id, t.title, t.status, t.priority, t.due_date AS dueDate,
      p.name AS projectName, u.name AS assignedToName
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assigned_to
    ${req.user.role === "ADMIN" ? "" : "JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?"}
    WHERE t.status != 'DONE' AND t.due_date < DATE('now')
    ORDER BY t.due_date ASC
    LIMIT 8
  `;
  const overdueTasks = req.user.role === "ADMIN"
    ? db.prepare(overdueSql).all()
    : db.prepare(overdueSql).all(req.user.id);

  res.json({
    stats: {
      projects: projectCount,
      totalTasks: stats.totalTasks || 0,
      todo: stats.todo || 0,
      inProgress: stats.inProgress || 0,
      done: stats.done || 0,
      overdue: stats.overdue || 0
    },
    myOpenTasks,
    overdueTasks
  });
});

module.exports = router;

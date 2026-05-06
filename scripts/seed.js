require("dotenv").config();

const bcrypt = require("bcryptjs");
const { db, initDb } = require("../src/db");

initDb();

const users = [
  ["Avery Admin", "admin@example.com", "password123", "ADMIN"],
  ["Mina Member", "member@example.com", "password123", "MEMBER"],
  ["Dev Patel", "dev@example.com", "password123", "MEMBER"]
];

for (const [name, email, password, role] of users) {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!exists) {
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(name, email, bcrypt.hashSync(password, 12), role);
  }
}

const admin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@example.com");
const member = db.prepare("SELECT id FROM users WHERE email = ?").get("member@example.com");
const dev = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@example.com");

let project = db.prepare("SELECT id FROM projects WHERE name = ?").get("Launch Website");
if (!project) {
  const result = db.prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run("Launch Website", "Marketing site launch with design, QA, and deployment tasks.", admin.id);
  project = { id: result.lastInsertRowid };
}

for (const userId of [admin.id, member.id, dev.id]) {
  db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)")
    .run(project.id, userId);
}

const taskCount = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE project_id = ?").get(project.id).count;
if (taskCount === 0) {
  const insertTask = db.prepare(`
    INSERT INTO tasks (project_id, title, description, assigned_to, status, priority, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(project.id, "Finalize landing page copy", "Review headline, sections, and CTA clarity.", member.id, "IN_PROGRESS", "HIGH", "2026-05-08", admin.id);
  insertTask.run(project.id, "QA responsive layouts", "Check mobile, tablet, and desktop breakpoints.", dev.id, "TODO", "MEDIUM", "2026-05-10", admin.id);
  insertTask.run(project.id, "Deploy production build", "Push live service and verify health endpoint.", admin.id, "TODO", "HIGH", "2026-05-12", admin.id);
}

console.log("Seed complete");

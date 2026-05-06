const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../db");
const { signToken, requireAuth, requireAdmin } = require("../middleware/auth");
const { createError } = require("../middleware/errors");
const { signupSchema, loginSchema, validate } = require("../validators");

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at
  };
}

router.post("/signup", (req, res, next) => {
  try {
    const input = validate(signupSchema, req.body);
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(input.email);
    if (existing) throw createError(409, "Email is already registered");

    const role = input.role || "MEMBER";
    const passwordHash = bcrypt.hashSync(input.password, 12);
    const result = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(input.name, input.email, passwordHash, role);
    const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", (req, res, next) => {
  try {
    const input = validate(loginSchema, req.body);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(input.email);
    if (!user || !bcrypt.compareSync(input.password, user.password_hash)) {
      throw createError(401, "Invalid email or password");
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.get("/users", requireAuth, requireAdmin, (_req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, created_at AS createdAt
    FROM users
    ORDER BY name COLLATE NOCASE
  `).all();
  res.json({ users });
});

module.exports = router;

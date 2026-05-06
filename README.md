# Team Task Manager

A full-stack web app for creating projects, assigning team tasks, and tracking delivery progress with Admin and Member access.

## Features

- Signup and login with JWT authentication
- Admin and Member role-based access control
- Project creation and project team membership
- Task creation, assignment, priority, due date, and status tracking
- Dashboard with project count, task totals, progress status, and overdue work
- REST API with validation and relational SQLite database
- Railway-ready single-service deployment

## Tech Stack

- Node.js
- Express
- SQLite with `better-sqlite3`
- JWT authentication
- Zod validation
- HTML, CSS, and vanilla JavaScript frontend

## Local Setup

```bash
npm install
cp .env.example .env
npm run seed
npm start
```

Open `http://localhost:3000`.

Seeded demo accounts:

- Admin: `admin@example.com` / `password123`
- Member: `member@example.com` / `password123`

## API Overview

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/users` Admin only

Projects:

- `GET /api/projects`
- `POST /api/projects` Admin only
- `GET /api/projects/:id`
- `PUT /api/projects/:id` Admin only
- `DELETE /api/projects/:id` Admin only
- `POST /api/projects/:id/members` Admin only
- `DELETE /api/projects/:id/members/:userId` Admin only

Tasks:

- `GET /api/tasks`
- `POST /api/tasks` Admin only
- `PUT /api/tasks/:id` Admins can update all fields; members can update status
- `DELETE /api/tasks/:id` Admin only

Dashboard:

- `GET /api/dashboard`

## Railway Deployment

1. Push this project to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add environment variables:
   - `JWT_SECRET`: a long random string
   - `DATABASE_PATH`: `./data/app.db`
4. Railway will use `npm start` from `railway.json`.
5. After deploy, open the public Railway URL and create an Admin account.

SQLite works for this assignment and small demos. For production teams, swap the database layer for Railway PostgreSQL and keep the same API boundaries.

## Submission Checklist

- Live URL: deploy on Railway and paste the public URL
- GitHub repo: push this repository
- README: included here
- Demo video: record 2-5 minutes showing signup/login, admin project creation, adding members, task assignment, member status update, and dashboard overdue/status views

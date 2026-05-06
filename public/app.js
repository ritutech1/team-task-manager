const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  view: "dashboard",
  projects: [],
  tasks: [],
  users: [],
  dashboard: null,
  authMode: "login",
  message: ""
};

const app = document.querySelector("#app");

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

function setSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", payload.token);
  localStorage.setItem("ttm_user", JSON.stringify(payload.user));
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
  render();
}

function formatStatus(status) {
  return status.replace("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function isOverdue(task) {
  return task.dueDate && task.status !== "DONE" && task.dueDate < new Date().toISOString().slice(0, 10);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function authView() {
  const isSignup = state.authMode === "signup";
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-panel">
        <form class="auth-card" id="auth-form">
          <div>
            <h2>${isSignup ? "Create account" : "Welcome back"}</h2>
            <p class="muted">Use admin@example.com / password123 after seeding, or create a fresh account.</p>
          </div>
          <div class="switcher">
            <button type="button" class="${!isSignup ? "active" : ""}" data-auth-mode="login">Login</button>
            <button type="button" class="${isSignup ? "active" : ""}" data-auth-mode="signup">Signup</button>
          </div>
          ${state.message ? `<div class="notice error">${escapeHtml(state.message)}</div>` : ""}
          ${isSignup ? `<label>Name<input name="name" required minlength="2" autocomplete="name"></label>` : ""}
          <label>Email<input name="email" required type="email" autocomplete="email"></label>
          <label>Password<input name="password" required type="password" minlength="${isSignup ? 8 : 1}" autocomplete="${isSignup ? "new-password" : "current-password"}"></label>
          ${isSignup ? `
            <label>Role
              <select name="role">
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
          ` : ""}
          <button>${isSignup ? "Create account" : "Login"}</button>
        </form>
      </div>
      <div class="auth-visual">
        <h1>Team Task Manager</h1>
        <p>Create projects, assign teammates, track delivery, and keep overdue work visible before it turns into a surprise.</p>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.authMode;
      state.message = "";
      render();
    });
  });

  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const payload = await api(isSignup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(data)
      });
      setSession(payload);
      state.message = "";
      await loadData();
      render();
    } catch (err) {
      state.message = err.message;
      render();
    }
  });
}

async function loadData() {
  if (!state.token) return;
  const [dashboard, projects, tasks] = await Promise.all([
    api("/dashboard"),
    api("/projects"),
    api("/tasks")
  ]);
  state.dashboard = dashboard;
  state.projects = projects.projects;
  state.tasks = tasks.tasks;
  if (state.user.role === "ADMIN") {
    state.users = (await api("/auth/users")).users;
  }
}

function shell(content) {
  app.innerHTML = `
    <section class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>Team Tasks</h1>
          <p>${state.user.role === "ADMIN" ? "Admin workspace" : "Member workspace"}</p>
        </div>
        <nav class="nav">
          ${["dashboard", "projects", "tasks"].map((view) => `
            <button class="${state.view === view ? "active" : ""}" data-view="${view}">${view[0].toUpperCase() + view.slice(1)}</button>
          `).join("")}
        </nav>
        <div class="user-mini">
          <strong>${escapeHtml(state.user.name)}</strong><br>
          ${escapeHtml(state.user.email)}
          <button class="secondary" id="logout" style="width:100%; margin-top:14px;">Logout</button>
        </div>
      </aside>
      <div class="content">${content}</div>
    </section>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });
  document.querySelector("#logout").addEventListener("click", logout);
}

function dashboardView() {
  const stats = state.dashboard?.stats || {};
  shell(`
    <div class="topbar">
      <div>
        <h2>Dashboard</h2>
        <p class="muted">A fast read on team progress, open work, and deadlines.</p>
      </div>
      <button id="refresh">Refresh</button>
    </div>
    <section class="grid stats">
      ${[
        ["Projects", stats.projects],
        ["Tasks", stats.totalTasks],
        ["To do", stats.todo],
        ["In progress", stats.inProgress],
        ["Overdue", stats.overdue]
      ].map(([label, value]) => `<div class="card stat"><span class="muted">${label}</span><strong>${value || 0}</strong></div>`).join("")}
    </section>
    <section class="grid cards">
      <div class="card">
        <div class="section-head"><h3>My open tasks</h3></div>
        ${taskList(state.dashboard?.myOpenTasks || [])}
      </div>
      <div class="card">
        <div class="section-head"><h3>Overdue</h3></div>
        ${taskList(state.dashboard?.overdueTasks || [])}
      </div>
    </section>
  `);
  document.querySelector("#refresh").addEventListener("click", refresh);
}

function taskList(tasks) {
  if (!tasks.length) return `<p class="muted">Nothing to show.</p>`;
  return tasks.map((task) => `
    <div class="row">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        <div class="muted">${escapeHtml(task.projectName || "")}${task.dueDate ? ` / Due ${task.dueDate}` : ""}</div>
      </div>
      <span class="badge ${task.priority?.toLowerCase()}">${task.priority || task.status}</span>
    </div>
  `).join("");
}

function projectsView() {
  shell(`
    <div class="topbar">
      <div>
        <h2>Projects</h2>
        <p class="muted">Manage project membership and delivery progress.</p>
      </div>
    </div>
    ${state.user.role === "ADMIN" ? projectForm() : ""}
    <section class="grid cards">
      ${state.projects.map((project) => `
        <article class="card">
          <div class="section-head">
            <h3>${escapeHtml(project.name)}</h3>
            <span class="badge">${project.stats.total || 0} tasks</span>
          </div>
          <p class="muted">${escapeHtml(project.description || "No description")}</p>
          <div class="row">
            <span class="badge done">${project.stats.done || 0} done</span>
            <span class="badge medium">${project.stats.inProgress || 0} active</span>
            <span class="badge">${project.stats.todo || 0} todo</span>
          </div>
          <div>
            <strong>Team</strong>
            <p class="muted">${project.members.map((member) => escapeHtml(member.name)).join(", ") || "No members yet"}</p>
          </div>
          ${state.user.role === "ADMIN" ? memberControls(project) : ""}
        </article>
      `).join("") || `<div class="card"><p class="muted">No projects yet.</p></div>`}
    </section>
  `);
  bindProjectForms();
}

function projectForm() {
  return `
    <form class="form-panel form-grid" id="project-form">
      <label>Project name<input name="name" required minlength="2"></label>
      <label>Description<input name="description"></label>
      <button class="span-2">Create project</button>
    </form>
  `;
}

function memberControls(project) {
  const currentIds = new Set(project.members.map((member) => member.id));
  const options = state.users
    .filter((user) => !currentIds.has(user.id))
    .map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${user.role})</option>`)
    .join("");
  return `
    <form class="row member-form" data-project-id="${project.id}">
      <select name="userId" ${options ? "" : "disabled"}>
        ${options || `<option>No users available</option>`}
      </select>
      <button ${options ? "" : "disabled"}>Add</button>
    </form>
  `;
}

function tasksView() {
  shell(`
    <div class="topbar">
      <div>
        <h2>Tasks</h2>
        <p class="muted">Create assignments, change ownership, and move work through status.</p>
      </div>
    </div>
    ${state.user.role === "ADMIN" ? taskForm() : ""}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Task</th><th>Project</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Due</th><th>Action</th></tr>
        </thead>
        <tbody>
          ${state.tasks.map(taskRowHtml).join("") || `<tr><td colspan="7" class="muted">No tasks yet.</td></tr>`}
        </tbody>
      </table>
    </div>
  `);
  bindTaskForms();
}

function taskForm() {
  const projectOptions = state.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
  const userOptions = state.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("");
  return `
    <form class="form-panel form-grid" id="task-form">
      <label>Project<select name="projectId" required>${projectOptions}</select></label>
      <label>Assignee<select name="assignedTo"><option value="">Unassigned</option>${userOptions}</select></label>
      <label>Title<input name="title" required minlength="2"></label>
      <label>Due date<input name="dueDate" type="date"></label>
      <label>Priority<select name="priority"><option>MEDIUM</option><option>HIGH</option><option>LOW</option></select></label>
      <label>Status<select name="status"><option>TODO</option><option>IN_PROGRESS</option><option>DONE</option></select></label>
      <label class="span-2">Description<textarea name="description"></textarea></label>
      <button class="span-2">Create task</button>
    </form>
  `;
}

function taskRowHtml(task) {
  return `
    <tr>
      <td><strong>${escapeHtml(task.title)}</strong><div class="muted">${escapeHtml(task.description || "")}</div></td>
      <td>${escapeHtml(task.projectName)}</td>
      <td>${escapeHtml(task.assignedToName || "Unassigned")}</td>
      <td><span class="badge ${task.status === "DONE" ? "done" : ""}">${formatStatus(task.status)}</span></td>
      <td><span class="badge ${task.priority.toLowerCase()}">${task.priority}</span></td>
      <td>${task.dueDate || "-"} ${isOverdue(task) ? `<span class="badge overdue">Overdue</span>` : ""}</td>
      <td>
        <select data-task-status="${task.id}">
          ${["TODO", "IN_PROGRESS", "DONE"].map((status) => `<option value="${status}" ${task.status === status ? "selected" : ""}>${formatStatus(status)}</option>`).join("")}
        </select>
      </td>
    </tr>
  `;
}

function bindProjectForms() {
  const form = document.querySelector("#project-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      await api("/projects", { method: "POST", body: JSON.stringify(data) });
      await refresh();
    });
  }

  document.querySelectorAll(".member-form").forEach((memberForm) => {
    memberForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const projectId = memberForm.dataset.projectId;
      const userId = Number(new FormData(memberForm).get("userId"));
      await api(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId })
      });
      await refresh();
    });
  });
}

function bindTaskForms() {
  const form = document.querySelector("#task-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const payload = {
        ...data,
        projectId: Number(data.projectId),
        assignedTo: data.assignedTo ? Number(data.assignedTo) : null,
        dueDate: data.dueDate || null
      };
      await api("/tasks", { method: "POST", body: JSON.stringify(payload) });
      await refresh();
    });
  }

  document.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api(`/tasks/${select.dataset.taskStatus}`, {
        method: "PUT",
        body: JSON.stringify({ status: select.value })
      });
      await refresh();
    });
  });
}

async function refresh() {
  try {
    await loadData();
    render();
  } catch (err) {
    state.message = err.message;
    if (err.message.includes("token") || err.message.includes("Authentication")) logout();
  }
}

function render() {
  if (!state.token || !state.user) return authView();
  if (state.view === "projects") return projectsView();
  if (state.view === "tasks") return tasksView();
  return dashboardView();
}

if (state.token) {
  refresh();
} else {
  render();
}

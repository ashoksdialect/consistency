// Consistency — Habit Tracker
// Data model: { id, name, icon, history: { "YYYY-MM-DD": true } }

const STORAGE_KEY = "consistency.habits";
const THEME_KEY = "consistency.theme";

const $ = (sel) => document.querySelector(sel);

let habits = load();

// ---------- Storage ----------
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// ---------- Date helpers ----------
function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ---------- Streaks ----------
function streak(habit) {
  let count = 0;
  let d = new Date();
  // If today isn't done yet, streak may still be alive from yesterday
  if (!habit.history[dateKey(d)]) d.setDate(d.getDate() - 1);
  while (habit.history[dateKey(d)]) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// ---------- Rendering ----------
function render() {
  const list = $("#habit-list");
  const today = dateKey();
  list.innerHTML = "";

  habits.forEach((h) => {
    const done = !!h.history[today];
    const li = document.createElement("li");
    li.className = "habit-item" + (done ? " done" : "");
    li.innerHTML = `
      <button class="habit-check" aria-label="Toggle habit">✓</button>
      <span class="habit-emoji">${h.icon}</span>
      <div class="habit-info">
        <div class="habit-name"></div>
        <div class="habit-streak">🔥 ${streak(h)} day streak</div>
      </div>
      <button class="habit-delete" aria-label="Delete habit">🗑</button>
    `;
    li.querySelector(".habit-name").textContent = h.name;
    li.querySelector(".habit-check").addEventListener("click", () => toggle(h.id));
    li.querySelector(".habit-delete").addEventListener("click", () => remove(h.id));
    list.appendChild(li);
  });

  $("#empty-state").classList.toggle("hidden", habits.length > 0);
  renderStats();
  renderWeek();
}

function renderStats() {
  const today = dateKey();
  const total = habits.length;
  const done = habits.filter((h) => h.history[today]).length;
  const best = habits.reduce((m, h) => Math.max(m, streak(h)), 0);
  const rate = total ? Math.round((done / total) * 100) : 0;

  $("#stat-total").textContent = total;
  $("#stat-done").textContent = done;
  $("#stat-streak").textContent = best;
  $("#stat-rate").textContent = rate + "%";
  $("#progress-text").textContent = `${done} of ${total} completed`;
  $("#progress-fill").style.width = rate + "%";
}

function renderWeek() {
  const grid = $("#week-grid");
  grid.innerHTML = "";
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    const key = dateKey(d);
    const total = habits.length;
    const done = habits.filter((h) => h.history[key]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const cell = document.createElement("div");
    cell.className = "day-cell" + (i === 0 ? " today" : "");
    cell.innerHTML = `
      <div class="day-label">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
      <div class="day-pct">${pct}%</div>
    `;
    grid.appendChild(cell);
  }
}

// ---------- Actions ----------
function addHabit(name, icon) {
  habits.push({ id: crypto.randomUUID(), name, icon, history: {} });
  save();
  render();
}

function toggle(id) {
  const h = habits.find((x) => x.id === id);
  const today = dateKey();
  if (h.history[today]) delete h.history[today];
  else h.history[today] = true;
  save();
  render();
}

function remove(id) {
  if (!confirm("Delete this habit? Your streak history will be lost.")) return;
  habits = habits.filter((x) => x.id !== id);
  save();
  render();
}

// ---------- Events ----------
$("#habit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#habit-input");
  const name = input.value.trim();
  if (!name) return;
  addHabit(name, $("#habit-icon").value);
  input.value = "";
  input.focus();
});

// ---------- Theme ----------
const themeToggle = $("#theme-toggle");
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}
themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

// ---------- Init ----------
$("#today-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric",
});
render();

// Consistency — dynamic block-based tracker
// Types: check | counter | target | cheat | expense

const STORAGE_KEY = "consistency.trackers";
const $ = (s) => document.querySelector(s);

let trackers = load();

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(trackers)); }

function dateKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function year() { return new Date().getFullYear(); }

// Streak for check-type trackers
function streak(t) {
  let count = 0, d = new Date();
  if (!t.history?.[dateKey(d)]) d.setDate(d.getDate() - 1);
  while (t.history?.[dateKey(d)]) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

// ---------- Form: show target input only when needed ----------
const typeSelect = $("#tracker-type");
const targetInput = $("#tracker-target");
const targetField = $("#target-field");

function syncTargetField() {
  const needsTarget = ["target", "cheat"].includes(typeSelect.value);
  targetField.classList.toggle("hidden", !needsTarget);
  targetInput.required = needsTarget;
  targetField.querySelector(".field-label").textContent =
    typeSelect.value === "cheat" ? "Cheat days per year" : "Yearly target";
  targetInput.placeholder = typeSelect.value === "cheat" ? "e.g., 12" : "e.g., 10000";
}
typeSelect.addEventListener("change", syncTargetField);

$("#tracker-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = typeSelect.value;
  trackers.push({
    id: crypto.randomUUID(),
    name: $("#tracker-name").value.trim(),
    icon: $("#tracker-icon").value,
    type,
    target: ["target", "cheat"].includes(type) ? Number(targetInput.value) : null,
    year: year(),
    history: {},   // check: {date:true} | counter: {date:count} | expense: {date:[{label,amt}]}
    progress: 0,   // target: total done | cheat: days used
    cheatLog: [],  // cheat: [{date, note}]
  });
  save(); render();
  e.target.reset();
  syncTargetField();
});

// ---------- Actions ----------
const act = {
  toggleCheck(t) {
    const k = dateKey();
    t.history[k] ? delete t.history[k] : (t.history[k] = true);
  },
  addCount(t, n) {
    const k = dateKey();
    t.history[k] = Math.max(0, (t.history[k] || 0) + n);
  },
  minusTarget(t, n) {
    t.progress = Math.min(t.target, t.progress + n);
  },
  useCheat(t, note) {
    t.progress++;
    t.cheatLog.push({ date: dateKey(), note: note || "Cheat day" });
  },
  addExpense(t, label, amt) {
    const k = dateKey();
    (t.history[k] ||= []).push({ label, amt });
  },
  remove(id) {
    if (!confirm("Delete this tracker and its history?")) return;
    trackers = trackers.filter((x) => x.id !== id);
  },
};

// ---------- Render ----------
function render() {
  const grid = $("#tracker-grid");
  grid.innerHTML = "";
  const today = dateKey();

  trackers.forEach((t, i) => {
    const card = document.createElement("article");
    card.className = "card tracker-card";
    card.style.animationDelay = `${Math.min(i, 8) * 40}ms`;
    const badge = { check: "Daily", counter: "Counter", target: "Yearly Target", cheat: "Cheat Days", expense: "Expenses" }[t.type];

    let body = "", sub = "", foot = `<span class="streak-tag"></span>`;

    if (t.type === "check") {
      const done = !!t.history[today];
      const total = Object.keys(t.history).length;
      body = `
        <button class="btn-check ${done ? "is-done" : ""}" data-a="check">
          <span class="check-circle">${done ? "✓" : ""}</span>
          <span>${done ? "Completed today" : "Mark as done"}</span>
        </button>`;
      sub = `${total} day${total === 1 ? "" : "s"} logged in total`;
      foot = `<span class="streak-tag">🔥 ${streak(t)} day streak</span>`;
    }

    if (t.type === "counter") {
      const n = t.history[today] || 0;
      const total = Object.values(t.history).reduce((a, b) => a + b, 0);
      body = `
        <div class="metric"><span class="big-number">${n.toLocaleString()}</span><span class="metric-label">today</span></div>
        <div class="chip-row">
          <button class="btn-chip" data-a="cnt" data-n="1">+1</button>
          <button class="btn-chip" data-a="cnt" data-n="5">+5</button>
          <button class="btn-chip" data-a="cnt" data-n="10">+10</button>
          <button class="btn-chip btn-chip-ghost" data-a="cnt" data-n="-1">−1</button>
        </div>`;
      foot = `<span class="streak-tag">All-time: ${total.toLocaleString()}</span>`;
    }

    if (t.type === "target") {
      const remaining = Math.max(0, t.target - t.progress);
      const pct = Math.min(100, Math.round((t.progress / t.target) * 100));
      body = `
        <div class="metric"><span class="big-number">${remaining.toLocaleString()}</span><span class="metric-label">to go</span></div>
        <div class="chip-row">
          <button class="btn-chip" data-a="tgt" data-n="1">−1</button>
          <button class="btn-chip" data-a="tgt" data-n="5">−5</button>
          <button class="btn-chip" data-a="tgt" data-n="10">−10</button>
          <button class="btn-chip" data-a="tgt" data-n="25">−25</button>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      sub = remaining === 0
        ? `🎉 ${t.year} target of ${t.target.toLocaleString()} completed!`
        : `Goal: ${t.target.toLocaleString()} in ${t.year}`;
      foot = `<span class="streak-tag">${pct}% complete</span>`;
    }

    if (t.type === "cheat") {
      const left = Math.max(0, t.target - t.progress);
      body = `
        <div class="metric"><span class="big-number">${left}</span><span class="metric-label">left</span></div>
        <div class="input-row">
          <input class="mini-input grow" data-i="note" maxlength="40" placeholder="Occasion (e.g., birthday)" />
          <button class="btn-chip btn-chip-solid" data-a="cheat" ${left <= 0 ? "disabled" : ""}>Use one</button>
        </div>`;
      sub = `Allowance of ${t.target} for ${t.year}`;
      if (t.cheatLog.length) {
        body += `<ul class="log-list">` +
          t.cheatLog.slice(-5).reverse().map((c) => `<li><span>${escapeHtml(c.note)}</span><span>${c.date}</span></li>`).join("") +
          `</ul>`;
      }
      foot = `<span class="streak-tag">Used: ${t.progress}</span>`;
    }

    if (t.type === "expense") {
      const todayList = t.history[today] || [];
      const todayTotal = todayList.reduce((a, e) => a + e.amt, 0);
      const monthTotal = Object.entries(t.history)
        .filter(([k]) => k.slice(0, 7) === today.slice(0, 7))
        .reduce((a, [, list]) => a + list.reduce((x, e) => x + e.amt, 0), 0);
      body = `
        <div class="metric"><span class="big-number">₹${todayTotal.toLocaleString()}</span><span class="metric-label">today</span></div>
        <div class="input-row">
          <input class="mini-input grow" data-i="label" maxlength="40" placeholder="Item" />
          <input class="mini-input amt" data-i="amt" type="number" min="0" placeholder="₹" />
          <button class="btn-chip btn-chip-solid" data-a="exp">Add</button>
        </div>`;
      if (todayList.length) {
        body += `<ul class="log-list">` +
          todayList.map((e) => `<li><span>${escapeHtml(e.label)}</span><span>₹${e.amt.toLocaleString()}</span></li>`).join("") +
          `</ul>`;
      }
      foot = `<span class="streak-tag">This month: ₹${monthTotal.toLocaleString()}</span>`;
    }

    card.innerHTML = `
      <div class="tracker-head">
        <span class="tracker-emoji">${t.icon}</span>
        <span class="tracker-title">${escapeHtml(t.name)}</span>
        <span class="tracker-type-badge">${badge}</span>
      </div>
      ${sub ? `<div class="tracker-sub">${sub}</div>` : ""}
      <div class="tracker-body">${body}</div>
      <div class="tracker-foot">${foot}<button class="btn-delete" title="Delete tracker" aria-label="Delete tracker">🗑</button></div>`;

    // Wire events
    card.querySelector(".btn-delete").onclick = () => { act.remove(t.id); save(); render(); };
    card.querySelectorAll("[data-a]").forEach((btn) => {
      btn.onclick = () => {
        const a = btn.dataset.a, n = Number(btn.dataset.n || 0);
        if (a === "check") act.toggleCheck(t);
        if (a === "cnt") act.addCount(t, n);
        if (a === "tgt") act.minusTarget(t, n);
        if (a === "cheat") act.useCheat(t, card.querySelector('[data-i="note"]').value.trim());
        if (a === "exp") {
          const label = card.querySelector('[data-i="label"]').value.trim() || "Expense";
          const amt = Number(card.querySelector('[data-i="amt"]').value);
          if (!amt || amt <= 0) return;
          act.addExpense(t, label, amt);
        }
        save(); render();
      };
    });

    grid.appendChild(card);
  });

  $("#empty-state").classList.toggle("hidden", trackers.length > 0);
  renderStats(today);
}

function renderStats(today) {
  const doneToday = trackers.filter((t) =>
    (t.type === "check" && t.history[today]) ||
    (t.type === "counter" && (t.history[today] || 0) > 0)
  ).length;
  const best = trackers.filter((t) => t.type === "check").reduce((m, t) => Math.max(m, streak(t)), 0);
  const spent = trackers.filter((t) => t.type === "expense")
    .reduce((a, t) => a + (t.history[today] || []).reduce((x, e) => x + e.amt, 0), 0);

  $("#stat-total").textContent = trackers.length;
  $("#stat-done").textContent = doneToday;
  $("#stat-streak").textContent = best;
  $("#stat-expense").textContent = "₹" + spent.toLocaleString();
  $("#tracker-count").textContent = trackers.length;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Theme ----------
const THEME_KEY = "consistency.theme";
const themeBtn = $("#theme-toggle");

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  themeBtn.textContent = mode === "dark" ? "☀️" : "🌙";
  themeBtn.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

applyTheme(
  localStorage.getItem(THEME_KEY) ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
);

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// Init
$("#today-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric",
});
syncTargetField();
render();

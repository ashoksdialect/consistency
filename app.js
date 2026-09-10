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
typeSelect.addEventListener("change", () => {
  const needsTarget = ["target", "cheat"].includes(typeSelect.value);
  targetInput.classList.toggle("hidden", !needsTarget);
  targetInput.required = needsTarget;
  targetInput.placeholder = typeSelect.value === "cheat" ? "Cheat days allowed / year" : "Yearly target (e.g., 10000)";
});

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
  targetInput.classList.add("hidden");
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

  trackers.forEach((t) => {
    const card = document.createElement("div");
    card.className = "block tracker-card";
    const badge = { check: "Daily", counter: "Counter", target: "Yearly Target", cheat: "Cheat Days", expense: "Expenses" }[t.type];

    let body = "", sub = "", foot = `<span class="streak-tag"></span>`;

    if (t.type === "check") {
      const done = !!t.history[today];
      body = `<button class="btn-chip ${done ? "done" : ""}" data-a="check">${done ? "✓ Done today" : "Mark done"}</button>`;
      foot = `<span class="streak-tag">🔥 ${streak(t)} day streak</span>`;
    }

    if (t.type === "counter") {
      const n = t.history[today] || 0;
      const total = Object.values(t.history).reduce((a, b) => a + b, 0);
      body = `
        <span class="big-number">${n}</span>
        <button class="btn-chip" data-a="cnt" data-n="1">+1</button>
        <button class="btn-chip" data-a="cnt" data-n="5">+5</button>
        <button class="btn-chip" data-a="cnt" data-n="10">+10</button>
        <button class="btn-chip" data-a="cnt" data-n="-1">−1</button>`;
      sub = `Today's count · All-time: ${total}`;
    }

    if (t.type === "target") {
      const remaining = t.target - t.progress;
      const pct = Math.round((t.progress / t.target) * 100);
      body = `
        <span class="big-number">${remaining.toLocaleString()}</span>
        <button class="btn-chip" data-a="tgt" data-n="1">−1</button>
        <button class="btn-chip" data-a="tgt" data-n="5">−5</button>
        <button class="btn-chip" data-a="tgt" data-n="10">−10</button>
        <button class="btn-chip" data-a="tgt" data-n="25">−25</button>
        <div class="progress-track" style="width:100%"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      sub = remaining === 0
        ? `🎉 ${t.year} target of ${t.target.toLocaleString()} completed!`
        : `Remaining of ${t.target.toLocaleString()} (${t.year}) · ${pct}% done`;
    }

    if (t.type === "cheat") {
      const left = t.target - t.progress;
      body = `
        <span class="big-number">${left}</span>
        <input class="mini-input" data-i="note" placeholder="Occasion" style="flex:1" />
        <button class="btn-chip" data-a="cheat" ${left <= 0 ? "disabled" : ""}>Use cheat day</button>`;
      sub = `Cheat days left in ${t.year} (of ${t.target}) · Used: ${t.progress}`;
      if (t.cheatLog.length) {
        body += `<ul class="expense-list" style="width:100%">` +
          t.cheatLog.slice(-5).reverse().map((c) => `<li><span>${c.note}</span><span>${c.date}</span></li>`).join("") +
          `</ul>`;
      }
    }

    if (t.type === "expense") {
      const todayList = t.history[today] || [];
      const todayTotal = todayList.reduce((a, e) => a + e.amt, 0);
      const monthTotal = Object.entries(t.history)
        .filter(([k]) => k.slice(0, 7) === today.slice(0, 7))
        .reduce((a, [, list]) => a + list.reduce((x, e) => x + e.amt, 0), 0);
      body = `
        <span class="big-number">₹${todayTotal.toLocaleString()}</span>
        <input class="mini-input" data-i="label" placeholder="Item" style="flex:1" />
        <input class="mini-input" data-i="amt" type="number" min="0" placeholder="₹" />
        <button class="btn-chip" data-a="exp">Add</button>`;
      sub = `Spent today · This month: ₹${monthTotal.toLocaleString()}`;
      if (todayList.length) {
        body += `<ul class="expense-list" style="width:100%">` +
          todayList.map((e) => `<li><span>${e.label}</span><span>₹${e.amt}</span></li>`).join("") +
          `</ul>`;
      }
    }

    card.innerHTML = `
      <div class="tracker-head">
        <span class="tracker-emoji">${t.icon}</span>
        <span class="tracker-title">${escapeHtml(t.name)}</span>
        <span class="tracker-type-badge">${badge}</span>
      </div>
      ${sub ? `<div class="tracker-sub">${sub}</div>` : ""}
      <div class="tracker-body">${body}</div>
      <div class="tracker-foot">${foot}<button class="btn-delete" title="Delete">🗑</button></div>`;

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
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Init
$("#today-date").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric",
});
render();

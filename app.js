/* =========================================================
   Trading Journal – app.js (FULL, SAFE BINDINGS)
   Version: v2025-12-28 02:10 (IL)
   ========================================================= */

const APP_VERSION = "v2025-12-28 02:10 (IL)";

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function clearLog() {
  const box = $("debugLog");
  if (box) box.textContent = "";
}

function log(msg) {
  const box = $("debugLog");
  if (!box) return;
  const t = new Date().toLocaleTimeString();
  box.textContent = `[${t}] ${msg}\n` + box.textContent;
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.style.display = "block";
  el.textContent = msg;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2000);
}

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function formatType(t) {
  return t === "trade" ? "Сделка" : t === "market" ? "Анализ" : "Разбор";
}

// ---------- global error capture (чтобы видеть в debug) ----------
window.addEventListener("error", (e) => {
  log("❌ JS error: " + (e.message || e));
});
window.addEventListener("unhandledrejection", (e) => {
  log("❌ Promise error: " + (e.reason?.message || e.reason || e));
});

// ---------- Supabase ----------
let sb = null;
let currentUser = null;

const SUPABASE_URL = "https://lchstbkuizgablzdczgf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg";

try {
  if (window.supabase?.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  sb = null;
}

// ---------- state ----------
const state = {
  entries: [],
  q: "",
  filterType: ""
};

// ---------- auth render ----------
function renderAuth() {
  if (!sb) {
    setText("sbBadge", "Supabase: ❌");
    setText("authState", "Supabase не загрузился");
    return;
  }

  setText("sbBadge", "Supabase: OK");

  if (currentUser) {
    setText("authState", `Вход: ${currentUser.email}`);
  } else {
    setText("authState", "Не авторизован");
  }
}

// ---------- UI bind (самое важное) ----------
function bindButton(id, handlerName, handlerFn) {
  const el = $(id);
  if (!el) {
    log(`⚠️ Не найден элемент #${id} (не могу повесить ${handlerName})`);
    return;
  }

  // снимаем прошлые (если были)
  el.onclick = null;

  el.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    handlerFn();
  }, { once: false });

  log(`✅ Привязал ${handlerName} → #${id}`);
}

function bindUI() {
  // Биндим кнопки железно
  bindButton("loginBtn", "login()", login);
  bindButton("signupBtn", "signup()", signup);
  bindButton("logoutBtn", "logout()", logout);
  bindButton("saveBtn", "saveEntry()", saveEntry);
  bindButton("resetBtn", "resetForm()", () => { resetForm(); toast("Очищено"); });
  bindButton("reloadBtn", "loadFromDB()", loadFromDB);

  const q = $("q");
  if (q) {
    q.oninput = (e) => { state.q = e.target.value; render(); };
    log("✅ Привязал input → #q");
  }

  const ft = $("filterType");
  if (ft) {
    ft.onchange = (e) => { state.filterType = e.target.value; render(); };
    log("✅ Привязал change → #filterType");
  }
}

// ---------- DB ----------
function mapFromDB(x) {
  return {
    id: x.id,
    date: x.date,
    type: x.type,
    symbol: x.symbol || "",
    setup: x.setup || "",
    side: x.side || "",
    risk: x.risk,
    resultR: x.result_r,
    emotion: x.emotion || "",
    context: x.context || "",
    lessons: x.lessons || "",
    createdAt: x.created_at
  };
}

async function loadFromDB() {
  if (!currentUser) {
    setText("listState", "Нужно войти.");
    state.entries = [];
    render();
    return;
  }

  setText("listState", "Загрузка…");
  log("loadFromDB: start");

  const { data, error } = await sb
    .from("entries")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    setText("listState", "Ошибка загрузки: " + error.message);
    log("loadFromDB error: " + error.message);
    return;
  }

  state.entries = (data || []).map(mapFromDB);
  setText("listState", `Показано: ${filteredEntries().length} (всего: ${state.entries.length})`);
  log("loadFromDB OK: " + state.entries.length);
  render();
}

async function insertToDB(entry) {
  const payload = {
    user_id: currentUser.id,
    date: entry.date,
    type: entry.type,
    symbol: entry.symbol || null,
    setup: entry.setup || null,
    side: entry.side || null,
    risk: entry.risk,
    result_r: entry.resultR,
    emotion: entry.emotion || null,
    context: entry.context || null,
    lessons: entry.lessons || null
  };

  const { error } = await sb.from("entries").insert(payload);
  if (error) {
    toast("Ошибка сохранения: " + error.message);
    log("insert error: " + error.message);
    return false;
  }
  return true;
}

async function deleteFromDB(id) {
  const { error } = await sb.from("entries").delete().eq("id", id);
  if (error) {
    toast("Ошибка удаления: " + error.message);
    log("delete error: " + error.message);
    return false;
  }
  return true;
}

// ---------- render ----------
function filteredEntries() {
  const q = (state.q || "").trim().toLowerCase();
  return state.entries.filter((e) => {
    const okType = !state.filterType || e.type === state.filterType;
    const hay = [
      e.date, e.type, e.symbol, e.setup, e.side, e.emotion, e.context, e.lessons
    ].join(" ").toLowerCase();
    const okQ = !q || hay.includes(q);
    return okType && okQ;
  });
}

function render() {
  // KPI
  const trades = state.entries.filter((e) => e.type === "trade");
  const totalR = trades.reduce((s, e) => s + (Number(e.resultR) || 0), 0);
  const wins = trades.filter((e) => (Number(e.resultR) || 0) > 0).length;
  const winrate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  const kpi = [
    { k: "Всего записей", v: state.entries.length },
    { k: "Сделок", v: trades.length },
    { k: "Winrate", v: winrate + "%" },
    { k: "Суммарно R", v: (Math.round(totalR * 10) / 10).toString() }
  ];

  const kpiEl = $("kpi");
  if (kpiEl) {
    kpiEl.innerHTML = kpi.map((x) => `
      <div class="box">
        <div class="muted">${escapeHtml(x.k)}</div>
        <div class="v">${escapeHtml(x.v)}</div>
      </div>
    `).join("");
  }

  // rows
  const rows = filteredEntries();
  const rowsEl = $("rows");
  if (rowsEl) {
    rowsEl.innerHTML = rows.map((e) => `
      <tr>
        <td>${escapeHtml(e.date || "")}</td>
        <td><span class="tag">${escapeHtml(formatType(e.type))}</span></td>
        <td>
          <div class="pill">
            <strong>${escapeHtml(e.symbol || "—")}</strong>
            ${e.side ? `<span class="tag">${escapeHtml(e.side.toUpperCase())}</span>` : ""}
            ${e.setup ? `<span class="tag">${escapeHtml(e.setup)}</span>` : ""}
            ${e.emotion ? `<span class="tag">${escapeHtml(e.emotion)}</span>` : ""}
          </div>
          <div class="muted" style="margin-top:6px;">
            ${escapeHtml((e.context || e.lessons || "").slice(0, 220))}${(e.context||e.lessons||"").length>220?"…":""}
          </div>
        </td>
        <td class="right">${e.type === "trade" ? escapeHtml(e.resultR ?? "—") : "—"}</td>
        <td><button type="button" data-del="${escapeHtml(e.id)}">Удалить</button></td>
      </tr>
    `).join("");
  }

  // bind delete
  document.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute("data-del");
      if (!confirm("Удалить запись?")) return;
      toast("Удаляю…");
      const ok = await deleteFromDB(id);
      if (ok) await loadFromDB();
    };
  });

  const ls = $("listState");
  if (ls && currentUser) {
    ls.textContent = `Показано: ${rows.length} (всего: ${state.entries.length})`;
  }
}

// ---------- form ----------
function resetForm() {
  const d = $("date"); if (d) d.value = todayISO();
  const t = $("type"); if (t) t.value = "trade";
  const s = $("symbol"); if (s) s.value = "";
  const st = $("setup"); if (st) st.value = "";
  const side = $("side"); if (side) side.value = "";
  const risk = $("risk"); if (risk) risk.value = "";
  const rr = $("resultR"); if (rr) rr.value = "";
  const em = $("emotion"); if (em) em.value = "";
  const c = $("context"); if (c) c.value = "";
  const l = $("lessons"); if (l) l.value = "";
}

// ---------- actions ----------
async function login() {
  toast("Нажал: Войти");
  log("Click login");

  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    log("Login error: " + error.message);
  } else {
    log("Login request OK (ждём auth event)");
  }
}

async function signup() {
  toast("Нажал: Регистрация");
  log("Click signup");

  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    log("Signup error: " + error.message);
  } else {
    alert("Пользователь создан. Если включено подтверждение — проверь почту.");
    log("Signup request OK");
  }
}

async function logout() {
  toast("Нажал: Выйти");
  log("Click logout");
  await sb.auth.signOut();
}

async function saveEntry() {
  toast("Сохраняю…");
  log("Click save");

  if (!currentUser) {
    toast("Сначала войди");
    return;
  }

  const entry = {
    date: $("date")?.value || todayISO(),
    type: $("type")?.value || "trade",
    symbol: ($("symbol")?.value || "").trim(),
    setup: ($("setup")?.value || "").trim(),
    side: $("side")?.value || null,
    risk: numOrNull($("risk")?.value),
    resultR: numOrNull($("resultR")?.value),
    emotion: $("emotion")?.value || null,
    context: ($("context")?.value || "").trim(),
    lessons: ($("lessons")?.value || "").trim()
  };

  if (entry.type === "trade" && !entry.symbol) {
    toast("Для сделки укажи инструмент");
    return;
  }

  const ok = await insertToDB(entry);
  if (ok) {
    toast("Сохранено ✅");
    resetForm();
    await loadFromDB();
  }
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  // шапка
  setText("versionBadge", "Версия: " + APP_VERSION);
  setText("jsBadge", "JS: OK");
  setText("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  clearLog();
  log("app.js запущен: " + APP_VERSION);

  // дата по умолчанию
  if ($("date")) $("date").value = todayISO();

  // биндим UI сразу и ещё раз через секунду (на случай кеша/дергания DOM)
  bindUI();
  setTimeout(bindUI, 800);

  if (!sb) {
    renderAuth();
    return;
  }

  // auth events
  sb.auth.onAuthStateChange((event, session) => {
    log(`Auth event: ${event}`);
    currentUser = session?.user || null;
    renderAuth();
    bindUI(); // ещё раз на всякий
    if (currentUser) loadFromDB();
    else { state.entries = []; render(); }
  });

  // стартовая сессия
  const { data } = await sb.auth.getSession();
  currentUser = data.session?.user || null;
  renderAuth();

  if (currentUser) {
    log("Session OK: " + currentUser.email);
    await loadFromDB();
  } else {
    log("Session: none");
    render();
  }
});

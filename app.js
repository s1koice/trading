/* =========================================================
   Trading Journal – app.js (FULL)
   Version: v2025-12-28 02:25 (IL)
   ========================================================= */

const APP_VERSION = "v2025-12-28 02:25 (IL)";

const $ = (id) => document.getElementById(id);

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function toast(msg) {
  const el = $("toast"); if (!el) return;
  el.style.display = "block";
  el.textContent = msg;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2200);
}
function log(msg) {
  const box = $("debugLog"); if (!box) return;
  const t = new Date().toLocaleTimeString();
  box.textContent = `[${t}] ${msg}\n` + box.textContent;
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

// ===== error capture =====
window.addEventListener("error", (e) => log("❌ JS error: " + (e.message || e)));
window.addEventListener("unhandledrejection", (e) => log("❌ Promise error: " + (e.reason?.message || e.reason || e)));

// ===== Supabase =====
const SUPABASE_URL = "https://lchstbkuizgablzdczgf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg";

let sb = null;
try {
  if (window.supabase?.createClient) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch { sb = null; }

let currentUser = null;

const state = {
  entries: [],
  q: "",
  filterType: ""
};

// ===== "кабинет" UI переключение =====
function ensureCabinetUI() {
  // добавим контейнер кабинета прямо в карточку аккаунта (если его ещё нет)
  const authState = $("authState");
  if (!authState) return;

  let cab = $("cabinetPanel");
  if (!cab) {
    cab = document.createElement("div");
    cab.id = "cabinetPanel";
    cab.style.marginTop = "10px";
    cab.style.padding = "10px 12px";
    cab.style.borderRadius = "14px";
    cab.style.border = "1px solid #223057";
    cab.style.background = "#0b1020";
    cab.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">Кабинет</div>
      <div id="cabinetUser" style="font-size:13px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;">
        <button id="cabinetLogout" type="button" style="flex:1;">Выйти</button>
        <button id="cabinetScroll" type="button" style="flex:1;">К дашборду</button>
      </div>
    `;
    authState.parentElement.insertBefore(cab, authState.nextSibling);
  }
}

function setCabinetMode(isIn) {
  ensureCabinetUI();

  const email = $("email");
  const pass = $("password");
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");

  const cab = $("cabinetPanel");
  const cabUser = $("cabinetUser");
  const cabLogout = $("cabinetLogout");
  const cabScroll = $("cabinetScroll");

  if (isIn) {
    if (email) email.disabled = true;
    if (pass) pass.disabled = true;
    if (loginBtn) loginBtn.disabled = true;
    if (signupBtn) signupBtn.disabled = true;

    if (cab) cab.style.display = "block";
    if (cabUser) cabUser.textContent = `Вы вошли как: ${currentUser?.email || "—"}`;

    if (cabLogout) cabLogout.onclick = () => logout();
    if (cabScroll) cabScroll.onclick = () => {
      const dash = document.querySelector("section.card:nth-child(2)");
      if (dash) dash.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  } else {
    if (email) email.disabled = false;
    if (pass) pass.disabled = false;
    if (loginBtn) loginBtn.disabled = false;
    if (signupBtn) signupBtn.disabled = false;

    if (cab) cab.style.display = "none";
  }
}

// ===== auth render =====
function renderAuth() {
  setText("versionBadge", "Версия: " + APP_VERSION);
  setText("jsBadge", "JS: OK");
  setText("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  if (!sb) {
    setText("authState", "Supabase не загрузился");
    setCabinetMode(false);
    return;
  }

  if (currentUser) {
    setText("authState", `Вход: ${currentUser.email}`);
    setCabinetMode(true);
  } else {
    setText("authState", "Не авторизован");
    setCabinetMode(false);
  }
}

// ===== UI bind =====
function bindButton(id, name, fn) {
  const el = $(id);
  if (!el) { log(`⚠️ Не найден #${id} (для ${name})`); return; }
  el.onclick = null;
  el.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    fn();
  });
}

function bindUI() {
  bindButton("loginBtn", "login()", login);
  bindButton("signupBtn", "signup()", signup);
  bindButton("logoutBtn", "logout()", logout);
  bindButton("reloadBtn", "loadFromDB()", loadFromDB);

  bindButton("saveBtn", "saveEntry()", saveEntry);
  bindButton("resetBtn", "resetForm()", () => { resetForm(); toast("Очищено"); });

  const q = $("q");
  if (q) q.oninput = (e) => { state.q = e.target.value; render(); };

  const ft = $("filterType");
  if (ft) ft.onchange = (e) => { state.filterType = e.target.value; render(); };

  log("✅ UI bind OK");
}

// ===== DB =====
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

function filteredEntries() {
  const q = (state.q || "").trim().toLowerCase();
  return state.entries.filter((e) => {
    const okType = !state.filterType || e.type === state.filterType;
    const hay = [e.date, e.type, e.symbol, e.setup, e.side, e.emotion, e.context, e.lessons].join(" ").toLowerCase();
    const okQ = !q || hay.includes(q);
    return okType && okQ;
  });
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

// ===== render =====
function render() {
  const trades = state.entries.filter((e) => e.type === "trade");
  const totalR = trades.reduce((s, e) => s + (Number(e.resultR) || 0), 0);
  const wins = trades.filter((e) => (Number(e.resultR) || 0) > 0).length;
  const winrate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  const kpiData = [
    { k: "Всего записей", v: state.entries.length },
    { k: "Сделок", v: trades.length },
    { k: "Winrate", v: winrate + "%" },
    { k: "Суммарно R", v: (Math.round(totalR * 10) / 10).toString() }
  ];

  const kpi = $("kpi");
  if (kpi) {
    kpi.innerHTML = kpiData.map((x) => `
      <div class="box">
        <div class="muted">${escapeHtml(x.k)}</div>
        <div class="v">${escapeHtml(x.v)}</div>
      </div>
    `).join("");
  }

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
  if (ls && currentUser) ls.textContent = `Показано: ${rows.length} (всего: ${state.entries.length})`;
}

// ===== form =====
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

// ===== actions =====
async function login() {
  toast("Вхожу…");
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
  toast("Создаю аккаунт…");
  log("Click signup");

  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    log("Signup error: " + error.message);
  } else {
    alert("Аккаунт создан. Если включено подтверждение — проверь почту.");
    log("Signup request OK");
  }
}

async function logout() {
  toast("Выход…");
  log("Click logout");
  await sb.auth.signOut();
}

async function saveEntry() {
  toast("Сохраняю…");
  log("Click save");

  if (!currentUser) return toast("Сначала войди");

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

  if (entry.type === "trade" && !entry.symbol) return toast("Для сделки укажи инструмент");

  const ok = await insertToDB(entry);
  if (ok) {
    toast("Сохранено ✅");
    resetForm();
    await loadFromDB();
  }
}

// ===== init =====
document.addEventListener("DOMContentLoaded", async () => {
  setText("versionBadge", "Версия: " + APP_VERSION);
  setText("jsBadge", "JS: OK");
  setText("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  log("app.js запущен: " + APP_VERSION);

  if ($("date")) $("date").value = todayISO();

  bindUI();
  setTimeout(bindUI, 800);

  if (!sb) { renderAuth(); return; }

  sb.auth.onAuthStateChange((event, session) => {
    log(`Auth event: ${event}`);
    currentUser = session?.user || null;
    renderAuth();

    if (event === "SIGNED_IN") {
      toast("Вход выполнен ✅");
      const dash = document.querySelector("section.card:nth-child(2)");
      if (dash) dash.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (currentUser) loadFromDB();
    else { state.entries = []; render(); }
  });

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

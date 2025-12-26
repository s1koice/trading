// Trading Journal — external JS to bypass inline-script blockers
const APP_VERSION = "v2025-12-28 00:20 (IL)";

// ===== helpers
const $ = (id) => document.getElementById(id);

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function setBadge(id, text){
  const el = $(id);
  if (el) el.textContent = text;
}

function log(msg){
  const box = $("debugLog");
  const t = new Date().toLocaleTimeString();
  if (box) box.textContent = `[${t}] ${msg}\n` + (box.textContent || "");
}

function toast(msg, kind="ok"){
  const el = $("toast");
  if (!el) return;
  el.style.display = "block";
  el.innerHTML = `<span class="${kind}">${escapeHtml(msg)}</span>`;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.style.display="none", 2600);
}

function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60*1000);
  return local.toISOString().slice(0,10);
}

function numOrNull(v){
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatType(t){
  return t === "trade" ? "Сделка" : t === "market" ? "Анализ" : "Разбор";
}

function setFormEnabled(enabled){
  const ids = ["date","type","symbol","setup","side","risk","resultR","emotion","context","lessons","saveBtn","resetBtn"];
  ids.forEach(id => { const el = $(id); if (el) el.disabled = !enabled; });
}

// ===== supabase config (оставляю твои)
const SUPABASE_URL = "https://lchstbkuizgablzdczgf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg";

let supabase = null;
try {
  if (window.supabase && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (_) {
  supabase = null;
}

// ===== state
const state = { entries: [], filterType: "", q: "" };
let currentUser = null;

// ===== db helpers
function mapFromDB(x){
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

function filtered(){
  const q = state.q.trim().toLowerCase();
  return state.entries.filter(e => {
    const okType = !state.filterType || e.type === state.filterType;
    const hay = [e.symbol, e.setup, e.side, e.emotion, e.context, e.lessons, e.type, e.date].join(" ").toLowerCase();
    const okQ = !q || hay.includes(q);
    return okType && okQ;
  });
}

function render(){
  const kpiEl = $("kpi");
  const rowsEl = $("rows");

  const trades = state.entries.filter(e => e.type === "trade");
  const totalR = trades.reduce((s,e)=> s + (Number(e.resultR) || 0), 0);
  const wins = trades.filter(e => (Number(e.resultR) || 0) > 0).length;
  const winrate = trades.length ? Math.round((wins / trades.length) * 100) : 0;

  if (kpiEl) {
    const kpi = [
      {k:"Всего записей", v: state.entries.length},
      {k:"Сделок", v: trades.length},
      {k:"Winrate", v: winrate + "%"},
      {k:"Суммарно R", v: (Math.round(totalR*10)/10).toString()}
    ];
    kpiEl.innerHTML = kpi.map(x => `
      <div class="box">
        <div class="muted">${escapeHtml(x.k)}</div>
        <div class="v">${escapeHtml(x.v)}</div>
      </div>
    `).join("");
  }

  if (rowsEl) {
    const rows = filtered();
    rowsEl.innerHTML = rows.map(e => `
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
        <td class="right">${e.type==="trade" ? escapeHtml(e.resultR ?? "—") : "—"}</td>
        <td><button type="button" data-del="${escapeHtml(e.id)}">Удалить</button></td>
      </tr>
    `).join("");

    rowsEl.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("Удалить запись?")) return;
        await deleteFromDB(id);
        await loadFromDB();
      });
    });
  }

  const listState = $("listState");
  if (listState && currentUser) {
    listState.textContent = `Показано: ${filtered().length} (всего: ${state.entries.length})`;
  }
}

// ===== auth + db
async function refreshAuth(){
  const authState = $("authState");

  if(!supabase){
    if (authState) authState.innerHTML = `❌ <span class="bad">Supabase не загрузился.</span> (CDN/блокировка)`;
    setBadge("sbBadge", "Supabase: НЕ ЗАГРУЖЕН");
    setFormEnabled(false);
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) logoutBtn.disabled = true;
    log("supabase == null → вероятно блокируется внешний скрипт.");
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    currentUser = data.user || null;

    if(currentUser){
      if (authState) authState.innerHTML = `✅ <span class="ok">Вход:</span> ${escapeHtml(currentUser.email)}`;
      const logoutBtn = $("logoutBtn");
      if (logoutBtn) logoutBtn.disabled = false;
      setFormEnabled(true);
      log("Auth OK: " + currentUser.email);
    } else {
      if (authState) authState.innerHTML = `⚠️ <span class="warn">Не авторизован.</span> Войди или зарегистрируйся.`;
      const logoutBtn = $("logoutBtn");
      if (logoutBtn) logoutBtn.disabled = true;
      setFormEnabled(false);
      log("Auth: user=null");
    }
  } catch(e){
    if (authState) authState.innerHTML = `❌ <span class="bad">Auth ошибка:</span> ${escapeHtml(e.message || e)}`;
    const logoutBtn = $("logoutBtn");
    if (logoutBtn) logoutBtn.disabled = true;
    setFormEnabled(false);
    log("Auth error: " + (e.message || e));
  }
}

async function loadFromDB(){
  if(!currentUser){
    const listState = $("listState");
    if (listState) listState.textContent = "Нет данных: нужно войти.";
    state.entries = [];
    render();
    return;
  }

  const listState = $("listState");
  if (listState) listState.textContent = "Загрузка…";
  log("loadFromDB: start");

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if(error){
    if (listState) listState.innerHTML = `<span class="bad">Ошибка загрузки:</span> ${escapeHtml(error.message)}`;
    state.entries = [];
    render();
    log("loadFromDB error: " + error.message);
    return;
  }

  state.entries = (data || []).map(mapFromDB);
  if (listState) listState.textContent = `Загружено записей: ${state.entries.length}`;
  log("loadFromDB OK: " + state.entries.length);
  render();
}

async function insertToDB(entry){
  if(!currentUser){
    toast("Сначала войди", "warn");
    return false;
  }
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

  const { error } = await supabase.from("entries").insert(payload);
  if(error){
    toast("Ошибка сохранения: " + error.message, "bad");
    log("insertToDB error: " + error.message);
    return false;
  }
  return true;
}

async function deleteFromDB(id){
  const { error } = await supabase.from("entries").delete().eq("id", id);
  if(error){
    toast("Ошибка удаления: " + error.message, "bad");
    log("deleteFromDB error: " + error.message);
    return false;
  }
  return true;
}

function resetForm(){
  const date = $("date"); if (date) date.value = todayISO();
  const type = $("type"); if (type) type.value = "trade";
  ["symbol","setup","risk","resultR","context","lessons"].forEach(id => { const el = $(id); if (el) el.value = ""; });
  const side = $("side"); if (side) side.value = "";
  const emotion = $("emotion"); if (emotion) emotion.value = "";
}

async function login(){
  toast("Нажал: Войти", "warn");
  log("Click: login");
  if(!supabase) return alert("Supabase не загрузился (скорее всего блокируется CDN).");
  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if(!email || !password) return toast("Заполни email и пароль", "warn");

  $("loginBtn").disabled = true;
  try{
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) throw error;
    toast("Вход выполнен", "ok");
    await refreshAuth();
    await loadFromDB();
  } catch(e){
    toast(e.message || "Ошибка входа", "bad");
    log("Login error: " + (e.message || e));
  } finally {
    $("loginBtn").disabled = false;
  }
}

async function signup(){
  toast("Нажал: Регистрация", "warn");
  log("Click: signup");
  if(!supabase) return alert("Supabase не загрузился (скорее всего блокируется CDN).");
  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if(!email || !password) return toast("Заполни email и пароль", "warn");

  $("signupBtn").disabled = true;
  try{
    const { error } = await supabase.auth.signUp({ email, password });
    if(error) throw error;
    toast("Регистрация создана. Если нужно — проверь почту.", "ok");
    await refreshAuth();
    await loadFromDB();
  } catch(e){
    toast(e.message || "Ошибка регистрации", "bad");
    log("Signup error: " + (e.message || e));
  } finally {
    $("signupBtn").disabled = false;
  }
}

async function logout(){
  toast("Нажал: Выйти", "warn");
  log("Click: logout");
  if(!supabase) return;
  try{
    await supabase.auth.signOut();
    currentUser = null;
    state.entries = [];
    render();
    await refreshAuth();
    toast("Выход выполнен", "ok");
  } catch(e){
    toast(e.message || "Ошибка выхода", "bad");
    log("Logout error: " + (e.message || e));
  }
}

async function addEntry(){
  toast("Нажал: Сохранить", "warn");
  log("Click: save");

  const entry = {
    date: $("date")?.value || todayISO(),
    type: $("type")?.value || "trade",
    symbol: $("symbol")?.value?.trim() || "",
    setup: $("setup")?.value?.trim() || "",
    side: $("side")?.value || "",
    risk: numOrNull($("risk")?.value),
    resultR: numOrNull($("resultR")?.value),
    emotion: $("emotion")?.value || "",
    context: $("context")?.value?.trim() || "",
    lessons: $("lessons")?.value?.trim() || ""
  };

  if(entry.type === "trade" && !entry.symbol){
    return toast("Для сделки укажи инструмент", "warn");
  }

  $("saveBtn").disabled = true;
  const ok = await insertToDB(entry);
  $("saveBtn").disabled = false;

  if(ok){
    resetForm();
    await loadFromDB();
    toast("Сохранено в БД", "ok");
  }
}

// ===== INIT
document.addEventListener("DOMContentLoaded", async () => {
  // если этот код не выполнится — JS снова блокируется вообще полностью
  setBadge("versionBadge", "Версия: " + APP_VERSION);
  setBadge("jsBadge", "JS: OK (app.js)");
  setBadge("sbBadge", "Supabase: " + (supabase ? "OK" : "НЕ ЗАГРУЖЕН"));
  const date = $("date"); if (date) date.value = todayISO();
  log("app.js запущен. Версия " + APP_VERSION);

  // ЖЕЛЕЗНО вешаем обработчики
  $("loginBtn")?.addEventListener("click", login);
  $("signupBtn")?.addEventListener("click", signup);
  $("logoutBtn")?.addEventListener("click", logout);
  $("reloadBtn")?.addEventListener("click", () => { toast("Нажал: Обновить", "warn"); loadFromDB(); });
  $("saveBtn")?.addEventListener("click", addEntry);
  $("resetBtn")?.addEventListener("click", () => { resetForm(); toast("Очищено", "ok"); });

  $("q")?.addEventListener("input", (e)=>{ state.q = e.target.value; render(); });
  $("filterType")?.addEventListener("change", (e)=>{ state.filterType = e.target.value; render(); });

  if(!supabase){
    $("authState").innerHTML = `❌ <span class="bad">Supabase не загрузился.</span> Если кнопки реагируют (toast/log), значит блокируется только CDN.`;
    setFormEnabled(false);
    $("logoutBtn").disabled = true;
    return;
  }

  await refreshAuth();
  await loadFromDB();
  render();
});

/* =========================================================
   Trading Journal – app.js
   AUTH FIX (onAuthStateChange)
   Version: v2025-12-28 01:30 (IL)
   ========================================================= */

const APP_VERSION = "v2025-12-28 01:30 (IL)";

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

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

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.style.display = "block";
  el.textContent = msg;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2500);
}

function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// ---------- Supabase ----------
let sb = null;
let currentUser = null;

const SUPABASE_URL = "https://lchstbkuizgablzdczgf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg";

if (window.supabase?.createClient) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------- AUTH STATE ----------
function renderAuth() {
  if (currentUser) {
    setText("authState", `Вход: ${currentUser.email}`);
    log("Auth OK: " + currentUser.email);
  } else {
    setText("authState", "Не авторизован");
    log("Auth: not logged in");
  }
}

// ❗ КЛЮЧЕВОЙ МОМЕНТ
// слушаем реальное изменение сессии
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    log(`Auth event: ${event}`);
    currentUser = session?.user || null;
    renderAuth();
  });
}

// ---------- actions ----------
async function login() {
  toast("Нажал: Войти");
  log("Click login");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    alert("Email и пароль обязательны");
    return;
  }

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    log("Login error: " + error.message);
  }
}

async function signup() {
  toast("Нажал: Регистрация");
  log("Click signup");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    alert("Email и пароль обязательны");
    return;
  }

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    log("Signup error: " + error.message);
  } else {
    alert("Пользователь создан. Если включено подтверждение — проверь почту.");
  }
}

async function logout() {
  toast("Нажал: Выйти");
  log("Click logout");
  await sb.auth.signOut();
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
  clearLog();

  setText("versionBadge", "Версия: " + APP_VERSION);
  setText("jsBadge", "JS: OK");
  setText("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  $("date").value = today();

  $("loginBtn").onclick = login;
  $("signupBtn").onclick = signup;
  $("logoutBtn").onclick = logout;

  log("app.js запущен: " + APP_VERSION);

  // проверяем сессию при старте
  const { data } = await sb.auth.getSession();
  currentUser = data.session?.user || null;
  renderAuth();
});

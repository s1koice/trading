/* =========================================================
   Trading Journal – app.js
   FIX: no global "supabase" redeclaration
   Version: v2025-12-28 01:12 (IL)
   ========================================================= */

const APP_VERSION = "v2025-12-28 01:12 (IL)";

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
  window.__toastTimer = setTimeout(() => (el.style.display = "none"), 2500);
}

function today() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

// ---------- Supabase INIT ----------
// ❗ ВАЖНО: используем имя sb, НЕ "supabase"
let sb = null;

const SUPABASE_URL = "https://lchstbkuizgablzdczgf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg";

try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  sb = null;
}

// ---------- auth ----------
let currentUser = null;

async function refreshAuth() {
  if (!sb) {
    setText("sbBadge", "Supabase: ❌");
    setText("authState", "Supabase не загружен");
    log("Supabase client = null (CDN заблокирован или не загрузился)");
    return;
  }

  try {
    const { data, error } = await sb.auth.getUser();
    if (error) throw error;

    currentUser = data.user;

    if (currentUser) {
      setText("authState", `Вход: ${currentUser.email}`);
      log("Auth OK: " + currentUser.email);
    } else {
      setText("authState", "Не авторизован");
      log("Auth: not logged in");
    }
  } catch (e) {
    setText("authState", "Ошибка auth: " + (e.message || e));
    log("Auth error: " + (e.message || e));
  }
}

// ---------- buttons ----------
async function login() {
  toast("Нажал: Войти");
  log("Click login");

  if (!sb) return alert("Supabase не загрузился");

  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    alert(error.message);
    log("Login error: " + error.message);
    return;
  }

  await refreshAuth();
}

async function signup() {
  toast("Нажал: Регистрация");
  log("Click signup");

  if (!sb) return alert("Supabase не загрузился");

  const email = $("email")?.value?.trim() || "";
  const password = $("password")?.value || "";
  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    log("Signup error: " + error.message);
    return;
  }

  alert("Пользователь создан (если включено подтверждение — проверь почту)");
  await refreshAuth();
}

async function logout() {
  toast("Нажал: Выйти");
  log("Click logout");

  if (!sb) return;

  await sb.auth.signOut();
  currentUser = null;
  await refreshAuth();
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", async () => {
  // очищаем “ожидаю запуск…”
  clearLog();

  setText("versionBadge", "Версия: " + APP_VERSION);
  setText("jsBadge", "JS: OK");
  setText("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  const dateEl = $("date");
  if (dateEl) dateEl.value = today();

  // обработчики
  $("loginBtn")?.addEventListener("click", login);
  $("signupBtn")?.addEventListener("click", signup);
  $("logoutBtn")?.addEventListener("click", logout);

  log("app.js запущен: " + APP_VERSION);

  await refreshAuth();
});

/* =========================================================
   Trading Journal – app.js
   FIX: no global "supabase" redeclaration
   Version: v2025-12-28 01:05 (IL)
   ========================================================= */

const APP_VERSION = "v2025-12-28 01:05 (IL)";

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

function log(msg) {
  const box = $("debugLog");
  if (!box) return;
  const t = new Date().toLocaleTimeString();
  box.textContent = `[${t}] ${msg}\n` + box.textContent;
}

function badge(id, text) {
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
  return new Date().toISOString().slice(0, 10);
}

// ---------- Supabase INIT ----------
// ❗ ВАЖНО: используем ДРУГОЕ имя (sb), а не "supabase"
let sb = null;

try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(
      "https://lchstbkuizgablzdczgf.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjaHN0Ymt1aXpnYWJsemRjemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE2MDQsImV4cCI6MjA4MjM0NzYwNH0.0HnmhHZSDNktliI1ieg7F_ehVuvDp3nwh8vhFJM6eRg"
    );
  }
} catch (e) {
  sb = null;
}

// ---------- auth ----------
let currentUser = null;

async function refreshAuth() {
  if (!sb) {
    badge("sbBadge", "Supabase: ❌");
    $("authState").textContent = "Supabase не загружен";
    log("Supabase client = null");
    return;
  }

  const { data } = await sb.auth.getUser();
  currentUser = data.user;

  if (currentUser) {
    $("authState").textContent = `Вход: ${currentUser.email}`;
    log("Auth OK: " + currentUser.email);
  } else {
    $("authState").textContent = "Не авторизован";
    log("Auth: not logged in");
  }
}

// ---------- buttons ----------
async function login() {
  toast("Нажал: Войти");
  log("Click login");

  const email = $("email").value.trim();
  const password = $("password").value;

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

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) return alert("Email и пароль обязательны");

  const { error } = await sb.auth.signUp({ email, password });
  if (error) {
    alert(error.message);
    log("Signup error: " + error.message);
    return;
  }

  alert("Пользователь создан");
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
  badge("versionBadge", "Версия: " + APP_VERSION);
  badge("jsBadge", "JS: OK");
  badge("sbBadge", sb ? "Supabase: OK" : "Supabase: ❌");

  $("date").value = today();

  // обработчики
  $("loginBtn").addEventListener("click", login);
  $("signupBtn").addEventListener("click", signup);
  $("logoutBtn").addEventListener("click", logout);

  log("app.js запущен");
  await refreshAuth();
});

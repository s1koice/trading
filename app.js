<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Trading Journal</title>

  <style>
    :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    body { margin: 0; background:#0b0f19; color:#e7eaf3; }

    header {
      padding: 18px 16px;
      border-bottom: 1px solid #1b2440;
      background:#0b0f19;
      position: sticky;
      top:0;
      z-index: 10;
    }
    h1 { margin: 0 0 6px; font-size: 18px; }
    .sub { display:flex; gap:10px; flex-wrap: wrap; }
    .badge {
      display:inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      border:1px solid #223057;
      background:#0b1020;
      font-size: 12px;
      color:#cfd6f5;
    }

    /* ВАЖНО: main ВСЕГДА видим */
    main {
      display: grid !important;
      grid-template-columns: 380px 1fr;
      gap: 16px;
      max-width: 1150px;
      margin: 0 auto;
      padding: 16px;
      min-height: 60vh;
    }
    @media (max-width: 980px){
      main { grid-template-columns: 1fr; }
    }

    .card {
      background:#0f1629;
      border:1px solid #1b2440;
      border-radius: 16px;
      padding: 14px;
      overflow: visible;
    }
    .card h2 { margin: 0 0 10px; font-size: 14px; color:#cfd6f5; }
    .muted { color:#aab3d3; font-size: 12px; }

    label { display:block; font-size: 12px; color:#aab3d3; margin: 10px 0 6px; }
    input, select, textarea, button {
      width: 100%;
      box-sizing: border-box;
      border-radius: 12px;
      border: 1px solid #223057;
      background:#0b1020;
      color:#e7eaf3;
      padding: 10px 12px;
      font-size: 14px;
    }
    textarea { min-height: 88px; resize: vertical; }
    button { cursor:pointer; background:#111a33; border:1px solid #2d3d6f; }
    button:disabled { opacity: .6; cursor: not-allowed; }

    .row { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .row3 { display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; }
    .btnRow { display:flex; gap:10px; }
    .btnRow button { flex:1; }

    .kpi { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; }
    .kpi .box { background:#0b1020; border:1px solid #223057; border-radius: 14px; padding: 10px; }
    .kpi .v { font-size: 18px; margin-top:4px; }

    /* TABLE FIX */
    table {
      width:100%;
      border-collapse: separate;
      border-spacing: 0;
      overflow:hidden;
      border-radius: 14px;
      border:1px solid #1b2440;
    }
    thead th{
      background:#0b1020;
      color:#cfd6f5;
      font-size: 13px;
      padding: 12px;
      border-bottom:1px solid #1b2440;
      text-align:left;
      white-space: nowrap;
    }
    td{
      padding: 14px 12px;
      vertical-align: top;
      font-size: 13px;
      line-height: 1.45; /* ключ */
      border-bottom:1px solid #1b2440;
    }
    tr:hover td { background:#0b1020; }
    .right { text-align:right; }

    .tag {
      display:inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      border:1px solid #223057;
      font-size: 12px;
      color:#cfd6f5;
      white-space: nowrap;
    }
    .pill { display:inline-flex; gap:8px; align-items:center; flex-wrap: wrap; }

    .debugbox {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background:#0b1020;
      border:1px solid #223057;
      max-height: 220px;
      overflow:auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
    }

    .toast {
      position: fixed;
      left: 50%;
      bottom: 62px;
      transform: translateX(-50%);
      background: #0b1020;
      border:1px solid #223057;
      border-radius: 14px;
      padding: 10px 12px;
      min-width: 260px;
      max-width: 92vw;
      display:none;
      z-index: 9999;
    }

    /* Аварийное сообщение если JS не стартанул */
    #jsFail {
      margin-top: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      border:1px solid #5a2a2a;
      background:#1a0f12;
      color:#ffb6b6;
      font-size: 12px;
    }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js" defer></script>
  <script src="./app.js" defer></script>
</head>

<body>
<header>
  <h1>Trading Journal</h1>
  <div class="sub">
    <span class="badge" id="versionBadge">Версия: …</span>
    <span class="badge" id="sbBadge">Supabase: …</span>
    <span class="badge" id="jsBadge">JS: …</span>
  </div>
</header>

<main id="main">
  <section class="card">
    <h2>🔐 Аккаунт</h2>

    <label>Email</label>
    <input id="email" autocomplete="email" />

    <label>Пароль</label>
    <input id="password" type="password" autocomplete="current-password" />

    <div class="btnRow" style="margin-top:10px;">
      <button id="loginBtn" type="button">Войти</button>
      <button id="signupBtn" type="button">Регистрация</button>
    </div>

    <div class="btnRow" style="margin-top:10px;">
      <button id="logoutBtn" type="button">Выйти</button>
      <button id="reloadBtn" type="button">Обновить записи</button>
    </div>

    <div class="muted" id="authState" style="margin-top:10px;">—</div>

    <div id="jsFail">
      Если ты видишь это сообщение и кнопки не работают — значит JS не запустился.
      Проверь Console (F12) на ошибки.
    </div>

    <div class="debugbox" id="debugLog">Debug log: ожидаю запуск app.js…</div>
  </section>

  <section class="card">
    <h2>📊 Дашборд</h2>
    <div class="kpi" id="kpi"></div>

    <div class="row" style="margin-top:12px;">
      <div>
        <label>Поиск</label>
        <input id="q" placeholder="BTC / breakout / ошибки..." />
      </div>
      <div>
        <label>Фильтр типа</label>
        <select id="filterType">
          <option value="">Все</option>
          <option value="trade">Сделка</option>
          <option value="market">Анализ рынка</option>
          <option value="review">Разбор дня</option>
        </select>
      </div>
    </div>

    <div class="muted" id="listState" style="margin-top:10px;">—</div>

    <div style="margin-top:12px; overflow:auto;">
      <table>
        <thead>
          <tr>
            <th style="width:110px;">Дата</th>
            <th style="width:110px;">Тип</th>
            <th>Содержание</th>
            <th style="width:100px;" class="right">R</th>
            <th style="width:140px;">Действия</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>
</main>

<div class="toast" id="toast"></div>

<script>
  // Если app.js стартанёт — он поставит "JS: OK".
  // Если через 1.5s не поменялось — покажем подсказку.
  setTimeout(() => {
    const js = document.getElementById("jsBadge");
    if (js && !js.textContent.includes("OK")) {
      // оставляем аварийное сообщение видимым
    } else {
      const fail = document.getElementById("jsFail");
      if (fail) fail.style.display = "none";
    }
  }, 1500);
</script>
</body>
</html>

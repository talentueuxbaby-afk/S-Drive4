const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

/* =========================================================
   CONFIGURATION S-DRIVE
========================================================= */

const APP_URL =
  process.env.APP_URL ||
  "https://sdrive-1.onrender.com";

const WAVE_URL =
  process.env.WAVE_URL ||
  "https://pay.wave.com/m/M_ci_kpNTVGT9JGah/c/ci/?amount=1000";

const WHATSAPP_NUMBER =
  process.env.WHATSAPP_NUMBER ||
  "2250152171974";

const WHATSAPP_MESSAGE =
  "Bonjour S-Drive 👋\n\n" +
  "Je souhaite faire analyser mon coupon/match.\n\n" +
  "Je vous envoie ma capture pour analyse.";

const TELEGRAM_URL =
  process.env.TELEGRAM_URL ||
  "https://t.me/sdrive12";

const TELEGRAM_MESSAGE =
  "Bonjour S-Drive 👋\n\n" +
  "Je souhaite faire analyser mon coupon/match.\n\n" +
  "Je vous envoie ma capture pour analyse.";

const WHATSAPP_GROUP_URL =
  process.env.WHATSAPP_GROUP_URL ||
  "https://chat.whatsapp.com/GikWdoQLZ8TFDHK2rTHH8T?s=cl&p=a&mlu=4&ilr=4";

const TELEGRAM_GROUP_URL =
  process.env.TELEGRAM_GROUP_URL ||
  "https://t.me/sdrive123";

/* =========================================================
   BOOKMAKERS
========================================================= */

const WIN1_URL =
  process.env.WIN1_URL ||
  "https://one-vv3942.com/?p=gc9k&sub1=DM07";

const PARIPESA_URL =
  process.env.PARIPESA_URL ||
  "https://combodef.com/L?tag=d_4081071m_60651c_&site=4081071&ad=60651";

const LOTO_URL =
  process.env.LOTO_URL ||
  "https://jdnlotto.com/register?promo=123";

/* =========================================================
   RÉSEAUX SOCIAUX
========================================================= */

const TIKTOK_URL =
  process.env.TIKTOK_URL ||
  "https://www.tiktok.com/@batelemi92?_r=1&_t=ZS-99cD47Jhd00";

const FACEBOOK_URL =
  process.env.FACEBOOK_URL ||
  "https://www.facebook.com/share/1L96SqLnZT/";

/* =========================================================
   ADMINISTRATION
========================================================= */

const ADMIN_PHONE =
  process.env.ADMIN_PHONE ||
  "";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "";

/* =========================================================
   SESSION
========================================================= */

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "sdrive-secret-change-this-in-render";

/* =========================================================
   EXPRESS
========================================================= */

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: false
  })
);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      sameSite: "lax",

      secure:
        process.env.NODE_ENV === "production",

      maxAge:
        7 * 24 * 60 * 60 * 1000
    }
  })
);

/* =========================================================
   DATABASE SQLITE
========================================================= */

const dbPath =
  path.join(
    __dirname,
    "sdrive.db"
  );

const db =
  new Database(dbPath);

db.pragma(
  "foreign_keys = ON"
);

/* =========================================================
   TABLES
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT UNIQUE,

    name TEXT NOT NULL,

    phone TEXT NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    badge TEXT NOT NULL
      DEFAULT 'Membre S-Drive',

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    odds_type INTEGER NOT NULL
      CHECK(odds_type IN (2, 10)),

    status TEXT NOT NULL
      DEFAULT 'payment_pending',

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_id INTEGER NOT NULL,

    status TEXT NOT NULL
      DEFAULT 'pending',

    admin_password_hash TEXT,

    created_at TEXT NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    resolved_at TEXT,

    FOREIGN KEY(user_id)
      REFERENCES users(id)
      ON DELETE CASCADE
  );
`);

/* =========================================================
   MIGRATION
========================================================= */

function columnExists(table, column) {

  const columns =
    db
      .prepare(
        `PRAGMA table_info(${table})`
      )
      .all();

  return columns.some(
    (columnInfo) =>
      columnInfo.name === column
  );
}

if (!columnExists("users", "username")) {

  try {

    db.exec(
      `ALTER TABLE users ADD COLUMN username TEXT`
    );

  } catch (error) {

    console.log(
      "Migration username:",
      error.message
    );

  }

}

/* =========================================================
   MIGRATION DES ANCIENS UTILISATEURS
========================================================= */

try {

  const oldUsers =
    db
      .prepare(`
        SELECT
          id,
          name,
          phone,
          username
        FROM users
        WHERE username IS NULL
           OR username = ''
      `)
      .all();

  for (const user of oldUsers) {

    let base =
      String(
        user.name ||
        "membre"
      )
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

    if (!base) {
      base = "membre";
    }

    let username = base;

    let number = 1;

    while (
      db
        .prepare(
          `SELECT id
           FROM users
           WHERE username = ?
           AND id != ?`
        )
        .get(
          username,
          user.id
        )
    ) {

      username =
        `${base}${number}`;

      number++;

    }

    db
      .prepare(
        `UPDATE users
         SET username = ?
         WHERE id = ?`
      )
      .run(
        username,
        user.id
      );

  }

} catch (error) {

  console.log(
    "Migration utilisateurs:",
    error.message
  );

}

/* =========================================================
   UTILITAIRES
========================================================= */

function normalizePhone(value) {

  let phone =
    String(value || "")
      .trim()
      .replace(
        /[^\d+]/g,
        ""
      );

  if (!phone) {
    return "";
  }

  if (
    phone.startsWith("+225")
  ) {

    return phone.substring(1);

  }

  if (
    phone.startsWith("225")
  ) {

    return phone;

  }

  if (
    phone.startsWith("0")
  ) {

    return (
      "225" +
      phone.substring(1)
    );

  }

  return phone;
}

/* =========================================================
   UTILISATEUR CONNECTÉ
========================================================= */

function getCurrentUser(req) {

  if (!req.session.userId) {
    return null;
  }

  return db
    .prepare(`
      SELECT
        id,
        username,
        name,
        phone,
        badge,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(
      req.session.userId
    );
}

/* =========================================================
   AUTHENTIFICATION
========================================================= */

function requireAuth(
  req,
  res,
  next
) {

  if (!req.session.userId) {

    return res
      .status(401)
      .json({

        success: false,

        error:
          "Connexion requise."

      });

  }

  next();
}

/* =========================================================
   ADMIN
========================================================= */

function isAdmin(req) {

  return Boolean(
    req.session.admin
  );
}

function requireAdmin(
  req,
  res,
  next
) {

  if (!isAdmin(req)) {

    return res
      .status(403)
      .json({

        success: false,

        error:
          "Accès administrateur requis."

      });

  }

  next();
}

/* =========================================================
   UTILITAIRES TEXTE
========================================================= */

function escapeHtml(value) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}

/* =========================================================
   LIEN WHATSAPP
========================================================= */

function whatsappLink(
  message
) {

  const number =
    String(
      WHATSAPP_NUMBER
    ).replace(
      /[^\d]/g,
      ""
    );

  if (!number) {
    return null;
  }

  return (
    "https://wa.me/" +
    number +
    "?text=" +
    encodeURIComponent(
      message
    )
  );

}

/* =========================================================
   PAGE PRINCIPALE
========================================================= */

app.get(
  "/",
  (req, res) => {

    const user =
      getCurrentUser(req);

    const loggedIn =
      Boolean(user);

    res.send(`<!DOCTYPE html>

<html lang="fr">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,
  initial-scale=1,
  maximum-scale=1,
  user-scalable=no"
>

<meta
  name="theme-color"
  content="#071A2D"
>

<title>
  S-Drive — Analyse des matchs
</title>

<style>

:root {

  --navy: #071A2D;
  --navy2: #0B223D;

  --card: #102B4C;
  --line: #23486B;

  --blue: #00BFFF;
  --green: #21C55D;

  --white: #FFFFFF;
  --muted: #AFC1D4;

  --red: #DC2626;

}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
}

body {

  margin: 0;

  min-height: 100vh;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  color:
    var(--white);

  background:
    radial-gradient(
      circle at top,
      #12385C 0%,
      var(--navy) 58%
    );

}

.container {

  width:
    min(
      calc(100% - 28px),
      520px
    );

  margin:
    auto;

  padding:
    18px 0 35px;

}

.center {
  text-align: center;
}

.logo {

  width: 100px;

  height: 100px;

  margin:
    15px auto 8px;

  display:
    flex;

  justify-content:
    center;

  align-items:
    center;

  border-radius:
    50%;

  font-size:
    64px;

  background:
    rgba(0,191,255,.10);

  border:
    1px solid
    rgba(0,191,255,.25);

}

h1 {

  margin:
    8px 0 5px;

  font-size:
    32px;

}

h2 {

  margin:
    0 0 16px;

  font-size:
    21px;

}

.muted {

  color:
    var(--muted);

  line-height:
    1.55;

}

.card {

  background:
    rgba(16,43,76,.96);

  border:
    1px solid
    var(--line);

  border-radius:
    20px;

  padding:
    20px;

  margin:
    15px 0;

  box-shadow:
    0 8px 25px
    rgba(0,0,0,.18);

}

input {

  width:
    100%;

  padding:
    15px;

  margin:
    7px 0;

  border-radius:
    12px;

  border:
    1px solid
    #3C5F7E;

  background:
    var(--navy2);

  color:
    var(--white);

  font-size:
    16px;

  outline:
    none;

}

input:focus {

  border-color:
    var(--blue);

}

.password-wrap {

  position:
    relative;

}

.password-wrap input {

  padding-right:
    50px;

}

.eye {

  position:
    absolute;

  right:
    8px;

  top:
    7px;

  height:
    46px;

  width:
    42px;

  border:
    0;

  background:
    transparent;

  color:
    white;

  font-size:
    20px;

  cursor:
    pointer;

}

.btn {

  width:
    100%;

  min-height:
    52px;

  padding:
    14px;

  border-radius:
    14px;

  font-weight:
    800;

  font-size:
    15px;

  border:
    0;

  margin:
    8px 0;

  cursor:
    pointer;

  text-decoration:
    none;

  display:
    flex;

  justify-content:
    center;

  align-items:
    center;

  text-align:
    center;

}

.btn:active {

  transform:
    scale(.98);

}

.btn:disabled {

  opacity:
    .65;

  cursor:
    wait;

}

.primary {

  background:
    var(--blue);

  color:
    #001B2D;

}

.green {

  background:
    var(--green);

  color:
    white;

}

.secondary {

  background:
    #193A5C;

  color:
    white;

  border:
    1px solid
    #315D82;

}

.danger {

  background:
    #7F1D1D;

  color:
    white;

}

.choice {

  border:
    1px solid
    #315D82;

  background:
    #0B223D;

  padding:
    17px;

  border-radius:
    15px;

  margin:
    9px 0;

  cursor:
    pointer;

  transition:
    .15s;

}

.choice strong {

  display:
    block;

  font-size:
    18px;

  margin-bottom:
    6px;

}

.choice small {

  color:
    var(--muted);

  line-height:
    1.4;

}

.choice.selected {

  border-color:
    var(--blue);

  background:
    #123B60;

  transform:
    scale(1.01);

}

.price {

  font-size:
    28px;

  font-weight:
    900;

  text-align:
    center;

  margin:
    17px 0;

}

.notice {

  padding:
    14px;

  border-left:
    3px solid
    var(--blue);

  background:
    #0C2745;

  border-radius:
    8px;

  line-height:
    1.55;

  margin:
    10px 0;

}

.status {

  margin-top:
    12px;

  color:
    var(--muted);

  text-align:
    center;

  min-height:
    24px;

  line-height:
    1.4;

}

.status.success {

  color:
    #6EE7A0;

}

.status.error {

  color:
    #FF8A8A;

}

.user-box {

  background:
    rgba(7,26,45,.65);

  border:
    1px solid
    var(--line);

  padding:
    14px;

  border-radius:
    14px;

  margin-bottom:
    15px;

  text-align:
    center;

}

.badge {

  display:
    inline-flex;

  align-items:
    center;

  gap:
    5px;

  padding:
    6px 10px;

  border-radius:
    999px;

  background:
    #123B60;

  border:
    1px solid
    var(--blue);

  font-size:
    12px;

  font-weight:
    800;

}

.bookmaker {

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    10px;

  padding:
    14px;

  margin:
    9px 0;

  border-radius:
    14px;

  background:
    #0B223D;

  border:
    1px solid
    #315D82;

}

.bookmaker-info {

  display:
    flex;

  align-items:
    center;

  gap:
    10px;

}

.bookmaker-icon {

  width:
    42px;

  height:
    42px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  border-radius:
    12px;

  background:
    #193A5C;

  font-size:
    21px;

}

.bookmaker-name {

  font-weight:
    900;

}

.bookmaker-button {

  width:
    auto;

  min-width:
    105px;

  margin:
    0;

  padding:
    11px 13px;

  min-height:
    44px;

}

.share-box {

  display:
    grid;

  grid-template-columns:
    1fr 1fr;

  gap:
    8px;

}

.hidden {

  display:
    none !important;

}

footer {

  text-align:
    center;

  color:
    var(--muted);

  font-size:
    12px;

  margin-top:
    25px;

}

@media(max-width:360px) {

  .container {

    width:
      calc(100% - 20px);

  }

  h1 {

    font-size:
      28px;

  }

  .card {

    padding:
      16px;

  }

  .bookmaker {

    flex-direction:
      column;

    align-items:
      stretch;

  }

  .bookmaker-button {

    width:
      100%;

  }

}

</style>

</head>

<body>

<main class="container">

<section
  id="auth"
  class="${loggedIn ? "hidden" : ""}"
>

  <div class="center">

    <div class="logo">
      ⚽
    </div>

    <h1>
      S-Drive
    </h1>

    <p class="muted">
      Analyse professionnelle de vos matchs
    </p>

  </div>

  <div class="card">

    <h2>
      Connexion
    </h2>

    <input
      id="loginPhone"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      placeholder="Numéro de téléphone WhatsApp"
    >

    <div class="password-wrap">

      <input
        id="loginPassword"
        type="password"
        autocomplete="current-password"
        placeholder="Mot de passe"
      >

      <button
        class="eye"
        type="button"
        onclick="togglePassword('loginPassword', this)"
      >
        👁
      </button>

    </div>

    <button
      id="loginButton"
      class="btn primary"
      type="button"
      onclick="login()"
    >
      Se connecter
    </button>

    <button
      class="btn secondary"
      type="button"
      onclick="forgotPassword()"
    >
      🔑 Mot de passe oublié ?
    </button>

    <div
      id="loginStatus"
      class="status"
    ></div>

  </div>

  <div class="card">

    <h2>
      Créer un compte
    </h2>

    <input
      id="registerName"
      type="text"
      autocomplete="name"
      placeholder="Nom d'utilisateur"
    >

    <input
      id="registerPhone"
      type="tel"
      inputmode="tel"
      autocomplete="tel"
      placeholder="Numéro de téléphone WhatsApp"
    >

    <div class="password-wrap">

      <input
        id="registerPassword"
        type="password"
        autocomplete="new-password"
        placeholder="Mot de passe — 6 caractères minimum"
      >

      <button
        class="eye"
        type="button"
        onclick="togglePassword('registerPassword', this)"
      >
        👁
      </button>

    </div>

    <div class="password-wrap">

      <input
        id="registerPassword2"
        type="password"
        autocomplete="new-password"
        placeholder="Confirmer le mot de passe"
      >

      <button
        class="eye"
        type="button"
        onclick="togglePassword('registerPassword2', this)"
      >
        👁
      </button>

    </div>

    <button
      id="registerButton"
      class="btn primary"
      type="button"
      onclick="register()"
    >
      Créer mon compte
    </button>

    <div
      id="registerStatus"
      class="status"
    ></div>

  </div>

</section>

<section
  id="dashboard"
  class="${loggedIn ? "" : "hidden"}"
>

  <div class="center">

    <div class="logo">
      ⚽
    </div>

    <h1>
      S-Drive
    </h1>

    <p
      id="welcomeText"
      class="muted"
    >
      Bienvenue ${user ? escapeHtml(user.name) : ""}
    </p>

    ${
      user
        ? "<span class=\"badge\">🏅 " +
          escapeHtml(user.badge) +
          "</span>"
        : ""
    }

  </div>

  <div
    id="userBox"
    class="user-box"
  >

    👤 Compte connecté

    <br>

    <span class="muted">
      ${user ? escapeHtml(user.phone) : ""}
    </span>

  </div>

  <div class="card">

    <h2>
      Analyse des matchs
    </h2>

    <div class="notice">

      Choisissez le type d'analyse
      que vous souhaitez.

    </div>

    <div
      id="choice2"
      class="choice selected"
      onclick="selectOdds(2)"
    >

      <strong>
        Cote 2
      </strong>

      <small>
        Analyse rapide —
        environ 2 à 3 minutes
      </small>

    </div>

    <div
      id="choice10"
      class="choice"
      onclick="selectOdds(10)"
    >

      <strong>
        Cote 10
      </strong>

      <small>
        Analyse complète —
        environ 7 à 8 minutes
      </small>

    </div>

    <div class="price">
      1 000 F
    </div>

    <p class="muted center">
      Paiement unique pour l'analyse.
    </p>

    <a
      class="btn green"
      href="${WAVE_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      💳 Payer 1 000 F avec Wave
    </a>

    <button
      class="btn primary"
      type="button"
      onclick="sendMatchScreenshot()"
    >
      📸 Envoyer la capture des matchs
    </button>

    <div
      id="analysisStatus"
      class="status"
    ></div>

  </div>

  <div class="card">

    <h2>
      📲 Envoyer votre capture
    </h2>

    <p class="muted">
      Après votre paiement,
      envoyez la capture de vos matchs
      à S-Drive pour l'analyse.
    </p>

    <a
      class="btn primary"
      href="${whatsappLink(
        WHATSAPP_MESSAGE
      ) || "#"}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🟢 Ouvrir WhatsApp
    </a>

    <a
      class="btn secondary"
      href="${TELEGRAM_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🔵 Ouvrir Telegram
    </a>

  </div>

  <div class="card">

    <h2>
      🎯 Nos bookmakers
    </h2>

    <p class="muted">
      Retrouvez les plateformes partenaires
      de S-Drive.
    </p>

    <div class="bookmaker">

      <div class="bookmaker-info">

        <div class="bookmaker-icon">
          🎰
        </div>

        <div>

          <div class="bookmaker-name">
            1win
          </div>

          <small class="muted">
            Pari sportif
          </small>

        </div>

      </div>

      <a
        class="btn green bookmaker-button"
        href="${WIN1_URL}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ouvrir
      </a>

    </div>

    <div class="bookmaker">

      <div class="bookmaker-info">

        <div class="bookmaker-icon">
          🎯
        </div>

        <div>

          <div class="bookmaker-name">
            Paripesa
          </div>

          <small class="muted">
            Pari sportif
          </small>

        </div>

      </div>

      <a
        class="btn green bookmaker-button"
        href="${PARIPESA_URL}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ouvrir
      </a>

    </div>

    <div class="bookmaker">

      <div class="bookmaker-info">

        <div class="bookmaker-icon">
          🎟️
        </div>

        <div>

          <div class="bookmaker-name">
            Loto
          </div>

          <small class="muted">
            Jeux et pronostics
          </small>

        </div>

      </div>

      <a
        class="btn green bookmaker-button"
        href="${LOTO_URL}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ouvrir
      </a>

    </div>

  </div>

  <div class="card">

    <h2>
      👥 Communauté S-Drive
    </h2>

    <p class="muted">
      Rejoignez nos communautés
      pour recevoir les informations
      et échanger avec les autres membres.
    </p>

    <a
      class="btn primary"
      href="${WHATSAPP_GROUP_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🟢 Groupe WhatsApp
    </a>

    <a
      class="btn secondary"
      href="${TELEGRAM_GROUP_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🔵 Groupe Telegram
    </a>

  </div>

  <div class="card">

    <h2>
      📱 Suivez S-Drive
    </h2>

    <a
      class="btn secondary"
      href="${TIKTOK_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      🎵 TikTok
    </a>

    <a
      class="btn secondary"
      href="${FACEBOOK_URL}"
      target="_blank"
      rel="noopener noreferrer"
    >
      📘 Facebook
    </a>

  </div>

  <div class="card">

    <h2>
      Partager S-Drive
    </h2>

    <p class="muted">
      Invitez vos amis à découvrir S-Drive.
    </p>

    <div class="share-box">

      <button
        class="btn secondary"
        type="button"
        onclick="copyAppLink()"
      >
        📋 Copier le lien
      </button>

      <button
        class="btn secondary"
        type="button"
        onclick="shareApp()"
      >
        📤 Partager
      </button>

    </div>

    <div
      id="shareStatus"
      class="status"
    ></div>

  </div>

  <div class="card">

    <h2>
      Conditions d'utilisation
    </h2>

    <div class="notice">

      <strong>
        Cote 2
      </strong>

      <br><br>

      Après paiement et réception
      de votre capture, S-Drive analyse
      vos matchs de cote 2.

      <br><br>

      Délai indicatif :
      <strong>
        2 à 3 minutes
      </strong>.

      <br><br>

      Si le coupon de cote 2 analysé
      et envoyé par S-Drive est validé
      après votre pari, aucun montant
      supplémentaire ne sera demandé.

      <br><br>

      Si le coupon de cote 2 n'est pas
      validé, vous pouvez réclamer
      un remboursement de
      <strong>
        500 F
      </strong>.

    </div>

    <div class="notice">

      <strong>
        Cote 10
      </strong>

      <br><br>

      Délai indicatif :
      <strong>
        7 à 8 minutes
      </strong>.

      <br><br>

      Pour une analyse de cote 10,
      aucun remboursement n'est prévu
      après le gain ou la perte du pari.

    </div>

    <p class="muted">

      Le paiement de l'analyse est de
      <strong>
        1 000 F
      </strong>.

    </p>

  </div>

  <button
    class="btn danger"
    type="button"
    onclick="logout()"
  >
    Se déconnecter
  </button>

</section>

<section
  id="admin"
  class="hidden"
>

  <div class="center">

    <div class="logo">
      🛠️
    </div>

    <h1>
      Administration
    </h1>

    <p class="muted">
      Gestion S-Drive
    </p>

  </div>

  <div class="card">

    <h2>
      Connexion administrateur
    </h2>

    <input
      id="adminPhone"
      type="tel"
      placeholder="Téléphone administrateur"
    >

    <input
      id="adminPassword"
      type="password"
      placeholder="Mot de passe administrateur"
    >

    <button
      class="btn primary"
      type="button"
      onclick="adminLogin()"
    >
      Accéder
    </button>

    <div
      id="adminLoginStatus"
      class="status"
    ></div>

  </div>

  <div class="card">

    <h2>
      Clients inscrits
    </h2>

    <div
      id="adminStats"
      class="notice"
    >
      Chargement...
    </div>

    <div
      id="usersList"
    ></div>

  </div>

  <div class="card">

    <h2>
      Demandes de mot de passe
    </h2>

    <div
      id="resetList"
    >
      Chargement...
    </div>

  </div>

  <button
    class="btn danger"
    type="button"
    onclick="adminLogout()"
  >
    Quitter l'administration
  </button>

</section>

<footer>
  S-Drive — Analyse des matchs
</footer>

</main>

<script>

let selectedOdds = 2;

/* =====================================================
   STATUS
===================================================== */

function showStatus(
  id,
  message,
  type = ""
) {

  const element =
    document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    "status " + type;
}

/* =====================================================
   CHARGEMENT BOUTON
===================================================== */

function setLoading(
  id,
  loading,
  text
) {

  const button =
    document.getElementById(id);

  if (!button) {
    return;
  }

  button.disabled =
    loading;

  button.textContent =
    loading
      ? "Patientez..."
      : text;
}

/* =====================================================
   MOT DE PASSE
===================================================== */

function togglePassword(
  id,
  button
) {

  const input =
    document.getElementById(id);

  if (!input) {
    return;
  }

  if (
    input.type === "password"
  ) {

    input.type = "text";

    button.textContent =
      "🙈";

  } else {

    input.type = "password";

    button.textContent =
      "👁";

  }

}

/* =====================================================
   CHOIX COTE
===================================================== */

function selectOdds(type) {

  if (
    type !== 2 &&
    type !== 10
  ) {
    return;
  }

  selectedOdds =
    type;

  document
    .getElementById("choice2")
    .classList
    .toggle(
      "selected",
      type === 2
    );

  document
    .getElementById("choice10")
    .classList
    .toggle(
      "selected",
      type === 10
    );

}

/* =====================================================
   DASHBOARD
===================================================== */

function showDashboard(
  user
) {

  document
    .getElementById("auth")
    .classList
    .add("hidden");

  document
    .getElementById("dashboard")
    .classList
    .remove("hidden");

  if (user) {

    const welcome =
      document.getElementById(
        "welcomeText"
      );

    if (welcome) {

      welcome.textContent =
        "Bienvenue " +
        user.name;

    }

    const userBox =
      document.getElementById(
        "userBox"
      );

    if (userBox) {

      userBox.innerHTML =
        "👤 <strong>" +
        escapeHtml(user.name) +
        "</strong><br>" +

        "<span class=\"muted\">" +
        escapeHtml(user.phone) +
        "</span><br>" +

        "🏅 <strong>" +
        escapeHtml(
          user.badge ||
          "Membre S-Drive"
        ) +
        "</strong>";

    }

  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}

/* =====================================================
   INSCRIPTION
===================================================== */

async function register() {

  const name =
    document
      .getElementById(
        "registerName"
      )
      .value
      .trim();

  const phone =
    document
      .getElementById(
        "registerPhone"
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        "registerPassword"
      )
      .value;

  const password2 =
    document
      .getElementById(
        "registerPassword2"
      )
      .value;

  showStatus(
    "registerStatus",
    ""
  );

  if (!name) {

    return showStatus(
      "registerStatus",
      "Veuillez entrer votre nom d’utilisateur.",
      "error"
    );

  }

  if (!phone) {

    return showStatus(
      "registerStatus",
      "Veuillez entrer votre numéro WhatsApp.",
      "error"
    );

  }

  if (
    password.length < 6
  ) {

    return showStatus(
      "registerStatus",
      "Le mot de passe doit contenir au moins 6 caractères.",
      "error"
    );

  }

  if (
    password !== password2
  ) {

    return showStatus(
      "registerStatus",
      "Les deux mots de passe ne correspondent pas.",
      "error"
    );

  }

  setLoading(
    "registerButton",
    true,
    "Créer mon compte"
  );

  try {

    const response =
      await fetch(
        "/api/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              name,
              phone,
              password
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      showStatus(
        "registerStatus",
        data.error ||
          "Erreur lors de l'inscription.",
        "error"
      );

      return;

    }

    showStatus(
      "registerStatus",
      "Compte créé avec succès 🏅",
      "success"
    );

    setTimeout(
      () => {
        location.reload();
      },
      500
    );

  } catch (error) {

    console.error(error);

    showStatus(
      "registerStatus",
      "Impossible de contacter le serveur.",
      "error"
    );

  }

  setLoading(
    "registerButton",
    false,
    "Créer mon compte"
  );

}

/* =====================================================
   CONNEXION
===================================================== */

async function login() {

  const phone =
    document
      .getElementById(
        "loginPhone"
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        "loginPassword"
      )
      .value;

  showStatus(
    "loginStatus",
    ""
  );

  if (
    !phone ||
    !password
  ) {

    return showStatus(
      "loginStatus",
      "Veuillez remplir tous les champs.",
      "error"
    );

  }

  setLoading(
    "loginButton",
    true,
    "Se connecter"
  );

  try {

    const response =
      await fetch(
        "/api/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              phone,
              password
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      showStatus(
        "loginStatus",
        data.error ||
          "Numéro ou mot de passe incorrect.",
        "error"
      );

      return;

    }

    showStatus(
      "loginStatus",
      "Connexion réussie.",
      "success"
    );

    setTimeout(
      () => {
        location.reload();
      },
      300
    );

  } catch (error) {

    console.error(error);

    showStatus(
      "loginStatus",
      "Impossible de contacter le serveur.",
      "error"
    );

  }

  setLoading(
    "loginButton",
    false,
    "Se connecter"
  );

}

/* =====================================================
   MOT DE PASSE OUBLIÉ
===================================================== */

async function forgotPassword() {

  const phone =
    document
      .getElementById(
        "loginPhone"
      )
      .value
      .trim();

  if (!phone) {

    return showStatus(
      "loginStatus",
      "Entrez d’abord votre numéro WhatsApp.",
      "error"
    );

  }

  try {

    const response =
      await fetch(
        "/api/forgot-password",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              phone
            })
        }
      );

    const data =
      await response
        .json();

    showStatus(
      "loginStatus",
      data.message ||
        data.error ||
        "Demande envoyée.",
      "success"
    );

    if (
      data.whatsapp_url
    ) {

      window.open(
        data.whatsapp_url,
        "_blank"
      );

    }

  } catch (error) {

    showStatus(
      "loginStatus",
      "Impossible d’envoyer la demande.",
      "error"
    );

  }

}

/* =====================================================
   CRÉER UNE ANALYSE
===================================================== */

async function sendMatchScreenshot() {

  const status =
    document.getElementById(
      "analysisStatus"
    );

  status.textContent =
    "Préparation de votre demande...";

  try {

    const response =
      await fetch(
        "/api/create-analysis",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              odds_type:
                selectedOdds
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      status.textContent =
        data.error ||
        "Impossible de créer la demande.";

      status.className =
        "status error";

      return;

    }

    status.textContent =
      "Demande créée. Envoyez maintenant votre capture sur WhatsApp ou Telegram.";

    status.className =
      "status success";

    if (
      data.whatsapp_url
    ) {

      window.open(
        data.whatsapp_url,
        "_blank"
      );

    }

  } catch (error) {

    console.error(error);

    status.textContent =
      "Erreur de connexion au serveur.";

    status.className =
      "status error";

  }

}

/* =====================================================
   COPIER LE LIEN
===================================================== */

async function copyAppLink() {

  try {

    await navigator.clipboard
      .writeText(
        window.location.origin
      );

    showStatus(
      "shareStatus",
      "Lien copié avec succès.",
      "success"
    );

  } catch (error) {

    showStatus(
      "shareStatus",
      "Impossible de copier le lien.",
      "error"
    );

  }

}

/* =====================================================
   PARTAGER
===================================================== */

async function shareApp() {

  const shareData = {

    title:
      "S-Drive",

    text:
      "Découvrez S-Drive — Analyse professionnelle de vos matchs.",

    url:
      window.location.origin

  };

  try {

    if (
      navigator.share
    ) {

      await navigator.share(
        shareData
      );

    } else {

      await copyAppLink();

    }

  } catch (error) {

    // Annulation du partage

  }

}

/* =====================================================
   DÉCONNEXION
===================================================== */

async function logout() {

  try {

    await fetch(
      "/api/logout",
      {
        method: "POST",
        credentials: "same-origin"
      }
    );

  } catch (error) {}

  location.reload();

}

/* =====================================================
   ADMIN LOGIN
===================================================== */

async function adminLogin() {

  const phone =
    document
      .getElementById(
        "adminPhone"
      )
      .value
      .trim();

  const password =
    document
      .getElementById(
        "adminPassword"
      )
      .value;

  if (
    !phone ||
    !password
  ) {

    return showStatus(
      "adminLoginStatus",
      "Remplissez tous les champs.",
      "error"
    );

  }

  try {

    const response =
      await fetch(
        "/api/admin/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          credentials:
            "same-origin",

          body:
            JSON.stringify({
              phone,
              password
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      return showStatus(
        "adminLoginStatus",
        data.error ||
          "Accès refusé.",
        "error"
      );

    }

    loadAdmin();

  } catch (error) {

    showStatus(
      "adminLoginStatus",
      "Erreur serveur.",
      "error"
    );

  }

}

/* =====================================================
   CHARGER ADMIN
===================================================== */

async function loadAdmin() {

  document
    .getElementById(
      "auth"
    )
    .classList
    .add("hidden");

  document
    .getElementById(
      "dashboard"
    )
    .classList
    .add("hidden");

  document
    .getElementById(
      "admin"
    )
    .classList
    .remove("hidden");

  try {

    const response =
      await fetch(
        "/api/admin/users",
        {
          credentials:
            "same-origin"
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      return;
    }

    document
      .getElementById(
        "adminStats"
      )
      .textContent =
      "Nombre total de clients : " +
      data.users.length;

    /*
      CORRECTION IMPORTANTE :
      On n'utilise plus de backticks ici.
      Cela évite de casser le template literal
      principal de res.send().
    */

    document
      .getElementById(
        "usersList"
      )
      .innerHTML =
      data.users
        .map(function(user) {

          return (
            "<div class=\"notice\">" +

              "<strong>" +
                escapeHtml(user.name) +
              "</strong>" +

              "<br>" +

              escapeHtml(user.phone) +

              "<br><br>" +

              "<span class=\"badge\">" +
                "🏅 " +
                escapeHtml(
                  user.badge
                ) +
              "</span>" +

            "</div>"
          );

        })
        .join("") ||
      '<p class="muted">Aucun client.</p>';

    const resetResponse =
      await fetch(
        "/api/admin/reset-requests",
        {
          credentials:
            "same-origin"
        }
      );

    const resetData =
      await resetResponse.json();

    /*
      CORRECTION IMPORTANTE :
      Suppression du template literal imbriqué.
    */

    document
      .getElementById(
        "resetList"
      )
      .innerHTML =
      resetData.requests
        .map(function(request) {

          return (
            "<div class=\"notice\">" +

              "<strong>" +
                escapeHtml(
                  request.name
                ) +
              "</strong>" +

              "<br>" +

              escapeHtml(
                request.phone
              ) +

              "<br>" +

              "<button " +
                "class=\"btn green\" " +
                "onclick=\"resolveReset(" +
                  request.id +
                ")\"" +
              ">" +

                "Envoyer une réinitialisation" +

              "</button>" +

            "</div>"
          );

        })
        .join("") ||
      '<p class="muted">Aucune demande en attente.</p>';

  } catch (error) {

    console.error(
      "ADMIN:",
      error
    );

  }

}

/* =====================================================
   RÉINITIALISATION ADMIN
===================================================== */

async function resolveReset(id) {

  try {

    const response =
      await fetch(
        "/api/admin/reset/" +
          id,
        {
          method: "POST",

          credentials:
            "same-origin"
        }
      );

    const data =
      await response.json();

    alert(
      data.message ||
      data.error ||
      "Opération terminée."
    );

    loadAdmin();

  } catch (error) {

    alert(
      "Impossible de traiter la demande."
    );

  }

}

/* =====================================================
   ADMIN LOGOUT
===================================================== */

async function adminLogout() {

  try {

    await fetch(
      "/api/admin/logout",
      {
        method: "POST",
        credentials: "same-origin"
      }
    );

  } catch (error) {}

  location.reload();

}

/* =====================================================
   OUVRIR ADMIN
===================================================== */

function openAdmin() {

  document
    .getElementById(
      "auth"
    )
    .classList
    .add("hidden");

  document
    .getElementById(
      "dashboard"
    )
    .classList
    .add("hidden");

  document
    .getElementById(
      "admin"
    )
    .classList
    .remove("hidden");

}

/* =====================================================
   SESSION
===================================================== */

async function checkSession() {

  try {

    const response =
      await fetch(
        "/api/me",
        {
          credentials:
            "same-origin"
        }
      );

    if (
      response.ok
    ) {

      const data =
        await response.json();

      if (
        data.success &&
        data.user
      ) {

        showDashboard(
          data.user
        );

      }

    }

  } catch (error) {

    console.error(
      "SESSION:",
      error
    );

  }

}

/* =====================================================
   INITIALISATION
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkSession();

  }
);

</script>

</body>

</html>`);

});

/* =========================================================
   API — INSCRIPTION
========================================================= */

app.post(
  "/api/register",
  async (req, res) => {

    try {

      const name =
        String(
          req.body.name || ""
        ).trim();

      const phone =
        normalizePhone(
          req.body.phone
        );

      const password =
        String(
          req.body.password || ""
        );

      if (!name) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Veuillez entrer votre nom d’utilisateur."

          });

      }

      if (!phone) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Veuillez entrer votre numéro WhatsApp."

          });

      }

      if (
        password.length < 6
      ) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Le mot de passe doit contenir au moins 6 caractères."

          });

      }

      const existing =
        db
          .prepare(
            "SELECT id FROM users WHERE phone = ?"
          )
          .get(phone);

      if (existing) {

        return res
          .status(409)
          .json({

            success: false,

            error:
              "Ce numéro est déjà enregistré. Connectez-vous."

          });

      }

      const hash =
        await bcrypt.hash(
          password,
          10
        );

      const result =
        db
          .prepare(`
            INSERT INTO users
              (name, phone, password_hash, badge)
            VALUES
              (?, ?, ?, ?)
          `)
          .run(
            name,
            phone,
            hash,
            "Membre S-Drive"
          );

      req.session.userId =
        Number(
          result.lastInsertRowid
        );

      res
        .status(201)
        .json({

          success: true,

          message:
            "Compte créé avec succès.",

          user: {

            id:
              Number(
                result.lastInsertRowid
              ),

            name,

            phone,

            badge:
              "Membre S-Drive"

          }

        });

    } catch (error) {

      console.error(
        "ERREUR REGISTER:",
        error
      );

      res
        .status(500)
        .json({

          success: false,

          error:
            "Erreur serveur lors de la création du compte."

        });

    }

  }
);

/* =========================================================
   API — CONNEXION
========================================================= */

app.post(
  "/api/login",
  async (req, res) => {

    try {

      const phone =
        normalizePhone(
          req.body.phone
        );

      const password =
        String(
          req.body.password || ""
        );

      if (
        !phone ||
        !password
      ) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Veuillez remplir tous les champs."

          });

      }

      const user =
        db
          .prepare(`
            SELECT
              id,
              username,
              name,
              phone,
              password_hash,
              badge,
              created_at
            FROM users
            WHERE phone = ?
          `)
          .get(phone);

      if (!user) {

        return res
          .status(401)
          .json({

            success: false,

            error:
              "Numéro ou mot de passe incorrect."

          });

      }

      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!valid) {

        return res
          .status(401)
          .json({

            success: false,

            error:
              "Numéro ou mot de passe incorrect."

          });

      }

      req.session.userId =
        user.id;

      res.json({

        success: true,

        message:
          "Connexion réussie.",

        user: {

          id:
            user.id,

          username:
            user.username,

          name:
            user.name,

          phone:
            user.phone,

          badge:
            user.badge

        }

      });

    } catch (error) {

      console.error(
        "ERREUR LOGIN:",
        error
      );

      res
        .status(500)
        .json({

          success: false,

          error:
            "Erreur serveur."

        });

    }

  }
);

/* =========================================================
   API — UTILISATEUR CONNECTÉ
========================================================= */

app.get(
  "/api/me",
  (req, res) => {

    const user =
      getCurrentUser(req);

    if (!user) {

      return res
        .status(401)
        .json({

          success: false,

          error:
            "Utilisateur non connecté."

        });

    }

    res.json({

      success: true,

      user

    });

  }
);

/* =========================================================
   API — DÉCONNEXION
========================================================= */

app.post(
  "/api/logout",
  (req, res) => {

    req.session.destroy(
      (error) => {

        if (error) {

          return res
            .status(500)
            .json({

              success: false,

              error:
                "Impossible de se déconnecter."

            });

        }

        res.json({

          success: true

        });

      }
    );

  }
);

/* =========================================================
   API — MOT DE PASSE OUBLIÉ
========================================================= */

app.post(
  "/api/forgot-password",
  (req, res) => {

    try {

      const phone =
        normalizePhone(
          req.body.phone
        );

      if (!phone) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Entrez votre numéro WhatsApp."

          });

      }

      const user =
        db
          .prepare(`
            SELECT
              id,
              name,
              phone
            FROM users
            WHERE phone = ?
          `)
          .get(phone);

      if (!user) {

        return res.json({

          success: true,

          message:
            "Si ce numéro existe, une demande de réinitialisation a été enregistrée."

        });

      }

      db
        .prepare(`
          INSERT INTO password_resets
            (user_id, status)
          VALUES
            (?, 'pending')
        `)
        .run(
          user.id
        );

      const message =
        "Bonjour S-Drive 👋\n\n" +
        "Je demande une réinitialisation de mon mot de passe.\n\n" +
        "Nom : " +
        user.name +
        "\n" +
        "Téléphone : " +
        user.phone +
        "\n\n" +
        "Merci.";

      res.json({

        success: true,

        message:
          "Votre demande a été enregistrée. Contactez l’administrateur pour réinitialiser votre mot de passe.",

        whatsapp_url:
          whatsappLink(message)

      });

    } catch (error) {

      console.error(
        "ERREUR FORGOT:",
        error
      );

      res
        .status(500)
        .json({

          success: false,

          error:
            "Impossible d’enregistrer la demande."

        });

    }

  }
);

/* =========================================================
   API — CRÉER UNE ANALYSE
========================================================= */

app.post(
  "/api/create-analysis",
  requireAuth,
  (req, res) => {

    try {

      const oddsType =
        Number(
          req.body.odds_type
        );

      if (
        oddsType !== 2 &&
        oddsType !== 10
      ) {

        return res
          .status(400)
          .json({

            success: false,

            error:
              "Type d’analyse incorrect."

          });

      }

      const user =
        getCurrentUser(req);

      if (!user) {

        return res
          .status(401)
          .json({

            success: false,

            error:
              "Session expirée."

          });

      }

      const result =
        db
          .prepare(`
            INSERT INTO analyses
              (user_id, odds_type, status)
            VALUES
              (?, ?, 'payment_pending')
          `)
          .run(
            user.id,
            oddsType
          );

      const message = [
        "Bonjour S-Drive 👋",
        "",
        "Je viens de créer une demande d’analyse.",
        "",
        "Client : " +
          user.name,
        "Téléphone : " +
          user.phone,
        "Type : Cote " +
          oddsType,
        "Référence : SD-" +
          result.lastInsertRowid,
        "",
        "Je vais envoyer la capture de mes matchs."
      ].join("\n");

      res
        .status(201)
        .json({

          success: true,

          message:
            "Demande créée avec succès.",

          analysis_id:
            Number(
              result.lastInsertRowid
            ),

          whatsapp_url:
            whatsappLink(message)

        });

    } catch (error) {

      console.error(
        "ERREUR ANALYSE:",
        error
      );

      res
        .status(500)
        .json({

          success: false,

          error:
            "Impossible de créer la demande."

        });

    }

  }
);

/* =========================================================
   API — ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  (req, res) => {

    const phone =
      normalizePhone(
        req.body.phone
      );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !ADMIN_PHONE ||
      !ADMIN_PASSWORD
    ) {

      return res
        .status(503)
        .json({

          success: false,

          error:
            "Configurez ADMIN_PHONE et ADMIN_PASSWORD dans Render."

        });

    }

    if (
      phone !==
        normalizePhone(
          ADMIN_PHONE
        ) ||
      password !==
        ADMIN_PASSWORD
    ) {

      return res
        .status(401)
        .json({

          success: false,

          error:
            "Identifiants administrateur incorrects."

        });

    }

    req.session.admin =
      true;

    res.json({

      success: true

    });

  }
);

/* =========================================================
   API — ADMIN LOGOUT
========================================================= */

app.post(
  "/api/admin/logout",
  (req, res) => {

    req.session.admin =
      false;

    res.json({

      success: true

    });

  }
);

/* =========================================================
   API — LISTE CLIENTS
========================================================= */

app.get(
  "/api/admin/users",
  requireAdmin,
  (req, res) => {

    const users =
      db
        .prepare(`
          SELECT
            id,
            username,
            name,
            phone,
            badge,
            created_at
          FROM users
          ORDER BY id DESC
        `)
        .all();

    res.json({

      success: true,

      users

    });

  }
);

/* =========================================================
   API — DEMANDES DE RESET
========================================================= */

app.get(
  "/api/admin/reset-requests",
  requireAdmin,
  (req, res) => {

    const requests =
      db
        .prepare(`
          SELECT
            pr.id,
            pr.user_id,
            u.name,
            u.phone,
            pr.created_at
          FROM password_resets pr
          JOIN users u
            ON u.id = pr.user_id
          WHERE pr.status = 'pending'
          ORDER BY pr.id DESC
        `)
        .all();

    res.json({

      success: true,

      requests

    });

  }
);

/* =========================================================
   API — RÉINITIALISATION MOT DE PASSE
========================================================= */

app.post(
  "/api/admin/reset/:id",
  requireAdmin,
  (req, res) => {

    try {

      const request =
        db
          .prepare(`
            SELECT
              pr.id,
              pr.user_id,
              u.name,
              u.phone
            FROM password_resets pr
            JOIN users u
              ON u.id = pr.user_id
            WHERE pr.id = ?
              AND pr.status = 'pending'
          `)
          .get(
            req.params.id
          );

      if (!request) {

        return res
          .status(404)
          .json({

            success: false,

            error:
              "Demande introuvable."

          });

      }

      const temporaryPassword =
        "SD-" +
        Math.random()
          .toString(36)
          .slice(2, 8)
          .toUpperCase();

      const hash =
        bcrypt.hashSync(
          temporaryPassword,
          10
        );

      db
        .prepare(`
          UPDATE users
          SET password_hash = ?
          WHERE id = ?
        `)
        .run(
          hash,
          request.user_id
        );

      db
        .prepare(`
          UPDATE password_resets
          SET
            status = 'resolved',
            admin_password_hash = ?,
            resolved_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          hash,
          request.id
        );

      const message =
        "Bonjour " +
        request.name +
        ", votre mot de passe temporaire S-Drive est : " +
        temporaryPassword +
        ". Connectez-vous puis modifiez-le si vous le souhaitez.";

      const whatsapp =
        whatsappLink(
          message
        );

      res.json({

        success: true,

        message:
          "Réinitialisation créée. " +
          (
            whatsapp
              ? "Le bouton WhatsApp peut être utilisé pour transmettre le nouveau mot de passe."
              : "Configurez WHATSAPP_NUMBER dans Render."
          ),

        temporary_password:
          temporaryPassword,

        whatsapp_url:
          whatsapp

      });

    } catch (error) {

      console.error(
        "ERREUR RESET:",
        error
      );

      res
        .status(500)
        .json({

          success: false,

          error:
            "Impossible de réinitialiser le mot de passe."

        });

    }

  }
);

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      message:
        "S-Drive fonctionne correctement.",

      time:
        new Date().toISOString()

    });

  }
);

/* =========================================================
   ROUTES INCONNUES
========================================================= */

app.use(
  (req, res) => {

    if (
      req.path.startsWith("/api/")
    ) {

      return res
        .status(404)
        .json({

          success: false,

          error:
            "Route API introuvable."

        });

    }

    res
      .status(404)
      .send(
        "Page introuvable."
      );

  }
);

/* =========================================================
   DÉMARRAGE
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `S-Drive démarré sur le port ${PORT}`
    );

  }
);

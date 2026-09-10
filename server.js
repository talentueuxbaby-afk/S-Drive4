const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

/* =========================
   CONFIGURATION
========================= */

const WAVE_URL =
  process.env.WAVE_URL ||
  "https://pay.wave.com/m/M_ci_kpNTVGT9JGah/c/ci/?amount=1000";

const WHATSAPP_NUMBER =
  process.env.WHATSAPP_NUMBER || "2250152171974";

const WHATSAPP_GROUP_URL =
  process.env.WHATSAPP_GROUP_URL ||
  "https://chat.whatsapp.com/GikWdoQLZ8TFDHK2rTHH8T?s=cl&p=a&mlu=4&ilr=4";

const TELEGRAM_URL =
  process.env.TELEGRAM_URL ||
  "https://t.me/sdrive123";

const TELEGRAM_GROUP_URL =
  process.env.TELEGRAM_GROUP_URL ||
  "https://t.me/sdrive123";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "sdrive-secret-change-this-in-render";

/* =========================
   EXPRESS
========================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

/* =========================
   DATABASE
========================= */

const db = new Database(
  path.join(__dirname, "sdrive.db")
);

db.pragma("foreign_keys = ON");

/*
   Création initiale des tables.
*/

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'Membre S-Drive',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  odds_type INTEGER NOT NULL CHECK(odds_type IN (2,10)),
  status TEXT NOT NULL DEFAULT 'payment_pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

/* =========================
   MIGRATION ANCIENNE BASE
========================= */

function columnExists(table, column) {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all();

  return columns.some((c) => c.name === column);
}

/*
   Si une ancienne base possède déjà la table users
   sans username, on ajoute username.
*/

if (!columnExists("users", "username")) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN username TEXT`);
  } catch (e) {
    console.log("Migration username:", e.message);
  }
}

/*
   Remplit username pour les anciens comptes.
   Cela permet de ne pas casser les anciens utilisateurs.
*/

try {
  const oldUsers = db
    .prepare(
      `SELECT id, name, phone, username
       FROM users
       WHERE username IS NULL OR username = ''`
    )
    .all();

  for (const u of oldUsers) {
    let base =
      String(u.name || "membre")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    if (!base) base = "membre";

    let username = base;
    let number = 1;

    while (
      db
        .prepare(
          "SELECT id FROM users WHERE username = ? AND id != ?"
        )
        .get(username, u.id)
    ) {
      username = `${base}${number}`;
      number++;
    }

    db.prepare(
      "UPDATE users SET username = ? WHERE id = ?"
    ).run(username, u.id);
  }
} catch (e) {
  console.log("Migration utilisateurs:", e.message);
}

/* =========================
   UTILITAIRES
========================= */

function getCurrentUser(req) {
  if (!req.session.userId) return null;

  return db
    .prepare(
      `SELECT id, username, name, phone, badge, created_at
       FROM users
       WHERE id = ?`
    )
    .get(req.session.userId);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      error: "Connexion requise."
    });
  }

  next();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function whatsappLink(message) {
  const number = String(WHATSAPP_NUMBER).replace(
    /[^\d]/g,
    ""
  );

  if (!number) return null;

  return (
    "https://wa.me/" +
    number +
    "?text=" +
    encodeURIComponent(message)
  );
}

/* =========================
   PAGE PRINCIPALE
========================= */

app.get("/", (req, res) => {
  const user = getCurrentUser(req);
  const loggedIn = Boolean(user);

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

<title>S-Drive</title>

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

body {
  margin: 0;
  min-height: 100vh;
  font-family: Arial, Helvetica, sans-serif;
  color: var(--white);
  background:
    radial-gradient(
      circle at top,
      #12385C 0%,
      var(--navy) 58%
    );
}

.container {
  width: min(
    calc(100% - 28px),
    520px
  );
  margin: auto;
  padding: 20px 0 35px;
}

.center {
  text-align: center;
}

.logo {
  width: 100px;
  height: 100px;
  margin: 15px auto 8px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  font-size: 62px;

  background:
    rgba(0,191,255,.10);

  border:
    1px solid
    rgba(0,191,255,.25);
}

h1 {
  margin: 8px 0 5px;
  font-size: 34px;
}

h2 {
  margin: 0 0 16px;
  font-size: 21px;
}

.muted {
  color: var(--muted);
  line-height: 1.55;
}

.card {
  background:
    rgba(16,43,76,.96);

  border:
    1px solid
    var(--line);

  border-radius: 20px;

  padding: 20px;

  margin: 15px 0;

  box-shadow:
    0 8px 25px
    rgba(0,0,0,.18);
}

input {
  width: 100%;

  padding: 16px;

  margin: 7px 0;

  border-radius: 13px;

  border:
    1px solid
    #3C5F7E;

  background:
    var(--navy2);

  color: var(--white);

  font-size: 16px;

  outline: none;
}

input:focus {
  border-color:
    var(--blue);
}

.password-wrap {
  position: relative;
}

.password-wrap input {
  padding-right: 55px;
}

.eye {
  position: absolute;

  right: 7px;
  top: 7px;

  width: 45px;
  height: 46px;

  border: 0;

  background: transparent;

  color: white;

  font-size: 20px;

  cursor: pointer;
}

.btn {
  width: 100%;

  min-height: 52px;

  padding: 14px;

  border-radius: 14px;

  font-weight: 800;

  font-size: 15px;

  border: 0;

  margin: 8px 0;

  cursor: pointer;

  text-decoration: none;

  display: flex;

  justify-content: center;

  align-items: center;

  text-align: center;
}

.btn:disabled {
  opacity: .65;
  cursor: wait;
}

.primary {
  background: var(--blue);
  color: #001B2D;
}

.green {
  background: var(--green);
  color: white;
}

.secondary {
  background: #193A5C;
  color: white;
  border: 1px solid #315D82;
}

.danger {
  background: var(--red);
  color: white;
}

.choice {
  border:
    1px solid
    #315D82;

  background:
    #0B223D;

  padding: 17px;

  border-radius: 15px;

  margin: 9px 0;

  cursor: pointer;
}

.choice strong {
  display: block;
  font-size: 18px;
  margin-bottom: 6px;
}

.choice small {
  color: var(--muted);
  line-height: 1.4;
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
  font-size: 28px;
  font-weight: 900;
  text-align: center;
  margin: 17px 0;
}

.notice {
  padding: 14px;

  border-left:
    3px solid
    var(--blue);

  background:
    #0C2745;

  border-radius: 8px;

  line-height: 1.55;

  margin: 10px 0;
}

.status {
  margin-top: 12px;

  color: var(--muted);

  text-align: center;

  min-height: 24px;

  line-height: 1.4;
}

.status.success {
  color: #6EE7A0;
}

.status.error {
  color: #FF8A8A;
}

.user-box {
  background:
    rgba(7,26,45,.65);

  border:
    1px solid
    var(--line);

  padding: 15px;

  border-radius: 14px;

  margin-bottom: 15px;

  text-align: center;
}

.badge {
  display: inline-flex;

  align-items: center;

  gap: 5px;

  padding: 6px 10px;

  border-radius: 999px;

  background:
    #123B60;

  border:
    1px solid
    var(--blue);

  font-size: 12px;

  font-weight: 800;
}

.share-box {
  display: grid;

  grid-template-columns:
    1fr 1fr;

  gap: 8px;
}

.hidden {
  display: none !important;
}

footer {
  text-align: center;

  color: var(--muted);

  font-size: 12px;

  margin-top: 25px;
}

@media(max-width:360px) {

  .container {
    width:
      calc(100% - 20px);
  }

  h1 {
    font-size: 29px;
  }

  .card {
    padding: 16px;
  }

}

</style>

</head>

<body>

<main class="container">

<!-- =====================
     CONNEXION / INSCRIPTION
===================== -->

<section
  id="auth"
  class="${loggedIn ? "hidden" : ""}"
>

<div class="center">

<div class="logo">
⚽
</div>

<h1>S-Drive</h1>

<p class="muted">
Application d'analyse des matchs et coupons du jour.
</p>

</div>


<!-- CONNEXION -->

<div class="card">

<h2>Connexion</h2>

<input
  id="loginUsername"
  type="text"
  autocomplete="username"
  placeholder="Nom d'utilisateur"
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

<div
  id="loginStatus"
  class="status"
></div>

</div>


<!-- INSCRIPTION -->

<div class="card">

<h2>Créer un compte</h2>

<input
  id="registerUsername"
  type="text"
  autocomplete="username"
  placeholder="Nom d'utilisateur"
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


<!-- =====================
     INTERFACE APPLICATION
===================== -->

<section
  id="dashboard"
  class="${loggedIn ? "" : "hidden"}"
>

<div class="center">

<div class="logo">
⚽
</div>

<h1>S-Drive</h1>

<p
  id="welcomeText"
  class="muted"
>
Bienvenue ${user ? escapeHtml(user.username) : ""}
</p>

<span class="badge">
🏅 Membre S-Drive
</span>

</div>


<div
  id="userBox"
  class="user-box"
>

👤

<strong>
${user ? escapeHtml(user.username) : ""}
</strong>

<br>

<span class="muted">
Compte connecté
</span>

</div>


<!-- ANALYSE -->

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
Analyse rapide — environ 2 à 3 minutes
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
Analyse complète — environ 7 à 8 minutes
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


<!-- WHATSAPP / TELEGRAM -->

<div class="card">

<h2>
📲 Envoyer votre capture
</h2>

<a
  class="btn primary"
  href="${
    whatsappLink(
      "Bonjour S-Drive 👋 Je souhaite envoyer ma capture de matchs."
    ) || "#"
  }"
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


<!-- COMMUNAUTÉ -->

<div class="card">

<h2>
👥 Communauté S-Drive
</h2>

<p class="muted">
Rejoignez nos communautés pour recevoir
les informations et échanger avec les autres membres.
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


<!-- PARTAGE -->

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
  onclick="copyAppLink()"
>
📋 Copier le lien
</button>

<button
  class="btn secondary"
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


<!-- CONDITIONS -->

<div class="card">

<h2>
Conditions d'utilisation
</h2>

<div class="notice">

<strong>Cote 2</strong>

<br><br>

Après paiement et réception de votre capture,
S-Drive analyse vos matchs de cote 2.

<br><br>

Délai indicatif :
<strong>2 à 3 minutes</strong>.

<br><br>

Si le coupon de cote 2 analysé et envoyé
par S-Drive est validé après votre pari,
aucun montant supplémentaire ne sera demandé.

<br><br>

Si le coupon de cote 2 n'est pas validé,
vous pouvez réclamer un remboursement de
<strong>500 F</strong>.

</div>


<div class="notice">

<strong>Cote 10</strong>

<br><br>

Délai indicatif :
<strong>7 à 8 minutes</strong>.

<br><br>

Pour une analyse de cote 10,
aucun remboursement n'est prévu après
le gain ou la perte du pari.

</div>


<p class="muted">

Le paiement de l'analyse est de
<strong>1 000 F</strong>.

</p>

</div>


<button
  class="btn danger"
  onclick="logout()"
>
Se déconnecter
</button>

</section>


<footer>
S-Drive — Analyse professionnelle des matchs
</footer>

</main>


<script>

/* =========================
   VARIABLES
========================= */

let selectedOdds = 2;


/* =========================
   UTILITAIRES
========================= */

function escapeHtml(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function showStatus(id, message, type = "") {

  const element =
    document.getElementById(id);

  if (!element) return;

  element.textContent = message;

  element.className =
    "status " + type;

}


function setLoading(id, loading, text) {

  const button =
    document.getElementById(id);

  if (!button) return;

  button.disabled = loading;

  button.textContent =
    loading ? "Patientez..." : text;

}


/* =========================
   AFFICHER / MASQUER
   MOT DE PASSE
========================= */

function togglePassword(id, button) {

  const input =
    document.getElementById(id);

  if (!input) return;

  if (input.type === "password") {

    input.type = "text";

    button.textContent = "🙈";

  } else {

    input.type = "password";

    button.textContent = "👁";

  }

}


/* =========================
   AFFICHER DASHBOARD
========================= */

function showDashboard(user) {

  document
    .getElementById("auth")
    .classList.add("hidden");

  document
    .getElementById("dashboard")
    .classList.remove("hidden");


  if (user) {

    document
      .getElementById("welcomeText")
      .textContent =
        "Bienvenue " + user.username;


    document
      .getElementById("userBox")
      .innerHTML =
        "👤 <strong>" +
        escapeHtml(user.username) +
        "</strong><br>" +
        "<span class='muted'>Compte connecté</span><br>" +
        "🏅 <strong>Membre S-Drive</strong>";

  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


/* =========================
   INSCRIPTION
========================= */

async function register() {

  const username =
    document
      .getElementById("registerUsername")
      .value
      .trim();

  const password =
    document
      .getElementById("registerPassword")
      .value;

  const password2 =
    document
      .getElementById("registerPassword2")
      .value;


  showStatus(
    "registerStatus",
    ""
  );


  if (!username) {

    return showStatus(
      "registerStatus",
      "Veuillez entrer un nom d'utilisateur.",
      "error"
    );

  }


  if (username.length < 3) {

    return showStatus(
      "registerStatus",
      "Le nom d'utilisateur doit contenir au moins 3 caractères.",
      "error"
    );

  }


  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {

    return showStatus(
      "registerStatus",
      "Utilisez uniquement des lettres, chiffres, _ , . ou -.",
      "error"
    );

  }


  if (password.length < 6) {

    return showStatus(
      "registerStatus",
      "Le mot de passe doit contenir au moins 6 caractères.",
      "error"
    );

  }


  if (password !== password2) {

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
              username,
              password
            })
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    if (!response.ok) {

      return showStatus(
        "registerStatus",
        data.error ||
          "Erreur lors de l'inscription.",
        "error"
      );

    }


    showStatus(
      "registerStatus",
      "Compte créé avec succès !",
      "success"
    );


    /*
      Le serveur connecte automatiquement
      le nouveau compte.
    */

    setTimeout(() => {

      showDashboard(data.user);

    }, 500);


  } catch (error) {

    console.error(error);

    showStatus(
      "registerStatus",
      "Impossible de contacter le serveur.",
      "error"
    );

  } finally {

    setLoading(
      "registerButton",
      false,
      "Créer mon compte"
    );

  }

}


/* =========================
   CONNEXION
========================= */

async function login() {

  const username =
    document
      .getElementById("loginUsername")
      .value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      .value;


  showStatus(
    "loginStatus",
    ""
  );


  if (!username || !password) {

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
              username,
              password
            })
        }
      );


    const data =
      await response
        .json()
        .catch(() => ({}));


    if (!response.ok) {

      return showStatus(
        "loginStatus",
        data.error ||
          "Nom d'utilisateur ou mot de passe incorrect.",
        "error"
      );

    }


    showStatus(
      "loginStatus",
      "Connexion réussie !",
      "success"
    );


    /*
      IMPORTANT :
      on affiche directement l'interface.
    */

    setTimeout(() => {

      showDashboard(data.user);

    }, 300);


  } catch (error) {

    console.error(error);

    showStatus(
      "loginStatus",
      "Impossible de contacter le serveur.",
      "error"
    );

  } finally {

    setLoading(
      "loginButton",
      false,
      "Se connecter"
    );

  }

}


/* =========================
   SESSION
========================= */

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


    if (!response.ok) return;


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

  } catch (error) {

    console.error(
      "Session:",
      error
    );

  }

}


/* =========================
   CHOIX COTE
========================= */

function selectOdds(type) {

  if (
    type !== 2 &&
    type !== 10
  ) return;


  selectedOdds = type;


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


/* =========================
   CREER ANALYSE
========================= */

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
        .catch(() => ({}));


    if (!response.ok) {

      status.textContent =
        data.error ||
        "Impossible de créer la demande.";

      status.className =
        "status error";

      return;

    }


    status.textContent =
      "Demande créée. Envoyez maintenant votre capture.";

    status.className =
      "status success";


    if (data.whatsapp_url) {

      window.open(
        data.whatsapp_url,
        "_blank"
      );

    }

  } catch (error) {

    status.textContent =
      "Erreur de connexion au serveur.";

    status.className =
      "status error";

  }

}


/* =========================
   PARTAGE
========================= */

async function copyAppLink() {

  try {

    await navigator.clipboard.writeText(
      window.location.origin
    );


    showStatus(
      "shareStatus",
      "Lien copié avec succès !",
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


async function shareApp() {

  try {

    if (navigator.share) {

      await navigator.share({

        title: "S-Drive",

        text:
          "Découvrez S-Drive — Analyse professionnelle de vos matchs.",

        url:
          window.location.origin

      });

    } else {

      await copyAppLink();

    }

  } catch (error) {}

}


/* =========================
   DÉCONNEXION
========================= */

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


/* =========================
   INITIALISATION
========================= */

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


/* =========================
   INSCRIPTION API
========================= */

app.post(
  "/api/register",
  async (req, res) => {

    try {

      const username =
        String(
          req.body.username || ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );


      if (!username) {

        return res.status(400).json({
          success: false,
          error:
            "Veuillez entrer un nom d'utilisateur."
        });

      }


      if (username.length < 3) {

        return res.status(400).json({
          success: false,
          error:
            "Le nom d'utilisateur doit contenir au moins 3 caractères."
        });

      }


      if (
        !/^[a-zA-Z0-9_.-]+$/.test(
          username
        )
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Le nom d'utilisateur contient des caractères non autorisés."
        });

      }


      if (password.length < 6) {

        return res.status(400).json({
          success: false,
          error:
            "Le mot de passe doit contenir au moins 6 caractères."
        });

      }


      const exists =
        db.prepare(
          "SELECT id FROM users WHERE username = ?"
        ).get(username);


      if (exists) {

        return res.status(409).json({
          success: false,
          error:
            "Ce nom d'utilisateur existe déjà. Choisissez-en un autre."
        });

      }


      const hash =
        await bcrypt.hash(
          password,
          10
        );


      /*
        phone est laissé vide/null pour
        les nouveaux comptes.
      */

      const result =
        db.prepare(
          `INSERT INTO users
           (username, name, phone, password_hash, badge)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          username,
          username,
          null,
          hash,
          "Membre S-Drive"
        );


      req.session.userId =
        Number(
          result.lastInsertRowid
        );


      res.status(201).json({

        success: true,

        message:
          "Compte créé avec succès.",

        user: {

          id:
            Number(
              result.lastInsertRowid
            ),

          username,

          name: username,

          badge:
            "Membre S-Drive"

        }

      });

    } catch (error) {

      console.error(
        "ERREUR REGISTER:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          "Erreur serveur lors de la création du compte."

      });

    }

  }
);


/* =========================
   CONNEXION API
========================= */

app.post(
  "/api/login",
  async (req, res) => {

    try {

      const username =
        String(
          req.body.username || ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );


      if (
        !username ||
        !password
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Veuillez remplir tous les champs."

        });

      }


      const user =
        db.prepare(
          `SELECT
             id,
             username,
             name,
             phone,
             password_hash,
             badge,
             created_at
           FROM users
           WHERE username = ?`
        ).get(username);


      if (!user) {

        return res.status(401).json({

          success: false,

          error:
            "Nom d'utilisateur ou mot de passe incorrect."

        });

      }


      const valid =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!valid) {

        return res.status(401).json({

          success: false,

          error:
            "Nom d'utilisateur ou mot de passe incorrect."

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

          badge:
            user.badge

        }

      });

    } catch (error) {

      console.error(
        "ERREUR LOGIN:",
        error
      );

      res.status(500).json({

        success: false,

        error:
          "Erreur serveur lors de la connexion."

      });

    }

  }
);


/* =========================
   UTILISATEUR CONNECTÉ
========================= */

app.get(
  "/api/me",
  (req, res) => {

    const user =
      getCurrentUser(req);


    if (!user) {

      return res.status(401).json({

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


/* =========================
   DÉCONNEXION API
========================= */

app.post(
  "/api/logout",
  (req, res) => {

    req.session.destroy(
      (error) => {

        if (error) {

          return res.status(500).json({

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


/* =========================
   CRÉER UNE DEMANDE
========================= */

app.post(
  "/api/create-analysis",
  requireAuth,
  (req, res) => {

    try {

      const odds =
        Number(
          req.body.odds_type
        );


      if (
        odds !== 2 &&
        odds !== 10
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Type d'analyse incorrect."

        });

      }


      const user =
        getCurrentUser(req);


      if (!user) {

        return res.status(401).json({

          success: false,

          error:
            "Session expirée."

        });

      }


      const result =
        db.prepare(
          `INSERT INTO analyses
           (user_id, odds_type, status)
           VALUES (?, ?, 'payment_pending')`
        ).run(
          user.id,
          odds
        );


      const message = [
        "Bonjour S-Drive 👋",
        "",
        "Je viens de créer une demande d'analyse.",
        "",
        "Client : " +
          user.username,
        "",
        "Type : Cote " +
          odds,
        "",
        "Référence : SD-" +
          result.lastInsertRowid,
        "",
        "Je vais envoyer la capture de mes matchs."
      ].join("\n");


      res.status(201).json({

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

      res.status(500).json({

        success: false,

        error:
          "Impossible de créer la demande."

      });

    }

  }
);


/* =========================
   SANTÉ DU SERVEUR
========================= */

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


/* =========================
   ROUTE INCONNUE
========================= */

app.use(
  (req, res) => {

    if (
      req.path.startsWith("/api/")
    ) {

      return res.status(404).json({

        success: false,

        error:
          "Route API introuvable."

      });

    }


    res.status(404).send(
      "Page introuvable."
    );

  }
);


/* =========================
   DÉMARRAGE
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `S-Drive démarré sur le port ${PORT}`
    );

  }
);

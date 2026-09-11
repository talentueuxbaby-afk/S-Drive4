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
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

/* =========================================================
   DATABASE SQLITE
========================================================= */

const dbPath =
  path.join(__dirname, "sdrive.db");

const db =
  new Database(dbPath);

db.pragma("foreign_keys = ON");

/* =========================================================
   TABLES
========================================================= */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT UNIQUE NOT NULL,

    name TEXT,

    phone TEXT UNIQUE,

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
   MIGRATION DE LA TABLE USERS
========================================================= */

function getTableInfo(table) {

  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all();

}

const userColumns =
  getTableInfo("users");

const hasUsername =
  userColumns.some(
    (column) =>
      column.name === "username"
  );

const usernameIsNotNull =
  userColumns.some(
    (column) =>
      column.name === "username" &&
      column.notnull === 1
  );

const phoneColumn =
  userColumns.find(
    (column) =>
      column.name === "phone"
  );

const phoneIsNotNull =
  Boolean(
    phoneColumn &&
    phoneColumn.notnull === 1
  );

if (
  !hasUsername ||
  phoneIsNotNull
) {

  try {

    db.pragma(
      "foreign_keys = OFF"
    );

    db.exec("BEGIN");

    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        username TEXT UNIQUE NOT NULL,

        name TEXT,

        phone TEXT UNIQUE,

        password_hash TEXT NOT NULL,

        badge TEXT NOT NULL
          DEFAULT 'Membre S-Drive',

        created_at TEXT NOT NULL
          DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const oldUsers =
      db
        .prepare(
          "SELECT * FROM users ORDER BY id ASC"
        )
        .all();

    const insertUser =
      db.prepare(`
        INSERT INTO users_new
          (
            id,
            username,
            name,
            phone,
            password_hash,
            badge,
            created_at
          )
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
      `);

    for (const oldUser of oldUsers) {

      let username =
        oldUser.username;

      if (
        !username ||
        !String(username).trim()
      ) {

        let base =
          String(
            oldUser.name ||
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

        username = base;

        let number = 1;

        while (
          db
            .prepare(
              `SELECT id
               FROM users_new
               WHERE username = ?`
            )
            .get(username)
        ) {

          username =
            base + number;

          number++;

        }

      } else {

        username =
          String(username)
            .trim()
            .toLowerCase();

      }

      insertUser.run(
        oldUser.id,
        username,
        oldUser.name || null,
        oldUser.phone || null,
        oldUser.password_hash,
        oldUser.badge ||
          "Membre S-Drive",
        oldUser.created_at ||
          new Date().toISOString()
      );

    }

    db.exec(
      "DROP TABLE users"
    );

    db.exec(
      "ALTER TABLE users_new RENAME TO users"
    );

    db.exec("COMMIT");

    db.pragma(
      "foreign_keys = ON"
    );

    console.log(
      "Migration de la base utilisateurs terminée."
    );

  } catch (error) {

    try {
      db.exec("ROLLBACK");
    } catch (_) {}

    db.pragma(
      "foreign_keys = ON"
    );

    console.error(
      "ERREUR MIGRATION USERS:",
      error
    );

  }

}

/* =========================================================
   UTILITAIRES
========================================================= */

function normalizeUsername(value) {

  return String(
    value || ""
  )
    .trim()
    .toLowerCase();

}

function validateUsername(username) {

  if (!username) {

    return {
      valid: false,
      error:
        "Veuillez entrer votre nom d’utilisateur."
    };

  }

  if (
    username.length < 3
  ) {

    return {
      valid: false,
      error:
        "Le nom d’utilisateur doit contenir au moins 3 caractères."
    };

  }

  if (
    username.length > 30
  ) {

    return {
      valid: false,
      error:
        "Le nom d’utilisateur ne doit pas dépasser 30 caractères."
    };

  }

  if (
    !/^[a-zA-Z0-9_.-]+$/.test(
      username
    )
  ) {

    return {
      valid: false,
      error:
        "Le nom d’utilisateur peut contenir uniquement des lettres, chiffres, points, tirets et underscores."
    };

  }

  return {
    valid: true
  };

}

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
   UTILITAIRE HTML
========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

/* =========================================================
   LIEN WHATSAPP
========================================================= */

function whatsappLink(message) {

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

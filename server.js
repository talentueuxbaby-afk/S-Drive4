const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "s-drive-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// Base de données
const db = new Database(
  path.join(__dirname, "sdrive.db")
);

// Création de la table utilisateurs
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    badge TEXT DEFAULT 'Membre S-Drive',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Récupérer l'utilisateur connecté
function currentUser(req) {
  if (!req.session.userId) {
    return null;
  }

  return db
    .prepare(`
      SELECT id, username, badge, created_at
      FROM users
      WHERE id = ?
    `)
    .get(req.session.userId);
}

// ============================
// INSCRIPTION
// ============================
app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        error: "Veuillez remplir tous les champs."
      });
    }

    if (username.length < 3) {
      return res.status(400).json({
        error: "Le nom d'utilisateur doit contenir au moins 3 caractères."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 6 caractères."
      });
    }

    const exists = db
      .prepare(`
        SELECT id
        FROM users
        WHERE username = ?
      `)
      .get(username);

    if (exists) {
      return res.status(409).json({
        error: "Ce nom d'utilisateur existe déjà."
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
        INSERT INTO users (username, password_hash)
        VALUES (?, ?)
      `)
      .run(username, hash);

    req.session.userId = result.lastInsertRowid;

    res.json({
      success: true,
      message: "Compte créé avec succès.",
      user: currentUser(req)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erreur serveur."
    });
  }
});

// ============================
// CONNEXION
// ============================
app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        error: "Veuillez remplir tous les champs."
      });
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE username = ?
      `)
      .get(username);

    if (!user) {
      return res.status(401).json({
        error: "Nom d'utilisateur ou mot de passe incorrect."
      });
    }

    const ok = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!ok) {
      return res.status(401).json({
        error: "Nom d'utilisateur ou mot de passe incorrect."
      });
    }

    req.session.userId = user.id;

    res.json({
      success: true,
      message: "Connexion réussie.",
      user: currentUser(req)
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erreur serveur."
    });
  }
});

// ============================
// UTILISATEUR CONNECTÉ
// ============================
app.get("/api/me", (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.json({
      connecte: false,
      utilisateur: null
    });
  }

  res.json({
    connecte: true,
    utilisateur: user
  });
});

// ============================
// DÉCONNEXION
// ============================
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true,
      message: "Déconnexion réussie."
    });
  });
});

// ============================
// PAGE PRINCIPALE
// ============================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>S-Drive</title>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Arial, sans-serif;
  background: #071a2d;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  width: 90%;
  max-width: 430px;
  background: #123b5d;
  padding: 35px 28px;
  border-radius: 30px;
  text-align: center;
}

h1 {
  font-size: 42px;
  margin-bottom: 10px;
}

.subtitle {
  color: #b8c8d8;
  font-size: 18px;
  line-height: 1.5;
  margin-bottom: 30px;
}

input {
  width: 100%;
  padding: 18px;
  margin-bottom: 15px;
  border-radius: 15px;
  border: 1px solid #315979;
  background: #06223a;
  color: white;
  font-size: 16px;
  outline: none;
}

button {
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 15px;
  background: #08b8ed;
  color: black;
  font-size: 17px;
  font-weight: bold;
  margin-top: 5px;
}

button:active {
  transform: scale(.98);
}

.link {
  margin-top: 20px;
  color: #5bd7ff;
  cursor: pointer;
}

.message {
  margin-top: 15px;
  min-height: 20px;
}
</style>
</head>

<body>

<div class="container">

  <h1>⚽ S-Drive</h1>

  <div class="subtitle">
    Application d'analyse des matchs et coupons du jour.
  </div>

  <div id="loginBox">

    <input
      id="loginUsername"
      type="text"
      placeholder="Nom d'utilisateur"
    >

    <input
      id="loginPassword"
      type="password"
      placeholder="Mot de passe"
    >

    <button onclick="connexion()">
      Se connecter
    </button>

    <div class="message" id="loginMsg"></div>

    <div class="link" onclick="afficherInscription()">
      Créer un compte
    </div>

  </div>

  <div id="registerBox" style="display:none">

    <input
      id="registerUsername"
      type="text"
      placeholder="Choisissez un nom d'utilisateur"
    >

    <input
      id="registerPassword"
      type="password"
      placeholder="Choisissez un mot de passe"
    >

    <button onclick="inscription()">
      Créer mon compte
    </button>

    <div class="message" id="registerMsg"></div>

    <div class="link" onclick="afficherConnexion()">
      J'ai déjà un compte
    </div>

  </div>

</div>

<script>

function afficherInscription() {
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("registerBox").style.display = "block";
}

function afficherConnexion() {
  document.getElementById("registerBox").style.display = "none";
  document.getElementById("loginBox").style.display = "block";
}

async function inscription() {

  const username =
    document.getElementById("registerUsername").value.trim();

  const password =
    document.getElementById("registerPassword").value;

  const msg =
    document.getElementById("registerMsg");

  if (!username || !password) {
    msg.textContent =
      "Veuillez remplir tous les champs.";
    return;
  }

  msg.textContent = "Création du compte...";

  try {

    const r = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await r.json();

    if (r.ok) {

      msg.textContent =
        "Compte créé avec succès !";

      setTimeout(() => {
        location.href = "/";
      }, 700);

    } else {

      msg.textContent =
        data.error ||
        "Impossible de créer le compte.";

    }

  } catch (e) {

    msg.textContent =
      "Erreur de connexion au serveur.";

  }
}

async function connexion() {

  const username =
    document.getElementById("loginUsername").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  const msg =
    document.getElementById("loginMsg");

  if (!username || !password) {
    msg.textContent =
      "Veuillez remplir tous les champs.";
    return;
  }

  msg.textContent = "Connexion...";

  try {

    const r = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await r.json();

    if (r.ok) {

      msg.textContent =
        "Connexion réussie !";

      setTimeout(() => {
        location.href = "/";
      }, 700);

    } else {

      msg.textContent =
        data.error ||
        "Nom d'utilisateur ou mot de passe incorrect.";

    }

  } catch (e) {

    msg.textContent =
      "Erreur de connexion au serveur.";

  }
}

</script>

</body>
</html>
  `);
});

// Démarrage
app.listen(PORT, "0.0.0.0", () => {
  console.log(`S-Drive démarré sur le port ${PORT}`);
});

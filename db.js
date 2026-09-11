const Database = require("better-sqlite3");
const path = require("path");

// Fichier de base de données
const dbPath = path.join(__dirname, "sdrive.db");

// Connexion SQLite
const db = new Database(dbPath);

// Active les clés étrangères
db.pragma("foreign_keys = ON");

// ===============================
// TABLE UTILISATEURS
// ===============================
db.exec(`
  CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    solde REAL DEFAULT 0,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===============================
// TABLE MATCHS
// ===============================
db.exec(`
  CREATE TABLE IF NOT EXISTS matchs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipe_domicile TEXT NOT NULL,
    equipe_exterieure TEXT NOT NULL,
    championnat TEXT,
    date_match DATETIME,
    statut TEXT DEFAULT 'a_venir',
    score_domicile INTEGER,
    score_exterieur INTEGER,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===============================
// TABLE COUPONS
// ===============================
db.exec(`
  CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    description TEXT,
    cote REAL,
    confiance REAL,
    statut TEXT DEFAULT 'actif',
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===============================
// TABLE ANALYSES
// ===============================
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    resultat TEXT,
    probabilite REAL,
    confiance REAL,
    recommandation TEXT,
    analyse TEXT,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matchs(id) ON DELETE CASCADE
  );
`);

// ===============================
// TABLE PARIS
// ===============================
db.exec(`
  CREATE TABLE IF NOT EXISTS paris (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL,
    match_id INTEGER,
    type_pari TEXT NOT NULL,
    selection TEXT NOT NULL,
    cote REAL,
    mise REAL NOT NULL,
    gain_potentiel REAL,
    statut TEXT DEFAULT 'en_attente',
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    FOREIGN KEY (match_id) REFERENCES matchs(id) ON DELETE SET NULL
  );
`);

console.log("Base de données S-Drive initialisée avec succès.");

module.exports = db;

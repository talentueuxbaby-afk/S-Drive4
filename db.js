const Database = require("better-sqlite3");
const path = require("path");

// Fichier de base de données
const dbPath = path.join(__dirname, "sdrive.db");

// Connexion à SQLite
const db = new Database(dbPath);

// Active les clés étrangères
db.pragma("foreign_keys = ON");

// Création de la table utilisateurs
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

console.log("Base de données S-Drive initialisée.");

module.exports = db;

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tokens.db');
let dbInstance = null;

/**
 * Get or initialize SQLite database connection
 * @returns {Database.Database}
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    initSchema();
  }
  return dbInstance;
}

/**
 * Initialize SQLite database schema
 */
function initSchema() {
  const db = dbInstance;
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      tokens TEXT NOT NULL,
      isDemo INTEGER DEFAULT 0,
      connectedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}

/**
 * Save or replace an account in SQLite
 * @param {object} account
 */
export function saveAccount(account) {
  const db = getDb();
  const now = new Date().toISOString();
  const tokensJson = typeof account.tokens === 'string'
    ? account.tokens
    : JSON.stringify(account.tokens || {});

  const stmt = db.prepare(`
    INSERT INTO accounts (id, email, name, picture, tokens, isDemo, connectedAt, updatedAt)
    VALUES (@id, @email, @name, @picture, @tokens, @isDemo, @connectedAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      tokens = excluded.tokens,
      isDemo = excluded.isDemo,
      updatedAt = excluded.updatedAt
  `);

  stmt.run({
    id: account.id,
    email: account.email || 'unknown@example.com',
    name: account.name || account.email?.split('@')[0] || 'User',
    picture: account.picture || '',
    tokens: tokensJson,
    isDemo: account.isDemo ? 1 : 0,
    connectedAt: account.connectedAt || now,
    updatedAt: now,
  });

  return getAccount(account.id);
}

/**
 * Retrieve a single account by ID
 * @param {string} id
 */
export function getAccount(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    tokens: JSON.parse(row.tokens || '{}'),
    isDemo: Boolean(row.isDemo),
    connectedAt: row.connectedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Retrieve all connected accounts from SQLite
 * @returns {Array<object>}
 */
export function getAllAccounts() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts ORDER BY connectedAt DESC');
  const rows = stmt.all();

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    tokens: JSON.parse(row.tokens || '{}'),
    isDemo: Boolean(row.isDemo),
    connectedAt: row.connectedAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Update tokens for an account (e.g. after refresh)
 * @param {string} id
 * @param {object|string} tokens
 */
export function updateAccountTokens(id, tokens) {
  const db = getDb();
  const now = new Date().toISOString();
  const tokensJson = typeof tokens === 'string' ? tokens : JSON.stringify(tokens || {});

  const stmt = db.prepare(`
    UPDATE accounts
    SET tokens = ?, updatedAt = ?
    WHERE id = ?
  `);

  return stmt.run(tokensJson, now, id);
}

/**
 * Delete an account by ID
 * @param {string} id
 * @returns {boolean}
 */
export function deleteAccount(id) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  const res = stmt.run(id);
  return res.changes > 0;
}

/**
 * Migrate existing accounts from accounts.json if present
 */
export function migrateLegacyJson() {
  const legacyFile = path.resolve(__dirname, '../accounts.json');
  if (fs.existsSync(legacyFile)) {
    try {
      const data = fs.readFileSync(legacyFile, 'utf-8');
      const accounts = JSON.parse(data);
      for (const [id, acc] of Object.entries(accounts)) {
        if (!getAccount(id)) {
          saveAccount({ ...acc, id });
        }
      }
      console.log('[SQLite DB] Successfully imported legacy accounts from accounts.json');
    } catch (err) {
      console.warn('[SQLite DB] Error importing legacy accounts.json:', err.message);
    }
  }
}

// Auto-run migration check on load
getDb();
migrateLegacyJson();

import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'tokens.db');
let dbInstance = null;

function deriveEncryptionKey() {
  const configuredKey = process.env.DOC_RETRIEVAL_ENCRYPTION_KEY || process.env.GOOGLE_CLIENT_SECRET || 'doc-retrieval-system-local-dev-only';
  return crypto.createHash('sha256').update(String(configuredKey)).digest();
}

function encryptValue(value) {
  if (value === null || value === undefined) {
    return JSON.stringify({});
  }

  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return {};
  }

  if (!rawValue.startsWith('enc:v1:')) {
    try {
      return JSON.parse(rawValue || '{}');
    } catch {
      return {};
    }
  }

  try {
    const [, version, ivHex, tagHex, encryptedHex] = rawValue.split(':');
    if (!version || !ivHex || !tagHex || !encryptedHex) {
      return {};
    }

    const key = deriveEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const parsed = JSON.parse(decrypted.toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    initSchema();
  }
  return dbInstance;
}

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
      status TEXT NOT NULL DEFAULT 'connected',
      connectedAt TEXT NOT NULL,
      lastSyncAt TEXT,
      updatedAt TEXT NOT NULL,
      userId TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
  `);

  const columns = db.prepare(`PRAGMA table_info(accounts)`).all();
  const available = new Set(columns.map((column) => column.name));

  if (!available.has('status')) {
    db.exec('ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT "connected";');
  }
  if (!available.has('lastSyncAt')) {
    db.exec('ALTER TABLE accounts ADD COLUMN lastSyncAt TEXT;');
  }
  if (!available.has('userId')) {
    db.exec('ALTER TABLE accounts ADD COLUMN userId TEXT;');
  }
}

export function saveAccount(account) {
  const db = getDb();
  const now = new Date().toISOString();
  const normalized = {
    ...account,
    status: account.status || 'connected',
    userId: account.userId || null,
    tokens: account.tokens || {},
  };

  const tokensJson = encryptValue(normalized.tokens);

  const stmt = db.prepare(`
    INSERT INTO accounts (id, email, name, picture, tokens, isDemo, status, connectedAt, lastSyncAt, updatedAt, userId)
    VALUES (@id, @email, @name, @picture, @tokens, @isDemo, @status, @connectedAt, @lastSyncAt, @updatedAt, @userId)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      tokens = excluded.tokens,
      isDemo = excluded.isDemo,
      status = excluded.status,
      connectedAt = excluded.connectedAt,
      lastSyncAt = excluded.lastSyncAt,
      updatedAt = excluded.updatedAt,
      userId = excluded.userId
  `);

  stmt.run({
    id: normalized.id,
    email: normalized.email || 'unknown@example.com',
    name: normalized.name || normalized.email?.split('@')[0] || 'User',
    picture: normalized.picture || '',
    tokens: tokensJson,
    isDemo: normalized.isDemo ? 1 : 0,
    status: normalized.status,
    connectedAt: normalized.connectedAt || now,
    lastSyncAt: normalized.lastSyncAt || null,
    updatedAt: now,
    userId: normalized.userId || null,
  });

  return getAccount(normalized.id);
}

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
    tokens: decryptValue(row.tokens),
    isDemo: Boolean(row.isDemo),
    status: row.status || 'connected',
    connectedAt: row.connectedAt,
    lastSyncAt: row.lastSyncAt,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

export function getAllAccounts() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM accounts ORDER BY connectedAt DESC');
  const rows = stmt.all();

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    tokens: decryptValue(row.tokens),
    isDemo: Boolean(row.isDemo),
    status: row.status || 'connected',
    connectedAt: row.connectedAt,
    lastSyncAt: row.lastSyncAt,
    updatedAt: row.updatedAt,
    userId: row.userId,
  }));
}

export function updateAccountTokens(id, tokens) {
  const db = getDb();
  const now = new Date().toISOString();
  const encryptedTokens = encryptValue(tokens || {});

  const stmt = db.prepare(`
    UPDATE accounts
    SET tokens = ?, updatedAt = ?, lastSyncAt = COALESCE(lastSyncAt, ?)
    WHERE id = ?
  `);

  return stmt.run(encryptedTokens, now, now, id);
}

export function updateAccountStatus(id, status, lastSyncAt = new Date().toISOString()) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE accounts
    SET status = ?, lastSyncAt = ?, updatedAt = ?
    WHERE id = ?
  `);
  return stmt.run(status, lastSyncAt, new Date().toISOString(), id);
}

export function deleteAccount(id) {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  const res = stmt.run(id);
  return res.changes > 0;
}

export function migrateLegacyJson() {
  const legacyFile = path.resolve(__dirname, '../accounts.json');
  if (fs.existsSync(legacyFile)) {
    try {
      const data = fs.readFileSync(legacyFile, 'utf-8');
      const accounts = JSON.parse(data);
      for (const [id, acc] of Object.entries(accounts)) {
        if (!getAccount(id)) {
          saveAccount({ ...acc, id, status: acc.status || 'connected' });
        }
      }
      console.log('[SQLite DB] Successfully imported legacy accounts from accounts.json');
    } catch (err) {
      console.warn('[SQLite DB] Error importing legacy accounts.json:', err.message);
    }
  }
}

getDb();
migrateLegacyJson();

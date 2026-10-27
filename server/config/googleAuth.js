import { google } from 'googleapis';
import {
  saveAccount,
  getAccount,
  getAllAccounts,
  deleteAccount,
  updateAccountTokens,
} from './db.js';

// In-memory runtime cache of active OAuth2 clients
const activeDriveClients = new Map();

/**
 * Check if Google OAuth credentials are configured in environment
 */
export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here'
  );
}

/**
 * Create a fresh Google OAuth2 client
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback'
  );
}

/**
 * Generate OAuth Consent URL
 */
export function getAuthUrl() {
  if (!isGoogleAuthConfigured()) {
    throw new Error('Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) are not configured.');
  }

  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

/**
 * Handle OAuth callback code, exchange for tokens, and persist to SQLite
 */
export async function handleOAuthCallback(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user identity from Google OAuth2 API
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || 'unknown@gmail.com';
  const name = userInfo.data.name || email.split('@')[0];
  const picture = userInfo.data.picture || '';
  const accountId = userInfo.data.id || email;

  const accountRecord = {
    id: accountId,
    email,
    name,
    picture,
    tokens,
    isDemo: false,
    connectedAt: new Date().toISOString(),
  };

  // Persist to SQLite
  saveAccount(accountRecord);

  // Cache Drive client instance
  activeDriveClients.set(accountId, oauth2Client);

  return {
    id: accountRecord.id,
    email: accountRecord.email,
    name: accountRecord.name,
    picture: accountRecord.picture,
    isDemo: false,
    connectedAt: accountRecord.connectedAt,
  };
}

/**
 * Get all connected accounts list (from SQLite, sanitized without sensitive tokens)
 */
export function getConnectedAccounts() {
  const accounts = getAllAccounts();
  return accounts.map((acc) => ({
    id: acc.id,
    email: acc.email,
    name: acc.name,
    picture: acc.picture,
    isDemo: Boolean(acc.isDemo),
    connectedAt: acc.connectedAt,
  }));
}

/**
 * Get Google Drive API client for a specific connected account
 */
export function getDriveClientForAccount(accountId) {
  const account = getAccount(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found in connected storage.`);
  }

  if (account.isDemo) {
    return { isDemo: true, account };
  }

  let oauth2Client = activeDriveClients.get(accountId);
  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(account.tokens);

    // Persist refreshed tokens back to SQLite automatically
    oauth2Client.on('tokens', (newTokens) => {
      const mergedTokens = { ...account.tokens, ...newTokens };
      account.tokens = mergedTokens;
      updateAccountTokens(accountId, mergedTokens);
      console.log(`[GoogleAuth] Refreshed and persisted tokens for account: ${account.email}`);
    });

    activeDriveClients.set(accountId, oauth2Client);
  }

  return {
    isDemo: false,
    drive: google.drive({ version: 'v3', auth: oauth2Client }),
    account,
  };
}

/**
 * Disconnect an account and delete from SQLite
 */
export async function disconnectAccount(accountId) {
  activeDriveClients.delete(accountId);
  return deleteAccount(accountId);
}

/**
 * Toggle demo Google Drive account for zero-config testing (persisted in SQLite)
 */
export async function toggleDemoAccount(enable = true) {
  const demoId = 'demo-gdrive-account-1';
  if (enable) {
    const demoAccount = {
      id: demoId,
      email: 'alex.workspace@company-drive.internal',
      name: 'Alex Cloud Workspace',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      tokens: {},
      isDemo: true,
      connectedAt: new Date().toISOString(),
    };
    saveAccount(demoAccount);
  } else {
    deleteAccount(demoId);
  }
  return getConnectedAccounts();
}

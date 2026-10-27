import { google } from 'googleapis';
import {
  saveAccount,
  getAccount,
  getAllAccounts,
  deleteAccount,
  updateAccountTokens,
} from './db.js';

const activeDriveClients = new Map();

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
    process.env.GOOGLE_CLIENT_SECRET !== 'your_google_client_secret_here'
  );
}

export function isDemoDriveEnabled() {
  return process.env.ALLOW_DEMO_DRIVE === 'true' || process.env.ALLOW_DEMO_DRIVE === '1';
}

export function createOAuth2Client() {
  if (!isGoogleAuthConfigured()) {
    throw new Error('Google OAuth credentials are not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment.');
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback'
  );
}

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
    include_granted_scopes: true,
    scope: scopes,
  });
}

export async function handleOAuthCallback(code) {
  if (!code) {
    throw new Error('Authorization code missing.');
  }

  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email || 'unknown@gmail.com';
  const name = userInfo.data.name || email.split('@')[0];
  const picture = userInfo.data.picture || '';
  const accountId = userInfo.data.id || email;
  const now = new Date().toISOString();

  const existing = getAccount(accountId);
  const accountRecord = {
    id: accountId,
    email,
    name,
    picture,
    tokens,
    isDemo: false,
    status: 'connected',
    connectedAt: existing?.connectedAt || now,
    lastSyncAt: existing?.lastSyncAt || null,
    updatedAt: now,
    userId: existing?.userId || null,
  };

  saveAccount(accountRecord);
  activeDriveClients.set(accountId, oauth2Client);

  return {
    id: accountRecord.id,
    email: accountRecord.email,
    name: accountRecord.name,
    picture: accountRecord.picture,
    isDemo: false,
    status: 'connected',
    connectedAt: accountRecord.connectedAt,
    lastSyncAt: accountRecord.lastSyncAt,
  };
}

export function getConnectedAccounts() {
  const accounts = getAllAccounts();
  return accounts.map((acc) => ({
    id: acc.id,
    email: acc.email,
    name: acc.name,
    picture: acc.picture,
    isDemo: Boolean(acc.isDemo),
    status: acc.status || 'connected',
    connectedAt: acc.connectedAt,
    lastSyncAt: acc.lastSyncAt,
  }));
}

export function getDriveClientForAccount(accountId) {
  const account = getAccount(accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found in connected storage.`);
  }

  if (account.isDemo) {
    if (!isDemoDriveEnabled()) {
      throw new Error('Demo Drive mode is disabled. Connect a real Google Drive account or enable ALLOW_DEMO_DRIVE=true.');
    }
    return { isDemo: true, account };
  }

  let oauth2Client = activeDriveClients.get(accountId);
  if (!oauth2Client) {
    oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(account.tokens || {});

    oauth2Client.on('tokens', (newTokens) => {
      const mergedTokens = { ...(account.tokens || {}), ...newTokens };
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

export async function disconnectAccount(accountId) {
  activeDriveClients.delete(accountId);
  return deleteAccount(accountId);
}

export async function toggleDemoAccount(enable = true) {
  if (!isDemoDriveEnabled() && enable) {
    throw new Error('Demo Drive mode is disabled. Set ALLOW_DEMO_DRIVE=true to enable it.');
  }

  const demoId = 'demo-gdrive-account-1';
  if (enable) {
    const demoAccount = {
      id: demoId,
      email: 'alex.workspace@company-drive.internal',
      name: 'Alex Cloud Workspace',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      tokens: {},
      isDemo: true,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
    };
    saveAccount(demoAccount);
  } else {
    deleteAccount(demoId);
  }

  return getConnectedAccounts();
}

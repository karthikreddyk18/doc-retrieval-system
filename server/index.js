import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

import {
  getAuthUrl,
  handleOAuthCallback,
  getConnectedAccounts,
  disconnectAccount,
  toggleDemoAccount,
  isGoogleAuthConfigured,
} from './config/googleAuth.js';
import {
  searchLocalDocuments,
  readLocalDocumentContent,
  findRelatedLocalDocuments,
  resolveSearchPaths,
} from './services/localSearch.js';
import { searchDriveDocuments, readDriveDocumentContent } from './services/driveSearch.js';
import { agenticSearch } from './services/geminiAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -------------------------------------------------------------
// Root Route: Service Health & API Endpoint Directory
// -------------------------------------------------------------
app.get('/', (req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== '' &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );

  const searchPaths = resolveSearchPaths();
  const accounts = getConnectedAccounts();

  const apiDirectory = {
    name: 'Agentic AI-Based Intelligent Document Discovery and Retrieval API',
    status: 'ONLINE',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    system: {
      gemini: {
        configured: hasGeminiKey,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        mode: hasGeminiKey ? 'Gemini 2.5 Flash Function Calling' : 'Heuristic Intelligent Retrieval Engine',
      },
      googleDrive: {
        oauthConfigured: isGoogleAuthConfigured(),
        connectedAccountsCount: accounts.length,
        accounts: accounts.map((a) => ({ id: a.id, email: a.email, name: a.name, isDemo: a.isDemo })),
      },
      storage: {
        tokenDatabase: 'server/data/tokens.db (SQLite)',
        searchPaths,
      },
    },
    endpoints: {
      'GET /': 'API service info, health check, and endpoint directory',
      'GET /api/health': 'Detailed system diagnostics and storage status',
      'POST /api/search': 'Agentic natural language search across local & Google Drive',
      'GET /api/search/local': 'Direct local document search with keyword filtering',
      'GET /api/search/drive': 'Direct Google Drive search across connected accounts',
      'GET /api/document/content': 'On-demand multi-format document parser (PDF, DOCX, TXT, MD)',
      'POST /api/document/related': 'Related documents discovery algorithm',
      'GET /api/auth/google/url': 'Generate Google Drive OAuth2 consent URL',
      'GET /api/auth/google/callback': 'Google Drive OAuth2 authorization callback handler',
      'GET /api/auth/google/accounts': 'List connected Google Drive accounts from SQLite',
      'DELETE /api/auth/google/accounts/:id': 'Disconnect Google Drive account from SQLite',
      'POST /api/auth/google/demo': 'Toggle 1-click demo Google Drive account',
    },
    frontendUrl: 'http://localhost:5173',
  };

  // Render stylized HTML if requested in browser, otherwise return JSON
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Agentic AI Document Discovery API</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #f1f5f9; padding: 2.5rem; line-height: 1.6; }
            .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 1rem; padding: 2rem; max-width: 900px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; font-size: 1.5rem; margin-top: 0; }
            .badge { display: inline-block; background: #0284c7; color: white; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
            .badge-green { background: #059669; }
            pre { background: #020617; border: 1px solid #1e293b; padding: 1rem; border-radius: 0.75rem; overflow-x: auto; font-size: 0.85rem; color: #94a3b8; }
            ul { list-style: none; padding-left: 0; }
            li { margin-bottom: 0.5rem; padding: 0.5rem 0.75rem; background: #1e293b55; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; }
            a { color: #38bdf8; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h1>⚡ Agentic Document Discovery API</h1>
              <span class="badge badge-green">STATUS: ONLINE</span>
            </div>
            <p>Node.js & Express.js backend powering multi-source document search across local disk and Google Drive.</p>
            <p><strong>Frontend Dashboard:</strong> <a href="http://localhost:5173" target="_blank">http://localhost:5173</a></p>
            
            <h3>Registered API Endpoints:</h3>
            <ul>
              ${Object.entries(apiDirectory.endpoints)
                .map(([route, desc]) => `<li><strong>${route}</strong> — ${desc}</li>`)
                .join('')}
            </ul>

            <h3>System State:</h3>
            <pre>${JSON.stringify(apiDirectory.system, null, 2)}</pre>
          </div>
        </body>
      </html>
    `);
  }

  res.json(apiDirectory);
});

// -------------------------------------------------------------
// Health & System Info
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== '' &&
    process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  );

  const searchPaths = resolveSearchPaths();
  const accounts = getConnectedAccounts();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    gemini: {
      configured: hasGeminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    googleDrive: {
      oauthConfigured: isGoogleAuthConfigured(),
      connectedAccountsCount: accounts.length,
      tokenPersistence: 'SQLite (better-sqlite3)',
    },
    searchPaths,
    localDocsRoot: searchPaths[0] || path.resolve(__dirname, './sample-docs'),
  });
});

// -------------------------------------------------------------
// Agentic Natural Language Search
// -------------------------------------------------------------
app.post('/api/search', async (req, res) => {
  try {
    const { query = '', scope = 'all', fileTypes = [], directoryPath, accountId } = req.body;

    const result = await agenticSearch(query, {
      scope,
      fileTypes,
      directoryPath,
      accountId,
    });

    res.json(result);
  } catch (err) {
    console.error('[API /api/search Error]:', err);
    res.status(500).json({
      error: err.message || 'An error occurred during agentic retrieval.',
      documents: [],
      steps: [],
    });
  }
});

// -------------------------------------------------------------
// Direct Local & Drive Search Endpoints
// -------------------------------------------------------------
app.get('/api/search/local', async (req, res) => {
  try {
    const { query = '', fileTypes, maxResults, directoryPath } = req.query;
    const types = fileTypes ? (Array.isArray(fileTypes) ? fileTypes : [fileTypes]) : [];

    const documents = await searchLocalDocuments(query, {
      fileTypes: types,
      maxResults: parseInt(maxResults || '10', 10),
      directoryPath,
    });

    res.json({ documents, count: documents.length });
  } catch (err) {
    console.error('[API /api/search/local Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search/drive', async (req, res) => {
  try {
    const { query = '', fileTypes, accountId, maxResults } = req.query;
    const types = fileTypes ? (Array.isArray(fileTypes) ? fileTypes : [fileTypes]) : [];

    const documents = await searchDriveDocuments(query, {
      fileTypes: types,
      accountId,
      maxResults: parseInt(maxResults || '10', 10),
    });

    res.json({ documents, count: documents.length });
  } catch (err) {
    console.error('[API /api/search/drive Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Document Content Parsing & Viewing
// -------------------------------------------------------------
app.get('/api/document/content', async (req, res) => {
  try {
    const { source, idOrPath, accountId, maxCharacters = 10000 } = req.query;

    if (!source || !idOrPath) {
      return res.status(400).json({ error: 'Parameters "source" and "idOrPath" are required.' });
    }

    if (source === 'local') {
      let resolvedPath = idOrPath;
      if (idOrPath.startsWith('local:')) {
        const b64 = idOrPath.replace('local:', '');
        resolvedPath = Buffer.from(b64, 'base64url').toString('utf-8');
      }
      const data = await readLocalDocumentContent(resolvedPath, parseInt(maxCharacters, 10));
      return res.json(data);
    } else if (source === 'drive') {
      let driveId = idOrPath;
      let accId = accountId;
      if (idOrPath.startsWith('gdrive:')) {
        const parts = idOrPath.split(':');
        accId = parts[1];
        driveId = parts.slice(2).join(':');
      }
      const data = await readDriveDocumentContent(accId, driveId);
      return res.json(data);
    } else {
      return res.status(400).json({ error: `Unsupported source: ${source}` });
    }
  } catch (err) {
    console.error('[API /api/document/content Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Related Document Discovery
// -------------------------------------------------------------
app.post('/api/document/related', async (req, res) => {
  try {
    const { targetDocIdOrPath, source = 'local', directoryPath } = req.body;

    if (!targetDocIdOrPath) {
      return res.status(400).json({ error: 'targetDocIdOrPath is required.' });
    }

    let resolvedPath = targetDocIdOrPath;
    if (source === 'local') {
      if (targetDocIdOrPath.startsWith('local:')) {
        const b64 = targetDocIdOrPath.replace('local:', '');
        resolvedPath = Buffer.from(b64, 'base64url').toString('utf-8');
      }
      const related = await findRelatedLocalDocuments(resolvedPath, {
        maxResults: 6,
        directoryPath,
      });
      return res.json({ relatedDocs: related });
    } else {
      const driveDocs = await searchDriveDocuments('', { maxResults: 5 });
      return res.json({ relatedDocs: driveDocs.slice(0, 4) });
    }
  } catch (err) {
    console.error('[API /api/document/related Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Google Drive OAuth2 Routes (with SQLite persistence)
// -------------------------------------------------------------
app.get('/api/auth/google/url', (req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ authUrl: url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`http://localhost:5173/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).send('Authorization code missing.');
  }

  try {
    const account = await handleOAuthCallback(code);
    console.log(`[GoogleAuth] Successfully exchanged tokens and persisted to SQLite: ${account.email}`);
    res.redirect(`http://localhost:5173/?connected_account=${encodeURIComponent(account.email)}`);
  } catch (err) {
    console.error('[GoogleAuth] Callback error:', err);
    res.redirect(`http://localhost:5173/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/auth/google/accounts', (req, res) => {
  const accounts = getConnectedAccounts();
  res.json({ accounts });
});

app.delete('/api/auth/google/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await disconnectAccount(id);
    res.json({ success: deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google/demo', async (req, res) => {
  try {
    const { enable = true } = req.body;
    const accounts = await toggleDemoAccount(enable);
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`⚡ Agentic Document Discovery Server running on :${PORT}`);
  console.log(`📂 Configured search paths: ${resolveSearchPaths().join(', ')}`);
  console.log(`💾 Token Database: SQLite (server/data/tokens.db)`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'CONFIGURED' : 'NOT SET (using Heuristic Agent)'}`);
  console.log(`☁️ Google Drive OAuth: ${isGoogleAuthConfigured() ? 'CONFIGURED' : 'DEMO MODE AVAILABLE'}`);
  console.log(`=======================================================`);
});

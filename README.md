# ⚡ Agentic AI-Based Intelligent Document Discovery and Retrieval System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063.svg?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/Gemini_2.5_Flash-Function_Calling-8e75ff.svg?logo=google)](https://ai.google.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8.svg?logo=tailwindcss)](https://tailwindcss.com/)

A production-ready full-stack application that enables users to locate, inspect, and analyze documents across local computer storage and connected Google Drive accounts using natural language queries.

Powered by an Express.js backend with the **Google GenAI SDK (Gemini 2.5 Flash)** with native Tool/Function Calling, an on-demand multi-format document parser (**PDF, DOCX, Markdown, TXT**), intelligent directory crawlers with macOS tilde (`~`) expansion, related-document discovery algorithms, multi-account Google Drive OAuth2 integration with **disk-backed SQLite token persistence**, and a modern React 19 + TypeScript + Tailwind CSS dashboard.

---

## 🏗️ Architecture & Tech Stack

```
doc-retrieval-system/
├── server/
│   ├── package.json
│   ├── .env.example                 # Configuration template
│   ├── index.js                     # Express API server & root route (GET /)
│   ├── test-runner.js               # Automated test suite (npm test)
│   ├── config/
│   │   ├── db.js                    # Disk-backed SQLite token persistence (better-sqlite3)
│   │   └── googleAuth.js            # Multi-account Google OAuth2 client
│   ├── services/
│   │   ├── geminiAgent.js           # Gemini 2.5 Flash Function Calling Agent
│   │   ├── localSearch.js           # Directory crawler, ranking & tilde resolution
│   │   └── driveSearch.js           # Google Drive v3 client & cloud search
│   ├── utils/
│   │   └── parser.js                # Multi-format parser (pdf-parse, mammoth, UTF-8)
│   ├── data/                        # SQLite storage directory (.gitignored)
│   └── sample-docs/                 # High-fidelity sample documents (.pdf, .docx, .txt, .md)
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── tsconfig.json
    ├── tailwind.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx                  # Main interactive dashboard
        ├── index.css
        ├── types/index.ts           # Strict TypeScript interfaces
        └── components/
            ├── Header.tsx           # Status indicators & Drive account status
            ├── SearchBar.tsx        # NL Search, scope selector & filters
            ├── ResultCard.tsx       # Document preview card with match scores
            ├── DriveConnectModal.tsx# Multi-account Google Drive OAuth2 manager
            └── RelatedDocsDrawer.tsx# Related documents discovery slide-over
```

```
                             [ User Natural Language Query ]
                                            │
                                            ▼
                             [ Express.js Backend Server ]
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    [ Gemini 2.5 Agent ]                                  [ Direct REST / Fallback ]
  (Tool / Function Calling)                                  (Heuristic Scorer)
               │                                                         │
   ┌───────────┴───────────┐                                 ┌───────────┴───────────┐
   ▼                       ▼                                 ▼                       ▼
[ localSearch ]      [ driveSearch ]                  [ localSearch ]      [ driveSearch ]
   │                       │                                 │                       │
[ File Crawler ]     [ Google Drive v3 ]              [ File Crawler ]     [ Google Drive v3 ]
   │ (PDF/DOCX/TXT/MD)     │ (Docs/Sheets/Media)             │                       │
   └───────────┬───────────┘                                 └───────────┬───────────┘
               │                                                         │
               ▼                                                         ▼
     [ Stream Parser Engine ]                                  [ Stream Parser Engine ]
      (pdf-parse / mammoth)                                     (pdf-parse / mammoth)
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            ▼
                               [ Document Content Excerpts ]
                                            │
                                            ▼
                           [ Related Document Discovery ]
                        (Topic & Proximity Correlation)
                                            │
                                            ▼
                        [ Modern React 19 + Tailwind UI ]
```

---

## ⚡ Key Capabilities

1. **Agentic Natural Language Search**:
   - Decomposes conversational queries like *"Find all Q3 financial reports"*, *"Customer NDA contracts"*, or *"Architecture specs for Project Alpha"*.
   - Uses native Gemini Function Calling tools (`search_local_documents`, `search_drive_documents`, `read_document_content`, `find_related_documents`).
   - Visualizes full execution traces in the UI (intent analysis, tool parameters, results count, and synthesis).

2. **Multi-Source Hybrid Retrieval**:
   - Queries across local directories and connected Google Drive accounts concurrently or with granular scope filters.
   - Computes weighted relevance scores (0–100%) based on filename tokens, keyword frequencies, proximity, and document recency.

3. **On-Demand Multi-Format Document Parsing**:
   - **PDF**: Decodes binary PDF streams using `pdf-parse`, extracting page count, structured text, and metadata.
   - **DOCX**: Extracts raw text from Microsoft Word documents using `mammoth`.
   - **Markdown & TXT**: Decodes UTF-8 text streams with word and character counts.
   - **Snippets**: Generates 200–300 character contextual excerpts highlighted around query terms.

4. **Multi-Account Google Drive OAuth2 & Disk-Backed SQLite Persistence**:
   - Connect multiple personal or Google Workspace accounts with safe `drive.readonly` scopes.
   - Encrypted tokens and user metadata are persisted to disk via `better-sqlite3` at `server/data/tokens.db` (surviving server restarts).
   - Features an instant **1-Click Demo Cloud Workspace** for zero-config testing without requiring Google Cloud Console credentials upfront.

5. **Configurable Local Search Paths & Tilde (`~`) Expansion**:
   - Supports comma-separated directories in `DOCS_SEARCH_PATH` with automatic `~` expansion to the user's home folder.
   - Graceful fallback cascade to `~/Documents`, `~/Downloads`, and `~/Desktop` if custom directories are not set.

6. **Related Documents Discovery Algorithm**:
   - Clusters documents based on shared semantic themes, co-occurring keywords, directory proximity, and format correlation.
   - Accessible from any search result card via the slide-over `RelatedDocsDrawer`.

7. **In-App Document Inspector**:
   - Read full parsed text directly in a modal without opening external applications.
   - Displays format badges, word count, character count, page count, and one-click copy to clipboard.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ (ES Modules)
- **npm**: v10+

### 2. Clone and Install

```bash
git clone https://github.com/karthikreddyk18/doc-retrieval-system.git
cd doc-retrieval-system

# Install all dependencies (server & client)
npm run install:all
```

### 3. Environment Configuration

Copy the example environment file:
```bash
cp server/.env.example server/.env
```

Edit `server/.env`:
```env
PORT=5001
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Optional: Google Drive OAuth2 Credentials
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback

# Configurable search paths (comma-separated, supports ~ for home directory)
DOCS_SEARCH_PATH=./sample-docs,~/Documents,~/Downloads
```

> [!NOTE]
> The system operates immediately out-of-the-box using the built-in intelligent heuristic retrieval engine and simulated demo Drive even before configuring API keys!

### 4. Run the Application

In two separate terminals:

**Terminal 1 (Backend Server):**
```bash
npm run start:server
# Server running at http://localhost:5001
```

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
# Dashboard running at http://localhost:5173
```

---

## 🧪 Automated Test Suite

The repository includes an automated test runner covering 56 assertions across the parsing engine, crawler, SQLite database, and HTTP API endpoints:

```bash
npm test
```

Expected output:
```
=======================================================
🚀 STARTING SYSTEM VERIFICATION & TEST RUNNER
=======================================================

=== Test Suite 1: Document Parsing Engine ===
  ✓ PASS: PDF parser correctly identified format as "pdf"
  ✓ PASS: PDF parser extracted financial report text
  ✓ PASS: DOCX parser correctly identified format as "docx"
  ✓ PASS: Markdown parser correctly identified format as "markdown"
  ✓ PASS: Plain text parser correctly identified format as "text"

=== Test Suite 2: Directory Crawler & Path Resolver ===
  ✓ PASS: expandTilde correctly expanded ~/Documents
  ✓ PASS: resolveSearchPaths resolved sample-docs path correctly
  ✓ PASS: crawlDirectory found supported documents
  ✓ PASS: searchLocalDocuments found matching files

=== Test Suite 3: Disk-Backed SQLite Token Persistence ===
  ✓ PASS: saveAccount inserted record into SQLite tokens.db
  ✓ PASS: getAccount fetched record by ID
  ✓ PASS: updateAccountTokens updated tokens in SQLite
  ✓ PASS: deleteAccount returned true on successful deletion

=== Test Suite 4: End-to-End API Endpoints ===
  ✓ PASS: GET / returned HTTP 200 OK
  ✓ PASS: GET /api/health returned HTTP 200 OK
  ✓ PASS: POST /api/search returned HTTP 200 OK
  ✓ PASS: GET /api/search/local returned HTTP 200 OK
  ✓ PASS: GET /api/search/drive returned HTTP 200 OK
  ✓ PASS: GET /api/document/content returned HTTP 200 OK

=======================================================
📊 TEST RUNNER SUMMARY
  Total Assertions: 56
  Passed: 56
  Failed: 0
=======================================================
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API service overview, health status, and endpoint directory |
| `GET` | `/api/health` | Diagnostic health check, active model, and resolved search paths |
| `POST` | `/api/search` | Natural language query handled by Gemini 2.5 Flash Agent |
| `GET` | `/api/search/local` | Direct local filesystem document search |
| `GET` | `/api/search/drive` | Direct Google Drive cloud document search |
| `GET` | `/api/document/content` | On-demand document text extractor (`source=local\|drive`) |
| `POST` | `/api/document/related` | Discovers related documents based on topic overlap and proximity |
| `GET` | `/api/auth/google/url` | Generates Google OAuth2 consent URL |
| `GET` | `/api/auth/google/callback` | OAuth2 redirect handler; exchanges tokens and saves to SQLite |
| `GET` | `/api/auth/google/accounts` | Lists connected Google Drive accounts |
| `DELETE` | `/api/auth/google/accounts/:id`| Disconnects a Google Drive account from SQLite |
| `POST` | `/api/auth/google/demo` | Enables / disables 1-click Demo Cloud Drive |

---

## 🔒 Security & Privacy

- **Ephemeral Parsing**: Extracted document texts are parsed transiently in-memory buffers and are never stored without explicit user consent.
- **Minimal OAuth Scopes**: Uses `https://www.googleapis.com/auth/drive.readonly` to guarantee zero write/delete permissions on user drives.
- **Secret Sanitization**: `.env`, SQLite token databases (`server/data/*.db`), and OAuth token stores are ignored via `.gitignore` to prevent secret leakage.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Created with ❤️ by **KANCHANAKUNTLA KARTHIK REDDY**.

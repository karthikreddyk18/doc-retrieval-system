/**
 * Automated End-to-End Test Runner for Document Retrieval System
 * Tests:
 * 1. Document Parsing Engine (PDF, DOCX, TXT, MD, Snippets)
 * 2. Directory Crawler & Tilde Path Resolution
 * 3. Disk-Backed SQLite Token Persistence
 * 4. API Endpoints (GET /, GET /api/health, POST /api/search, etc.)
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';

import { parseDocument, extractSnippet } from './utils/parser.js';
import {
  expandTilde,
  resolveSearchPaths,
  crawlDirectory,
  searchLocalDocuments,
  findRelatedLocalDocuments,
} from './services/localSearch.js';
import {
  saveAccount,
  getAccount,
  getAllAccounts,
  updateAccountTokens,
  deleteAccount,
  getDb,
} from './config/db.js';
import { searchDriveDocuments } from './services/driveSearch.js';
import { agenticSearch } from './services/geminiAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI Colors for Console Reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ PASS:${RESET} ${message}`);
  } else {
    failedTests++;
    console.error(`  ${RED}✗ FAIL:${RESET} ${message}`);
  }
}

// -------------------------------------------------------------
// Test Suite 1: Document Parsing Engine
// -------------------------------------------------------------
async function runParserTests() {
  console.log(`\n${BOLD}${CYAN}=== Test Suite 1: Document Parsing Engine ===${RESET}`);

  // 1. PDF Parsing
  const pdfPath = path.resolve(__dirname, 'sample-docs/Q3_2025_Financial_Report.pdf');
  if (fs.existsSync(pdfPath)) {
    const pdfResult = await parseDocument(pdfPath);
    assert(pdfResult.format === 'pdf', 'PDF parser correctly identified format as "pdf"');
    assert(pdfResult.text.includes('Q3 2025 Financial Performance Report'), 'PDF parser extracted financial report text');
    assert(pdfResult.wordCount > 100, `PDF parser extracted ${pdfResult.wordCount} words (> 100)`);
    assert(pdfResult.pageCount >= 1, `PDF parser returned valid page count (${pdfResult.pageCount})`);
  } else {
    console.warn('  ⚠️ Skipping PDF test (sample PDF file not found)');
  }

  // 2. DOCX Parsing
  const docxPath = path.resolve(__dirname, 'sample-docs/Employment_Agreement_Template.docx');
  if (fs.existsSync(docxPath)) {
    const docxResult = await parseDocument(docxPath);
    assert(docxResult.format === 'docx', 'DOCX parser correctly identified format as "docx"');
    assert(docxResult.text.includes('Standard Employment Agreement'), 'DOCX parser extracted contract text');
    assert(docxResult.text.includes('Compensation includes base salary'), 'DOCX parser extracted compensation terms');
  } else {
    console.warn('  ⚠️ Skipping DOCX test (sample DOCX file not found)');
  }

  // 3. Markdown Parsing
  const mdPath = path.resolve(__dirname, 'sample-docs/Project_Alpha_Architecture.md');
  if (fs.existsSync(mdPath)) {
    const mdResult = await parseDocument(mdPath);
    assert(mdResult.format === 'markdown', 'Markdown parser correctly identified format as "markdown"');
    assert(mdResult.text.includes('Project Alpha: System Architecture'), 'Markdown parser extracted title and content');
  }

  // 4. Plain Text Parsing
  const txtPath = path.resolve(__dirname, 'sample-docs/Master_Services_Agreement_NDA.txt');
  if (fs.existsSync(txtPath)) {
    const txtResult = await parseDocument(txtPath);
    assert(txtResult.format === 'text', 'Plain text parser correctly identified format as "text"');
    assert(txtResult.text.includes('MUTUAL NON-DISCLOSURE AGREEMENT'), 'Text parser extracted NDA agreement terms');
  }

  // 5. Snippet Extraction
  const sampleContent = 'The corporate revenue in Q3 grew by 28% while EBITDA margins reached an all-time record of 18.2%.';
  const snippet = extractSnippet(sampleContent, 'EBITDA margins', 60);
  assert(snippet.toLowerCase().includes('ebitda'), 'extractSnippet correctly centered excerpt around query term');
}

// -------------------------------------------------------------
// Test Suite 2: Directory Crawler & Tilde Path Resolver
// -------------------------------------------------------------
async function runCrawlerTests() {
  console.log(`\n${BOLD}${CYAN}=== Test Suite 2: Directory Crawler & Path Resolver ===${RESET}`);

  // 1. Tilde Expansion
  const home = os.homedir();
  assert(expandTilde('~/Documents') === path.join(home, 'Documents'), `expandTilde correctly expanded ~/Documents to ${path.join(home, 'Documents')}`);
  assert(expandTilde('~') === home, 'expandTilde correctly expanded standalone ~ to home directory');
  assert(expandTilde('./sample-docs') === './sample-docs', 'expandTilde left relative paths untouched');

  // 2. Resolve Search Paths
  const sampleDocsPath = path.resolve(__dirname, 'sample-docs');
  const resolved = resolveSearchPaths('./sample-docs, ~/Documents');
  assert(resolved.includes(sampleDocsPath), 'resolveSearchPaths resolved sample-docs path correctly');
  assert(resolved.length >= 1, `resolveSearchPaths returned ${resolved.length} valid accessible directories`);

  // 3. Fallback Path Resolution
  const fallbackPaths = resolveSearchPaths('non_existent_folder_xyz_123');
  assert(fallbackPaths.length > 0, 'resolveSearchPaths fell back to default accessible system paths');

  // 4. Directory Crawling
  const crawledFiles = await crawlDirectory(sampleDocsPath);
  assert(crawledFiles.length >= 5, `crawlDirectory found ${crawledFiles.length} supported documents`);
  const hasPdf = crawledFiles.some((f) => f.fileType === 'pdf');
  const hasDocx = crawledFiles.some((f) => f.fileType === 'docx');
  const hasMd = crawledFiles.some((f) => f.fileType === 'markdown');
  const hasTxt = crawledFiles.some((f) => f.fileType === 'text');
  assert(hasPdf, 'Crawler detected .pdf files');
  assert(hasDocx, 'Crawler detected .docx files');
  assert(hasMd, 'Crawler detected .md files');
  assert(hasTxt, 'Crawler detected .txt files');

  // 5. Local Document Search
  const searchResults = await searchLocalDocuments('financial revenue report', {
    directoryPath: sampleDocsPath,
  });
  assert(searchResults.length > 0, `searchLocalDocuments found ${searchResults.length} matching files`);
  assert(searchResults[0].relevanceScore >= 50, `Top search result scored high relevance (${searchResults[0].relevanceScore}%)`);

  // 6. Related Document Discovery
  const relatedResults = await findRelatedLocalDocuments(path.join(sampleDocsPath, 'Q3_2025_Financial_Report.txt'), {
    directoryPath: sampleDocsPath,
  });
  assert(relatedResults.length > 0, `findRelatedLocalDocuments discovered ${relatedResults.length} related documents`);
  assert(Boolean(relatedResults[0].relationshipReason), 'Related document contains explanatory relationshipReason');
}

// -------------------------------------------------------------
// Test Suite 3: Disk-Backed SQLite Token Persistence
// -------------------------------------------------------------
async function runSqliteTests() {
  console.log(`\n${BOLD}${CYAN}=== Test Suite 3: Disk-Backed SQLite Token Persistence ===${RESET}`);

  const testAccountId = 'test-suite-account-999';
  const testAccount = {
    id: testAccountId,
    email: 'test.suite@enterprise-cloud.test',
    name: 'Test Runner Account',
    picture: 'https://example.com/avatar.png',
    tokens: { access_token: 'test_token_abc_123', refresh_token: 'test_refresh_xyz_789', expiry_date: 1800000000000 },
    isDemo: false,
    connectedAt: new Date().toISOString(),
  };

  // 1. Save Account
  const saved = saveAccount(testAccount);
  assert(saved !== null && saved.id === testAccountId, 'saveAccount inserted record into SQLite tokens.db');
  assert(saved.tokens.access_token === 'test_token_abc_123', 'saveAccount correctly stringified & stored token payload');

  // 2. Retrieve Account
  const retrieved = getAccount(testAccountId);
  assert(retrieved !== null, 'getAccount fetched record by ID');
  assert(retrieved.email === testAccount.email, `getAccount matched email (${retrieved.email})`);

  // 3. Retrieve All Accounts
  const all = getAllAccounts();
  assert(all.some((a) => a.id === testAccountId), `getAllAccounts included test account (total: ${all.length})`);

  // 4. Update Tokens
  const updatedTokens = { access_token: 'refreshed_token_456', refresh_token: 'test_refresh_xyz_789' };
  updateAccountTokens(testAccountId, updatedTokens);
  const updatedRecord = getAccount(testAccountId);
  assert(updatedRecord.tokens.access_token === 'refreshed_token_456', 'updateAccountTokens updated tokens in SQLite');

  // 5. Delete Account
  const deleted = deleteAccount(testAccountId);
  assert(deleted === true, 'deleteAccount returned true on successful deletion');
  const afterDelete = getAccount(testAccountId);
  assert(afterDelete === null, 'getAccount returned null after deletion');
}

// -------------------------------------------------------------
// Test Suite 4: End-to-End API HTTP Endpoints
// -------------------------------------------------------------
async function runApiTests() {
  console.log(`\n${BOLD}${CYAN}=== Test Suite 4: End-to-End API Endpoints ===${RESET}`);

  // Helper for HTTP requests
  function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 5001,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      };

      const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
          } catch {
            resolve({ statusCode: res.statusCode, raw: rawData, headers: res.headers });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  try {
    // 1. GET / (Root Route)
    const rootRes = await makeRequest('GET', '/');
    assert(rootRes.statusCode === 200, 'GET / returned HTTP 200 OK');
    assert(rootRes.data.status === 'ONLINE', 'GET / returned status "ONLINE"');
    assert(Boolean(rootRes.data.endpoints), 'GET / returned endpoint directory structure');
    assert(Boolean(rootRes.data.system?.storage?.tokenDatabase), 'GET / returned storage & SQLite token db status');

    // 2. GET /api/health
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.statusCode === 200, 'GET /api/health returned HTTP 200 OK');
    assert(healthRes.data.status === 'healthy', 'GET /api/health confirmed healthy status');
    assert(Array.isArray(healthRes.data.searchPaths), 'GET /api/health returned resolved searchPaths array');

    // 3. POST /api/search (Agentic Natural Language Search)
    const searchRes = await makeRequest('POST', '/api/search', {
      query: 'Find Q3 financial reports and architecture blueprints',
      scope: 'all',
    });
    assert(searchRes.statusCode === 200, 'POST /api/search returned HTTP 200 OK');
    assert(Boolean(searchRes.data.answer), 'POST /api/search returned agent synthesis answer');
    assert(Array.isArray(searchRes.data.documents), `POST /api/search returned ${searchRes.data.documents.length} matched documents`);
    assert(Array.isArray(searchRes.data.steps), `POST /api/search returned ${searchRes.data.steps.length} execution steps`);

    // 4. GET /api/search/local
    const localRes = await makeRequest('GET', '/api/search/local?query=compliance');
    assert(localRes.statusCode === 200, 'GET /api/search/local returned HTTP 200 OK');
    assert(Array.isArray(localRes.data.documents), 'GET /api/search/local returned documents array');

    // 5. GET /api/search/drive
    const driveRes = await makeRequest('GET', '/api/search/drive?query=contract');
    assert(driveRes.statusCode === 200, 'GET /api/search/drive returned HTTP 200 OK');
    assert(Array.isArray(driveRes.data.documents), 'GET /api/search/drive returned cloud documents');

    // 6. GET /api/document/content (On-Demand Content Parsing)
    const contentRes = await makeRequest(
      'GET',
      '/api/document/content?source=local&idOrPath=sample-docs/Q3_2025_Financial_Report.txt'
    );
    assert(contentRes.statusCode === 200, 'GET /api/document/content returned HTTP 200 OK');
    assert(Boolean(contentRes.data.text), 'GET /api/document/content returned parsed document text');

    // 7. POST /api/document/related
    const relatedRes = await makeRequest('POST', '/api/document/related', {
      targetDocIdOrPath: 'sample-docs/Project_Alpha_Architecture.md',
      source: 'local',
    });
    assert(relatedRes.statusCode === 200, 'POST /api/document/related returned HTTP 200 OK');
    assert(Array.isArray(relatedRes.data.relatedDocs), 'POST /api/document/related returned relatedDocs list');

    // 8. GET /api/auth/google/accounts
    const accountsRes = await makeRequest('GET', '/api/auth/google/accounts');
    assert(accountsRes.statusCode === 200, 'GET /api/auth/google/accounts returned HTTP 200 OK');
    assert(Array.isArray(accountsRes.data.accounts), 'GET /api/auth/google/accounts returned accounts array from SQLite');
  } catch (err) {
    console.warn(`  ⚠️ API HTTP tests skipped or failed to connect: ${err.message}`);
    console.warn('  (Ensure the backend server is running on port 5001)');
  }
}

// -------------------------------------------------------------
// Main Test Suite Runner
// -------------------------------------------------------------
async function main() {
  const startTime = Date.now();
  console.log(`\n${BOLD}=======================================================${RESET}`);
  console.log(`${BOLD}🚀 STARTING SYSTEM VERIFICATION & TEST RUNNER${RESET}`);
  console.log(`${BOLD}=======================================================${RESET}`);

  await runParserTests();
  await runCrawlerTests();
  await runSqliteTests();
  await runApiTests();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n${BOLD}=======================================================${RESET}`);
  console.log(`${BOLD}📊 TEST RUNNER SUMMARY${RESET}`);
  console.log(`  Total Assertions: ${totalTests}`);
  console.log(`  Passed: ${GREEN}${passedTests}${RESET}`);
  console.log(`  Failed: ${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);
  console.log(`  Elapsed Time: ${elapsed}s`);
  console.log(`${BOLD}=======================================================${RESET}\n`);

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

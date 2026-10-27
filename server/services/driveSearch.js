import { getConnectedAccounts, getDriveClientForAccount } from '../config/googleAuth.js';
import { parseBuffer, extractSnippet } from '../utils/parser.js';
import { formatBytes } from './localSearch.js';

// Simulated Realistic Cloud Drive Documents for zero-config testing & demonstration
const DEMO_DRIVE_DOCUMENTS = [
  {
    id: 'gdrive-doc-101',
    name: 'Enterprise_Contract_Customer_NDA_2025.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileType: 'docx',
    sizeBytes: 48200,
    sizeFormatted: '47.1 KB',
    modifiedAt: '2025-10-18T14:22:00.000Z',
    webViewLink: 'https://docs.google.com/document/d/demo-contract-nda-2025/view',
    owner: 'alex.workspace@company-drive.internal',
    text: `MUTUAL NON-DISCLOSURE AND DATA PROTECTION AGREEMENT
Between Cloud Enterprise Solutions and Apex AI Technology Corporation.
Scope: Customer data protection, AI document retrieval integration, OAuth2 tokens security, and zero-retention data policies.
Both parties agree to hold all technical blueprints, API secrets, financial models, and customer records in strict confidence.
Governing Law: State of California. Term: 3 years from execution date.`,
  },
  {
    id: 'gdrive-doc-102',
    name: 'Cloud_Data_Pipeline_Architecture_Spec.gdoc',
    mimeType: 'application/vnd.google-apps.document',
    fileType: 'document',
    sizeBytes: 15400,
    sizeFormatted: '15.0 KB',
    modifiedAt: '2025-10-22T09:15:30.000Z',
    webViewLink: 'https://docs.google.com/document/d/demo-architecture-spec/view',
    owner: 'alex.workspace@company-drive.internal',
    text: `Google Cloud Platform & Drive Storage Synchronizer Specification
Module: Real-time event streaming and webhook notifications for modified documents in corporate Google Drive shared folders.
Integration: Google Drive API v3 with push notifications via Google Cloud Pub/Sub.
Features:
- Incremental change tokens tracking (drive.changes.list).
- Chunked parallel document text extraction.
- Automatic document classification using Gemini 2.5 Flash function calling.
- Sub-500ms retrieval cache for frequently queried financial summaries.`,
  },
  {
    id: 'gdrive-doc-103',
    name: 'Q3_Global_Sales_and_Revenue_Summary.pdf',
    mimeType: 'application/pdf',
    fileType: 'pdf',
    sizeBytes: 312000,
    sizeFormatted: '304.7 KB',
    modifiedAt: '2025-10-05T18:40:00.000Z',
    webViewLink: 'https://drive.google.com/file/d/demo-sales-summary-q3/view',
    owner: 'finance-team@company-drive.internal',
    text: `Q3 GLOBAL SALES PERFORMANCE & REVENUE BREAKDOWN
Prepared by Global VP of Enterprise Sales.
Key Metrics:
- Total Cloud Search Bookings: $19.4M, surpassing quarterly plan by 18%.
- EMEA Expansion: 42 new corporate logos onboarded with multi-account Google Drive sync.
- North America: Strong renewal rate of 98.4% across Fortune 500 accounts.
- Churn Risk Analysis: Minimal churn observed, major competitors lagging in AI agentic retrieval capabilities.`,
  },
  {
    id: 'gdrive-doc-104',
    name: 'Employee_Equity_Incentive_Plan_2025.pdf',
    mimeType: 'application/pdf',
    fileType: 'pdf',
    sizeBytes: 184500,
    sizeFormatted: '180.2 KB',
    modifiedAt: '2025-08-14T11:00:00.000Z',
    webViewLink: 'https://drive.google.com/file/d/demo-equity-incentive/view',
    owner: 'people-ops@company-drive.internal',
    text: `2025 GLOBAL EQUITY INCENTIVE AND STOCK OPTION PLAN
Overview: Stock option grant schedules, 4-year vesting with 1-year cliff, early exercise provisions, and tax considerations for ISO and NSO grants.
Eligibility: Full-time employees upon passing probation review.
Acceleration Clauses: Double-trigger acceleration upon change of control event.`,
  },
  {
    id: 'gdrive-doc-105',
    name: 'Vendor_Security_Risk_Assessment.txt',
    mimeType: 'text/plain',
    fileType: 'text',
    sizeBytes: 9800,
    sizeFormatted: '9.6 KB',
    modifiedAt: '2025-09-28T16:20:00.000Z',
    webViewLink: 'https://drive.google.com/file/d/demo-vendor-security-audit/view',
    owner: 'alex.workspace@company-drive.internal',
    text: `Third-Party Vendor Security Risk Assessment Matrix
Evaluated Vendors: Cloud Hosting Providers, LLM Inference Gateways, Document Parser Libraries.
Criteria: SOC2 compliance, ISO 27001 certification, penetration test recency, and TLS 1.3 protocol enforcement.
Result: All active vendors scored low risk. Approved for production integration.`,
  },
];

/**
 * Map MIME type to a normalized fileType
 */
export function getFileTypeFromMime(mimeType = '', name = '') {
  const normMime = mimeType.toLowerCase();
  const normName = name.toLowerCase();

  if (normMime === 'application/pdf' || normName.endsWith('.pdf')) return 'pdf';
  if (
    normMime.includes('wordprocessingml') ||
    normMime.includes('msword') ||
    normName.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (normMime.includes('markdown') || normName.endsWith('.md')) return 'markdown';
  if (normMime === 'text/plain' || normName.endsWith('.txt')) return 'text';
  if (normMime === 'application/vnd.google-apps.document') return 'docx';
  if (normMime === 'application/vnd.google-apps.spreadsheet') return 'text';
  if (normMime === 'application/vnd.google-apps.presentation') return 'pdf';

  return 'document';
}

/**
 * Search Google Drive across connected accounts
 * @param {string} query
 * @param {object} options
 */
export async function searchDriveDocuments(query = '', options = {}) {
  const {
    accountId,
    fileTypes = [],
    maxResults = 10,
  } = options;

  const connectedAccounts = getConnectedAccounts();

  // If no account connected, automatically provide demo account results
  if (connectedAccounts.length === 0) {
    return searchDemoDriveDocuments(query, { fileTypes, maxResults });
  }

  // Determine which accounts to query
  const targetAccounts = accountId
    ? connectedAccounts.filter((a) => a.id === accountId)
    : connectedAccounts;

  const allResults = [];

  for (const acc of targetAccounts) {
    if (acc.isDemo) {
      const demoResults = searchDemoDriveDocuments(query, {
        fileTypes,
        maxResults,
        accountEmail: acc.email,
        accountId: acc.id,
      });
      allResults.push(...demoResults);
      continue;
    }

    try {
      const { drive } = getDriveClientForAccount(acc.id);

      // Build Drive search query clause
      const queryClauses = ['trashed = false'];

      if (query && query.trim() !== '') {
        const cleanQuery = query.replace(/'/g, "\\'");
        queryClauses.push(`(name contains '${cleanQuery}' or fullText contains '${cleanQuery}')`);
      }

      // MIME type filters if specified
      if (fileTypes && fileTypes.length > 0) {
        const mimeFilters = [];
        for (const ft of fileTypes) {
          const clean = ft.toLowerCase().replace('.', '');
          if (clean === 'pdf') mimeFilters.push("mimeType = 'application/pdf'");
          if (clean === 'docx') {
            mimeFilters.push("mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'");
            mimeFilters.push("mimeType = 'application/vnd.google-apps.document'");
          }
          if (clean === 'txt' || clean === 'text') mimeFilters.push("mimeType = 'text/plain'");
          if (clean === 'md' || clean === 'markdown') mimeFilters.push("name contains '.md'");
        }
        if (mimeFilters.length > 0) {
          queryClauses.push(`(${mimeFilters.join(' or ')})`);
        }
      }

      const q = queryClauses.join(' and ');

      const response = await drive.files.list({
        q,
        fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink, owners, description)',
        pageSize: maxResults,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files = response.data.files || [];

      for (const f of files) {
        const fileType = getFileTypeFromMime(f.mimeType, f.name);
        const sizeBytes = parseInt(f.size || '0', 10);
        const ownerEmail = f.owners?.[0]?.emailAddress || acc.email;

        allResults.push({
          id: `gdrive:${acc.id}:${f.id}`,
          rawId: f.id,
          name: f.name,
          source: 'drive',
          sourceLabel: `Google Drive (${acc.name || acc.email})`,
          accountId: acc.id,
          accountEmail: acc.email,
          fileType,
          mimeType: f.mimeType,
          sizeBytes,
          sizeFormatted: formatBytes(sizeBytes),
          modifiedAt: f.modifiedTime,
          webViewLink: f.webViewLink,
          relevanceScore: 88,
          matchReason: `Matching Drive query across account ${acc.email}`,
          snippet: f.description || `Google Drive document owned by ${ownerEmail}. Last updated ${new Date(f.modifiedTime).toLocaleDateString()}.`,
        });
      }
    } catch (err) {
      console.warn(`[DriveSearch] Error querying account ${acc.email}:`, err.message);
    }
  }

  // Sort and limit
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return allResults.slice(0, maxResults);
}

/**
 * Search demo Google Drive documents
 */
function searchDemoDriveDocuments(query = '', options = {}) {
  const {
    fileTypes = [],
    maxResults = 10,
    accountEmail = 'alex.workspace@company-drive.internal',
    accountId = 'demo-gdrive-account-1',
  } = options;

  const queryTerms = (query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const matched = [];

  for (const doc of DEMO_DRIVE_DOCUMENTS) {
    // FileType check
    if (fileTypes && fileTypes.length > 0) {
      const cleanTypes = fileTypes.map((t) => t.toLowerCase().replace('.', ''));
      if (!cleanTypes.includes(doc.fileType)) continue;
    }

    let score = 0;
    const reasons = [];
    const nameLower = doc.name.toLowerCase();
    const textLower = doc.text.toLowerCase();

    if (query && nameLower.includes(query.toLowerCase().trim())) {
      score += 45;
      reasons.push('Title keyword match');
    }

    let textHits = 0;
    for (const term of queryTerms) {
      if (nameLower.includes(term)) {
        score += 20;
      }
      if (textLower.includes(term)) {
        textHits++;
        score += 15;
      }
    }

    if (textHits > 0) {
      reasons.push(`${textHits} term matches in cloud document`);
    }

    if (!query || query.trim() === '') {
      score = 75;
      reasons.push('Recent Google Drive file');
    }

    if (score > 0 || !query) {
      const normalizedScore = Math.min(99, Math.max(30, score));
      matched.push({
        id: `gdrive:${accountId}:${doc.id}`,
        rawId: doc.id,
        name: doc.name,
        source: 'drive',
        sourceLabel: `Google Drive (${accountEmail})`,
        accountId,
        accountEmail,
        fileType: doc.fileType,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        sizeFormatted: doc.sizeFormatted,
        modifiedAt: doc.modifiedAt,
        webViewLink: doc.webViewLink,
        relevanceScore: normalizedScore,
        matchReason: reasons.join(' • ') || 'Relevant Google Drive document',
        snippet: extractSnippet(doc.text, query, 240),
        wordCount: doc.text.split(/\s+/).length,
      });
    }
  }

  matched.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return matched.slice(0, maxResults);
}

/**
 * Read content from a Google Drive document
 * @param {string} accountId
 * @param {string} fileId
 */
export async function readDriveDocumentContent(accountId, fileId) {
  // Check if it's a demo document
  const demoMatch = DEMO_DRIVE_DOCUMENTS.find((d) => d.id === fileId);
  if (demoMatch) {
    return {
      name: demoMatch.name,
      fileType: demoMatch.fileType,
      text: demoMatch.text,
      wordCount: demoMatch.text.split(/\s+/).length,
      sizeBytes: demoMatch.sizeBytes,
      webViewLink: demoMatch.webViewLink,
      source: 'drive',
    };
  }

  const { drive, isDemo } = getDriveClientForAccount(accountId);
  if (isDemo) {
    throw new Error('Demo document not found.');
  }

  // Get file metadata first
  const meta = await drive.files.get({
    fileId,
    fields: 'id, name, mimeType, size, webViewLink',
  });

  const mime = meta.data.mimeType || '';
  let text = '';
  let format = getFileTypeFromMime(mime, meta.data.name);

  // If Google Doc / Sheet, export to text
  if (mime === 'application/vnd.google-apps.document') {
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
    text = res.data || '';
  } else if (mime === 'application/vnd.google-apps.spreadsheet') {
    const res = await drive.files.export({ fileId, mimeType: 'text/csv' }, { responseType: 'text' });
    text = res.data || '';
  } else {
    // Download raw binary / text stream
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(res.data);
    const parsed = await parseBuffer(buffer, mime || meta.data.name);
    text = parsed.text || '';
    format = parsed.format || format;
  }

  return {
    name: meta.data.name,
    fileType: format,
    text,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    sizeBytes: parseInt(meta.data.size || '0', 10),
    webViewLink: meta.data.webViewLink,
    source: 'drive',
  };
}

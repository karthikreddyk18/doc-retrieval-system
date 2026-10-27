import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { parseDocument, extractSnippet } from '../utils/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Built-in sample documents directory
const DEFAULT_DOCS_DIR = path.resolve(__dirname, '../sample-docs');

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your'
]);

/**
 * Expand tilde '~' to user's home directory
 * @param {string} filepath
 * @returns {string}
 */
export function expandTilde(filepath) {
  if (!filepath || typeof filepath !== 'string') return '';
  const trimmed = filepath.trim();
  if (trimmed === '~' || trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(trimmed === '~' ? 1 : 2));
  }
  return trimmed;
}

/**
 * Resolve search paths from string, comma-separated paths, or environment variables
 * with fallback support for macOS user directories (~/Documents, ~/Downloads, ~/Desktop)
 * @param {string|string[]} [customPaths]
 * @returns {string[]} Verified existing directory paths
 */
export function resolveSearchPaths(customPaths) {
  const rawInput = customPaths || process.env.DOCS_SEARCH_PATH || process.env.LOCAL_DOCS_ROOT || DEFAULT_DOCS_DIR;

  const candidateStrings = Array.isArray(rawInput)
    ? rawInput
    : String(rawInput)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

  const resolvedPaths = [];
  const seen = new Set();

  for (const raw of candidateStrings) {
    const expanded = expandTilde(raw);
    const absPath = path.isAbsolute(expanded)
      ? path.normalize(expanded)
      : path.resolve(process.cwd(), expanded);

    if (fsSync.existsSync(absPath)) {
      try {
        const stats = fsSync.statSync(absPath);
        if (stats.isDirectory() && !seen.has(absPath)) {
          resolvedPaths.push(absPath);
          seen.add(absPath);
        }
      } catch {
        // Skip inaccessible paths
      }
    }
  }

  // If no configured paths exist, fallback to macOS user directories and sample-docs
  if (resolvedPaths.length === 0) {
    const fallbackCandidates = [
      DEFAULT_DOCS_DIR,
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Desktop'),
    ];

    for (const fb of fallbackCandidates) {
      if (fsSync.existsSync(fb)) {
        try {
          const stats = fsSync.statSync(fb);
          if (stats.isDirectory() && !seen.has(fb)) {
            resolvedPaths.push(fb);
            seen.add(fb);
          }
        } catch {}
      }
    }
  }

  // If still empty, ensure default docs dir is at least targeted
  if (resolvedPaths.length === 0) {
    resolvedPaths.push(DEFAULT_DOCS_DIR);
  }

  return resolvedPaths;
}

/**
 * Determine high-level fileType string from extension
 */
export function getFileTypeFromExt(ext) {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.md':
      return 'markdown';
    case '.txt':
      return 'text';
    default:
      return 'document';
  }
}

/**
 * Format bytes into human readable string (KB, MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Recursively crawl directories to find supported document files
 * Supports crawling single directory or multiple directories in parallel
 * @param {string|string[]} dirPath
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
export async function crawlDirectory(dirPath = DEFAULT_DOCS_DIR, options = {}) {
  const { maxDepth = 4 } = options;
  const targetDirs = Array.isArray(dirPath) ? dirPath : [dirPath];
  const results = [];
  const visitedPaths = new Set();

  async function walk(currentDir, rootDir, depth = 0) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip folders without read permissions
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip hidden directories, system files, dependencies, build outputs
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
      if (['node_modules', 'dist', 'build', '.git', 'coverage', 'Library', 'System', 'Applications'].includes(entry.name)) continue;

      if (entry.isDirectory()) {
        await walk(fullPath, rootDir, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          if (!visitedPaths.has(fullPath)) {
            visitedPaths.add(fullPath);
            try {
              const stats = await fs.stat(fullPath);
              results.push({
                name: entry.name,
                path: fullPath,
                relativePath: path.relative(rootDir, fullPath),
                directory: currentDir,
                extension: ext,
                fileType: getFileTypeFromExt(ext),
                sizeBytes: stats.size,
                sizeFormatted: formatBytes(stats.size),
                modifiedAt: stats.mtime.toISOString(),
              });
            } catch {
              // Ignore stat errors
            }
          }
        }
      }
    }
  }

  for (const dir of targetDirs) {
    const normDir = path.resolve(dir);
    if (fsSync.existsSync(normDir)) {
      await walk(normDir, normDir, 0);
    }
  }

  return results;
}

/**
 * Search local files matching query terms, filename, or deep document text
 * @param {string} query
 * @param {object} options
 */
export async function searchLocalDocuments(query = '', options = {}) {
  const {
    fileTypes = [],
    maxResults = 10,
    directoryPath,
    deepContentSearch = true,
  } = options;

  const targetDirs = resolveSearchPaths(directoryPath);
  const allFiles = await crawlDirectory(targetDirs);

  // Normalize query keywords
  const keywords = (query || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((k) => k.length > 1 && !STOP_WORDS.has(k));

  const filteredByType = allFiles.filter((file) => {
    if (!fileTypes || fileTypes.length === 0) return true;
    const cleanTypes = fileTypes.map((t) => t.toLowerCase().replace('.', ''));
    return cleanTypes.includes(file.fileType) || cleanTypes.includes(file.extension.replace('.', ''));
  });

  const matchedDocs = [];

  for (const file of filteredByType) {
    let score = 0;
    const reasons = [];
    const nameLower = file.name.toLowerCase();

    // 1. Exact query match in file name
    if (query && nameLower.includes(query.toLowerCase().trim())) {
      score += 45;
      reasons.push('Direct filename match');
    }

    // 2. Keyword occurrences in file name
    let filenameMatches = 0;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        score += 20;
        filenameMatches++;
      }
    }
    if (filenameMatches > 0 && !reasons.includes('Direct filename match')) {
      reasons.push(`${filenameMatches} query keywords in filename`);
    }

    // 3. Deep content search
    let contentSnippet = '';
    let parsedText = '';
    let wordCount = 0;

    if (deepContentSearch) {
      try {
        const parsed = await parseDocument(file.path);
        parsedText = parsed.text || '';
        wordCount = parsed.wordCount || 0;

        if (parsedText) {
          const textLower = parsedText.toLowerCase();

          // Search term occurrences in body
          let contentHits = 0;
          for (const kw of keywords) {
            const matches = textLower.split(kw).length - 1;
            if (matches > 0) {
              contentHits += matches;
              score += Math.min(25, matches * 4);
            }
          }

          if (contentHits > 0) {
            reasons.push(`${contentHits} occurrences in document text`);
          }

          contentSnippet = extractSnippet(parsedText, query, 260);
        }
      } catch (err) {
        // Skip content search errors for locked/corrupted files
      }
    }

    // Default snippet if empty
    if (!contentSnippet) {
      contentSnippet = `${file.name} (${file.sizeFormatted}) - Local file located at ${file.relativePath || file.path}`;
    }

    // Recency boost (within 90 days)
    const ageDays = (Date.now() - new Date(file.modifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) score += 5;
    else if (ageDays < 90) score += 2;

    // If no query was specified, show recent documents with base score
    if (!query || query.trim() === '') {
      score = 70;
      reasons.push('Recent document in folder');
    }

    // Only include if score > 0 or if no query was provided
    if (score > 0 || !query) {
      const normalizedScore = Math.min(99, Math.max(25, score));
      matchedDocs.push({
        id: `local:${Buffer.from(file.path).toString('base64url')}`,
        name: file.name,
        path: file.path,
        relativePath: file.relativePath,
        source: 'local',
        sourceLabel: 'Local Drive',
        fileType: file.fileType,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        sizeFormatted: file.sizeFormatted,
        modifiedAt: file.modifiedAt,
        relevanceScore: normalizedScore,
        matchReason: reasons.join(' • ') || 'Contextually relevant document',
        snippet: contentSnippet,
        wordCount,
      });
    }
  }

  // Sort by relevance score descending, then by modification date
  matchedDocs.sort((a, b) => b.relevanceScore - a.relevanceScore || new Date(b.modifiedAt) - new Date(a.modifiedAt));

  return matchedDocs.slice(0, maxResults);
}

/**
 * Read and parse a single document's text content
 * @param {string} filePath
 * @param {number} [maxCharacters=10000]
 */
export async function readLocalDocumentContent(filePath, maxCharacters = 10000) {
  const parsed = await parseDocument(filePath);
  const truncatedText = (parsed.text || '').substring(0, maxCharacters);

  return {
    filePath,
    name: path.basename(filePath),
    format: parsed.format,
    pageCount: parsed.pageCount || 1,
    wordCount: parsed.wordCount || 0,
    sizeBytes: parsed.sizeBytes || 0,
    text: truncatedText,
    isTruncated: (parsed.text || '').length > maxCharacters,
    totalCharacters: (parsed.text || '').length,
  };
}

/**
 * Extract dominant terms / keywords from a text string
 */
export function extractTopKeywords(text, count = 8) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word);
}

/**
 * Find documents related to a given document
 * @param {string} targetPath - Path to the anchor document
 * @param {object} [options]
 */
export async function findRelatedLocalDocuments(targetPath, options = {}) {
  const { maxResults = 5, directoryPath } = options;
  const targetParsed = await parseDocument(targetPath);
  const targetKeywords = extractTopKeywords(targetParsed.text || path.basename(targetPath), 12);
  const targetDir = path.dirname(targetPath);
  const targetExt = path.extname(targetPath).toLowerCase();

  const searchDirs = resolveSearchPaths(directoryPath);
  const allFiles = await crawlDirectory(searchDirs);
  const candidates = [];

  for (const file of allFiles) {
    if (path.resolve(file.path) === path.resolve(targetPath)) continue;

    let similarityScore = 20;
    const reasons = [];

    // Shared directory proximity
    if (path.dirname(file.path) === targetDir) {
      similarityScore += 15;
      reasons.push('Co-located in same folder');
    }

    // Shared format
    if (file.extension.toLowerCase() === targetExt) {
      similarityScore += 10;
      reasons.push(`Matching ${file.fileType.toUpperCase()} format`);
    }

    // Content keyword overlap
    const fileParsed = await parseDocument(file.path);
    const fileTextLower = (fileParsed.text || '').toLowerCase();
    const overlappingKeywords = [];

    for (const kw of targetKeywords) {
      if (fileTextLower.includes(kw) || file.name.toLowerCase().includes(kw)) {
        overlappingKeywords.push(kw);
      }
    }

    if (overlappingKeywords.length > 0) {
      const kwBoost = Math.min(45, overlappingKeywords.length * 9);
      similarityScore += kwBoost;
      reasons.push(`Shared topics: ${overlappingKeywords.slice(0, 3).join(', ')}`);
    }

    if (similarityScore > 35) {
      candidates.push({
        id: `local:${Buffer.from(file.path).toString('base64url')}`,
        name: file.name,
        path: file.path,
        source: 'local',
        fileType: file.fileType,
        extension: file.extension,
        sizeFormatted: file.sizeFormatted,
        modifiedAt: file.modifiedAt,
        similarityScore: Math.min(98, similarityScore),
        relationshipReason: reasons.join(' • '),
        snippet: extractSnippet(fileParsed.text || file.name, targetKeywords[0] || '', 220),
        sharedKeywords: overlappingKeywords,
      });
    }
  }

  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  return candidates.slice(0, maxResults);
}

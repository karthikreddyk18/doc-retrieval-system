import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Extract clean snippet of text around search terms
 * @param {string} text - Full document text
 * @param {string} [query] - Optional search query
 * @param {number} [snippetLength=300] - Approximate length of snippet
 * @returns {string} Formatted snippet
 */
export function extractSnippet(text, query = '', snippetLength = 300) {
  if (!text || typeof text !== 'string') return '';
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= snippetLength) return cleanText;

  if (!query || query.trim() === '') {
    return cleanText.substring(0, snippetLength) + '...';
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['and', 'for', 'the', 'with', 'from', 'this', 'that'].includes(t));

  let bestIndex = -1;
  for (const term of terms) {
    const idx = cleanText.toLowerCase().indexOf(term);
    if (idx !== -1) {
      bestIndex = idx;
      break;
    }
  }

  if (bestIndex === -1) {
    return cleanText.substring(0, snippetLength) + '...';
  }

  const start = Math.max(0, bestIndex - Math.floor(snippetLength / 3));
  const end = Math.min(cleanText.length, start + snippetLength);

  let snippet = cleanText.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < cleanText.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Parse document content from a buffer given an extension or mime-type
 * @param {Buffer} buffer
 * @param {string} extOrMime - File extension (e.g. '.pdf') or MIME type
 * @returns {Promise<{ text: string, pageCount?: number, format: string }>}
 */
export async function parseBuffer(buffer, extOrMime = '') {
  const norm = extOrMime.toLowerCase().trim();

  // PDF
  if (norm.endsWith('.pdf') || norm === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      return {
        text: data.text || '',
        pageCount: data.numpages || 1,
        format: 'pdf',
      };
    } catch (err) {
      console.warn(`[Parser] PDF parse error: ${err.message}`);
      return { text: '', pageCount: 0, format: 'pdf', error: err.message };
    }
  }

  // DOCX
  if (
    norm.endsWith('.docx') ||
    norm.includes('wordprocessingml') ||
    norm === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: result.value || '',
        format: 'docx',
      };
    } catch (err) {
      console.warn(`[Parser] DOCX parse error: ${err.message}`);
      return { text: '', format: 'docx', error: err.message };
    }
  }

  // Plain Text / Markdown / CSV / JSON
  try {
    const text = buffer.toString('utf-8');
    const format = norm.endsWith('.md') ? 'markdown' : 'text';
    return {
      text,
      format,
    };
  } catch (err) {
    return { text: '', format: 'unknown', error: err.message };
  }
}

/**
 * Parse document content from a local file path
 * @param {string} filePath - Absolute or relative file path
 * @returns {Promise<{ text: string, pageCount?: number, format: string, wordCount: number, sizeBytes: number }>}
 */
export async function parseDocument(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);

    const parsed = await parseBuffer(buffer, ext);
    const wordCount = parsed.text ? parsed.text.trim().split(/\s+/).filter(Boolean).length : 0;

    return {
      ...parsed,
      wordCount,
      sizeBytes: stats.size,
      mtime: stats.mtime,
    };
  } catch (err) {
    console.error(`[Parser] Failed to parse ${filePath}:`, err.message);
    return {
      text: '',
      wordCount: 0,
      sizeBytes: 0,
      format: 'unknown',
      error: err.message,
    };
  }
}

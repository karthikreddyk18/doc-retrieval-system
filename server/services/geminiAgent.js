import { GoogleGenAI, Type } from '@google/genai';
import { searchLocalDocuments, readLocalDocumentContent, findRelatedLocalDocuments } from './localSearch.js';
import { searchDriveDocuments, readDriveDocumentContent } from './driveSearch.js';

// Model configuration
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Initialize Google GenAI client if API key is configured
 */
function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Tool Declarations for Gemini Function Calling
 */
const functionDeclarations = [
  {
    name: 'search_local_documents',
    description: 'Search for documents on the local computer filesystem by keyword, topic, or file type (.pdf, .docx, .txt, .md).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Search keywords, document titles, or subject matter to search for.',
        },
        fileTypes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional file extension filters like ["pdf"], ["docx"], ["md"], ["txt"].',
        },
        maxResults: {
          type: Type.NUMBER,
          description: 'Maximum number of documents to return (default 8).',
        },
        directoryPath: {
          type: Type.STRING,
          description: 'Optional custom folder path to search in.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_drive_documents',
    description: 'Search for documents in connected Google Drive accounts by keyword, filename, or file format.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: 'Keywords, contract names, or topic terms to find in Google Drive.',
        },
        fileTypes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Optional filters like ["pdf"], ["docx"], ["txt"].',
        },
        accountId: {
          type: Type.STRING,
          description: 'Optional specific Google account ID to limit search to.',
        },
        maxResults: {
          type: Type.NUMBER,
          description: 'Maximum number of Drive files to return (default 8).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_document_content',
    description: 'Inspect and extract text from a specific local or Google Drive document to answer detailed questions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        source: {
          type: Type.STRING,
          description: 'Either "local" or "drive".',
        },
        idOrPath: {
          type: Type.STRING,
          description: 'Local file path or Google Drive file ID.',
        },
        maxCharacters: {
          type: Type.NUMBER,
          description: 'Maximum number of characters to extract (default 4000).',
        },
      },
      required: ['source', 'idOrPath'],
    },
  },
  {
    name: 'find_related_documents',
    description: 'Discover other documents related to a given document based on shared keywords, topics, or proximity.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetDocIdOrPath: {
          type: Type.STRING,
          description: 'Path or ID of the anchor document.',
        },
        source: {
          type: Type.STRING,
          description: '"local" or "drive".',
        },
        semanticTopic: {
          type: Type.STRING,
          description: 'Optional specific theme or domain context.',
        },
      },
      required: ['targetDocIdOrPath', 'source'],
    },
  },
];

/**
 * Execute tool calls requested by the agent
 */
async function executeToolCall(name, args, stepsTracker) {
  const stepRecord = {
    step: stepsTracker.length + 1,
    toolName: name,
    args,
    timestamp: new Date().toISOString(),
    status: 'running',
  };
  stepsTracker.push(stepRecord);

  try {
    let result;
    if (name === 'search_local_documents') {
      result = await searchLocalDocuments(args.query, {
        fileTypes: args.fileTypes,
        maxResults: args.maxResults || 8,
        directoryPath: args.directoryPath,
      });
      stepRecord.summary = `Searched local filesystem for "${args.query}" and found ${result.length} matching files`;
    } else if (name === 'search_drive_documents') {
      result = await searchDriveDocuments(args.query, {
        fileTypes: args.fileTypes,
        accountId: args.accountId,
        maxResults: args.maxResults || 8,
      });
      stepRecord.summary = `Searched Google Drive for "${args.query}" and retrieved ${result.length} files`;
    } else if (name === 'read_document_content') {
      if (args.source === 'local') {
        result = await readLocalDocumentContent(args.idOrPath, args.maxCharacters || 4000);
      } else {
        result = await readDriveDocumentContent(args.accountId, args.idOrPath);
      }
      stepRecord.summary = `Parsed content from ${result.name} (${result.wordCount} words)`;
    } else if (name === 'find_related_documents') {
      result = await findRelatedLocalDocuments(args.idOrPath || args.targetDocIdOrPath, { maxResults: 5 });
      stepRecord.summary = `Discovered ${result.length} related documents`;
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    stepRecord.status = 'completed';
    stepRecord.resultCount = Array.isArray(result) ? result.length : 1;
    return result;
  } catch (err) {
    stepRecord.status = 'error';
    stepRecord.error = err.message;
    console.error(`[GeminiAgent] Tool execution error for ${name}:`, err);
    return { error: err.message };
  }
}

/**
 * Intelligent Fallback Agent when Gemini API Key is not set or network is unavailable
 */
async function runHeuristicAgent(userQuery, options = {}, stepsTracker = []) {
  const { scope = 'all', fileTypes = [] } = options;

  stepsTracker.push({
    step: 1,
    toolName: 'intent_analysis',
    args: { query: userQuery, scope, fileTypes },
    summary: `Interpreting user intent: "${userQuery}". Target scope: ${scope.toUpperCase()}.`,
    status: 'completed',
    timestamp: new Date().toISOString(),
  });

  const retrievedDocs = [];

  // Search local if scope is all or local
  if (scope === 'all' || scope === 'local') {
    const localDocs = await executeToolCall(
      'search_local_documents',
      { query: userQuery, fileTypes, maxResults: 6 },
      stepsTracker
    );
    if (Array.isArray(localDocs)) {
      retrievedDocs.push(...localDocs);
    }
  }

  // Search drive if scope is all or drive
  if (scope === 'all' || scope === 'drive') {
    const driveDocs = await executeToolCall(
      'search_drive_documents',
      { query: userQuery, fileTypes, maxResults: 6 },
      stepsTracker
    );
    if (Array.isArray(driveDocs)) {
      retrievedDocs.push(...driveDocs);
    }
  }

  // Sort unified documents by relevance score
  retrievedDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);

  stepsTracker.push({
    step: stepsTracker.length + 1,
    toolName: 'synthesis',
    args: { totalCandidates: retrievedDocs.length },
    summary: `Unified and ranked ${retrievedDocs.length} candidate documents across active storage sources.`,
    status: 'completed',
    timestamp: new Date().toISOString(),
  });

  const topMatch = retrievedDocs[0];
  let answerSummary = '';
  if (retrievedDocs.length === 0) {
    answerSummary = `No documents directly matched your query "${userQuery}". You can try broadening your search terms or selecting "All" file formats.`;
  } else {
    answerSummary = `I discovered **${retrievedDocs.length} relevant document${retrievedDocs.length > 1 ? 's' : ''}** across your local computer and connected Google Drive accounts matching "${userQuery}". The top match is **${topMatch.name}** (${topMatch.sourceLabel}, ${topMatch.relevanceScore}% match).`;
  }

  return {
    answer: answerSummary,
    documents: retrievedDocs,
    steps: stepsTracker,
    modelUsed: 'Heuristic Intelligent Retrieval Engine (Add GEMINI_API_KEY in .env for Gemini 2.5 Flash)',
  };
}

/**
 * Main Agentic Search Function
 * @param {string} userQuery
 * @param {object} options
 */
export async function agenticSearch(userQuery, options = {}) {
  const {
    scope = 'all', // 'all' | 'local' | 'drive'
    fileTypes = [],
    directoryPath,
    accountId,
  } = options;

  const stepsTracker = [];
  const ai = getGenAIClient();

  // If no Gemini API key configured, use intelligent heuristic agent
  if (!ai) {
    console.log('[GeminiAgent] No GEMINI_API_KEY configured. Running Heuristic Intelligent Agent.');
    return runHeuristicAgent(userQuery, options, stepsTracker);
  }

  try {
    stepsTracker.push({
      step: 1,
      toolName: 'intent_analysis',
      args: { userQuery, scope, fileTypes },
      summary: `Decomposing natural language query with Gemini 2.5 Flash: "${userQuery}"`,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    const systemPrompt = `You are an expert Document Discovery and Retrieval Agent.
Your mission is to help users locate relevant documents across their local computer and connected Google Drive accounts.
User search scope: ${scope}.
Available tools:
- search_local_documents: search local computer files (.pdf, .docx, .txt, .md)
- search_drive_documents: search connected Google Drive accounts
- read_document_content: read excerpt from a specific document if needed to answer a question
- find_related_documents: discover documents related to an anchor file

Guidelines:
1. Always call the appropriate search tools based on the user's intent. If scope is 'all', search both local and drive.
2. After receiving search results, summarize your findings clearly.
3. If the user asked a specific factual question (e.g. "what were the revenues?", "who signed the NDA?"), you may use read_document_content on the top document to get the answer.`;

    // First model turn
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Search query: "${userQuery}". Storage scope: ${scope}. File type filters: ${fileTypes.join(', ') || 'Any'}. Find matching documents and provide a helpful summary.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations }],
        temperature: 0.2,
      },
    });

    const gatheredDocs = [];

    // Check if the model invoked function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const toolResultsParts = [];

      for (const call of response.functionCalls) {
        const result = await executeToolCall(call.name, call.args, stepsTracker);
        if (Array.isArray(result)) {
          gatheredDocs.push(...result);
        }

        toolResultsParts.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      }

      // Second model turn: send function execution results back to Gemini
      try {
        const followUpResponse = await ai.models.generateContent({
          model: DEFAULT_MODEL,
          contents: [
            {
              role: 'user',
              parts: [{ text: userQuery }],
            },
            {
              role: 'model',
              parts: response.functionCalls.map((fc) => ({
                functionCall: {
                  name: fc.name,
                  args: fc.args,
                },
              })),
            },
            {
              role: 'tool',
              parts: toolResultsParts,
            },
          ],
          config: {
            systemInstruction: systemPrompt,
          },
        });

        // Deduplicate and rank gathered documents
        const uniqueDocs = deduplicateDocuments(gatheredDocs);

        return {
          answer: followUpResponse.text || `Found ${uniqueDocs.length} matching documents.`,
          documents: uniqueDocs,
          steps: stepsTracker,
          modelUsed: DEFAULT_MODEL,
        };
      } catch (err) {
        console.warn('[GeminiAgent] Second turn error, synthesizing results directly:', err.message);
        const uniqueDocs = deduplicateDocuments(gatheredDocs);
        return {
          answer: `Identified ${uniqueDocs.length} matching documents across storage locations.`,
          documents: uniqueDocs,
          steps: stepsTracker,
          modelUsed: DEFAULT_MODEL,
        };
      }
    } else {
      // If the model didn't call any tools, fallback to executing search directly
      return runHeuristicAgent(userQuery, options, stepsTracker);
    }
  } catch (err) {
    console.error('[GeminiAgent] Gemini API invocation error:', err);
    // Graceful fallback to heuristic search
    return runHeuristicAgent(userQuery, options, stepsTracker);
  }
}

/**
 * Deduplicate documents by ID or path
 */
function deduplicateDocuments(docs) {
  const seen = new Set();
  const unique = [];

  for (const doc of docs) {
    const key = doc.id || doc.path || doc.name;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(doc);
    }
  }

  unique.sort((a, b) => (b.relevanceScore || 50) - (a.relevanceScore || 50));
  return unique;
}

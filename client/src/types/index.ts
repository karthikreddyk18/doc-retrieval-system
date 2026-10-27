export interface DocumentItem {
  id: string;
  name: string;
  path?: string;
  relativePath?: string;
  source: 'local' | 'drive';
  sourceLabel: string;
  fileType: 'pdf' | 'docx' | 'markdown' | 'text' | 'document';
  extension?: string;
  mimeType?: string;
  sizeBytes: number;
  sizeFormatted: string;
  modifiedAt: string;
  relevanceScore: number;
  matchReason: string;
  snippet: string;
  wordCount?: number;
  webViewLink?: string;
  accountId?: string;
  accountEmail?: string;
  similarityScore?: number;
  relationshipReason?: string;
  sharedKeywords?: string[];
}

export interface SearchStep {
  step: number;
  toolName: string;
  args: Record<string, unknown>;
  summary?: string;
  status: 'running' | 'completed' | 'error';
  resultCount?: number;
  timestamp: string;
  error?: string;
}

export interface SearchResponse {
  answer: string;
  documents: DocumentItem[];
  steps: SearchStep[];
  modelUsed: string;
  error?: string;
}

export interface GoogleAccount {
  id: string;
  email: string;
  name: string;
  picture: string;
  isDemo: boolean;
  connectedAt: string;
}

export interface SearchFilters {
  scope: 'all' | 'local' | 'drive';
  fileTypes: string[];
  directoryPath: string;
  accountId?: string;
}

export interface SystemHealth {
  status: string;
  gemini: {
    configured: boolean;
    model: string;
  };
  googleDrive: {
    oauthConfigured: boolean;
    connectedAccountsCount: number;
    tokenPersistence?: string;
  };
  searchPaths?: string[];
  localDocsRoot: string;
}

export interface DocumentContent {
  name: string;
  fileType: string;
  text: string;
  wordCount: number;
  sizeBytes: number;
  format?: string;
  pageCount?: number;
  webViewLink?: string;
  source: 'local' | 'drive';
}

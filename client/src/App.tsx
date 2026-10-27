import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Bot,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Search,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { ResultCard } from './components/ResultCard';
import { RelatedDocsDrawer } from './components/RelatedDocsDrawer';
import { DriveConnectModal } from './components/DriveConnectModal';
import {
  DocumentItem,
  SearchResponse,
  GoogleAccount,
  SystemHealth,
  SearchFilters,
  DocumentContent,
} from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drawers & Modals
  const [relatedTargetDoc, setRelatedTargetDoc] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentContent | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isStepsExpanded, setIsStepsExpanded] = useState(true);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch initial health & accounts
  const fetchHealthAndAccounts = async () => {
    try {
      const [healthRes, accountsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/auth/google/accounts'),
      ]);

      if (healthRes.ok) {
        const hData = await healthRes.json();
        setHealth(hData);
      }
      if (accountsRes.ok) {
        const aData = await accountsRes.json();
        setAccounts(aData.accounts || []);
      }
    } catch (err) {
      console.warn('Could not connect to backend server:', err);
    }
  };

  useEffect(() => {
    fetchHealthAndAccounts();

    // Check URL parameters for OAuth redirects
    const params = new URLSearchParams(window.location.search);
    const connectedAcc = params.get('connected_account');
    const authError = params.get('auth_error');

    if (connectedAcc) {
      setToastMessage(`Successfully connected Google Account: ${connectedAcc}`);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchHealthAndAccounts();
    } else if (authError) {
      setError(`Google OAuth Error: ${authError}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Auto-run initial query to showcase system immediately
    handleSearch('Find financial reports and system architecture blueprints', {
      scope: 'all',
      fileTypes: [],
      directoryPath: '',
    });
  }, []);

  const handleSearch = async (query: string, filters: SearchFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          scope: filters.scope,
          fileTypes: filters.fileTypes,
          directoryPath: filters.directoryPath,
          accountId: filters.accountId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to execute agentic document retrieval');
      }

      const data: SearchResponse = await res.json();
      setSearchResponse(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected retrieval error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewContent = async (doc: DocumentItem) => {
    setIsPreviewLoading(true);
    setPreviewDoc(null);
    try {
      const res = await fetch(
        `/api/document/content?source=${doc.source}&idOrPath=${encodeURIComponent(
          doc.path || doc.id
        )}&accountId=${doc.accountId || ''}`
      );

      if (!res.ok) {
        throw new Error('Failed to parse document content');
      }

      const data: DocumentContent = await res.json();
      setPreviewDoc(data);
    } catch (err: any) {
      setError(`Cannot read document: ${err.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCopyPreviewText = () => {
    if (previewDoc?.text) {
      navigator.clipboard.writeText(previewDoc.text);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation & Status */}
      <Header
        health={health}
        accounts={accounts}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="max-w-md mx-auto mt-4 px-4 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section & Search Bar */}
        <section className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini 2.5 Function Calling &bull; On-Demand Multi-Format Parser</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Intelligent Document Discovery
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Find documents across your local drive and connected Google Drive accounts using natural language.
          </p>

          <div className="pt-4">
            <SearchBar
              onSearch={handleSearch}
              isLoading={isLoading}
              accounts={accounts}
              defaultLocalDir={health?.localDocsRoot}
            />
          </div>
        </section>

        {/* Global Error Notice */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            <div className="flex-1">
              <p className="font-semibold">Retrieval Notice</p>
              <p className="opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Results & Agent Section */}
        {searchResponse && (
          <div className="space-y-6">
            {/* AI Agent Synthesis Box */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 border border-brand-500/30 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand-500/20 border border-brand-500/30 text-brand-300">
                    <Bot className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                      Agentic Synthesis &bull; Gemini 2.5
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Autonomous decision loop and relevance assessment
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono text-slate-400 bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800">
                  {searchResponse.documents.length} Matches Found
                </span>
              </div>

              {/* Formatted Answer */}
              <div className="text-sm text-slate-200 leading-relaxed bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80">
                {searchResponse.answer}
              </div>

              {/* Agent Execution Trace Toggle */}
              {searchResponse.steps && searchResponse.steps.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <button
                    onClick={() => setIsStepsExpanded(!isStepsExpanded)}
                    className="flex items-center gap-2 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Agent Tool Execution Trace ({searchResponse.steps.length} Steps)</span>
                    {isStepsExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Steps Accordion */}
                  {isStepsExpanded && (
                    <div className="mt-3 space-y-2">
                      {searchResponse.steps.map((st, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-xs flex items-start justify-between gap-3 font-mono"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-bold">
                                {st.step}
                              </span>
                              <span className="font-semibold text-brand-300">
                                {st.toolName}
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                {new Date(st.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-slate-300 text-xs pl-7">
                              {st.summary || JSON.stringify(st.args)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {st.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : st.status === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-rose-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                <span>Retrieved Documents ({searchResponse.documents.length})</span>
                <span>Sorted by AI Relevance Score</span>
              </div>

              {searchResponse.documents.length === 0 ? (
                <div className="py-16 text-center bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
                  <Search className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No matching documents</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try searching for keywords like "financial", "architecture", "audit", or "contract".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResponse.documents.map((doc) => (
                    <ResultCard
                      key={doc.id}
                      document={doc}
                      onSelectRelated={(target) => setRelatedTargetDoc(target)}
                      onPreviewContent={handlePreviewContent}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Slide-over Drawer for Related Documents */}
      <RelatedDocsDrawer
        targetDoc={relatedTargetDoc}
        isOpen={Boolean(relatedTargetDoc)}
        onClose={() => setRelatedTargetDoc(null)}
        onInspectDocument={(doc) => {
          setRelatedTargetDoc(null);
          handlePreviewContent(doc);
        }}
      />

      {/* Multi-Account Google Drive Modal */}
      <DriveConnectModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        accounts={accounts}
        onRefreshAccounts={fetchHealthAndAccounts}
        isOAuthConfigured={Boolean(health?.googleDrive.oauthConfigured)}
      />

      {/* Full Document Content Inspection Modal */}
      {(previewDoc || isPreviewLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm transition-opacity"
            onClick={() => setPreviewDoc(null)}
          />

          <div className="relative w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {previewDoc?.name || 'Loading Document Content...'}
                  </h3>
                  {previewDoc && (
                    <p className="text-xs text-slate-400">
                      Format: {previewDoc.fileType.toUpperCase()} &bull; {previewDoc.wordCount?.toLocaleString() || 0} words &bull; {previewDoc.sizeBytes ? `${(previewDoc.sizeBytes / 1024).toFixed(1)} KB` : 'Cloud Doc'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewDoc?.text && (
                  <button
                    onClick={handleCopyPreviewText}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                    title="Copy Full Content"
                  >
                    {copiedPreview ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copiedPreview ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                {previewDoc?.webViewLink && (
                  <a
                    href={previewDoc.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span className="hidden sm:inline">Drive</span>
                  </a>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/70">
              {isPreviewLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                  <p className="text-xs text-slate-400">Parsing and decoding document stream...</p>
                </div>
              ) : (
                previewDoc?.text || 'No text extracted from document.'
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-500">
              <span>Parsed on-demand via Node.js stream engine</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>Agentic AI Intelligent Document Discovery &bull; Powered by Gemini 2.5 Flash &amp; Google Cloud Storage Connectors</p>
      </footer>
    </div>
  );
};

export default App;

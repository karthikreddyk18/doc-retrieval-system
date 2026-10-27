import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, ArrowRight, FolderSearch, HardDrive, Cloud } from 'lucide-react';
import { GoogleAccount, SearchFilters } from '../types';

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading: boolean;
  accounts: GoogleAccount[];
  defaultLocalDir?: string;
}

const EXAMPLE_QUERIES = [
  'Find Q3 financial and revenue reports',
  'Project Alpha architecture blueprint',
  'Customer non-disclosure agreement NDA',
  'Employee handbook & remote work guidelines',
  'Security compliance audit SOC2 report',
];

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  accounts,
  defaultLocalDir = '',
}) => {
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scope, setScope] = useState<'all' | 'local' | 'drive'>('all');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [directoryPath, setDirectoryPath] = useState(defaultLocalDir);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const toggleFileType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    onSearch(query.trim(), {
      scope,
      fileTypes: selectedTypes,
      directoryPath,
      accountId: selectedAccountId || undefined,
    });
  };

  const handlePromptClick = (prompt: string) => {
    setQuery(prompt);
    onSearch(prompt, {
      scope,
      fileTypes: selectedTypes,
      directoryPath,
      accountId: selectedAccountId || undefined,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Search Input Box */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center bg-slate-900/90 border-2 border-slate-700/80 hover:border-brand-500/60 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/20 rounded-2xl shadow-2xl transition-all duration-200">
          <div className="pl-5 text-slate-400 group-focus-within:text-brand-400 transition-colors">
            <Search className="w-6 h-6" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything in natural language... e.g., 'Find all customer contracts with NDA terms'"
            disabled={isLoading}
            className="w-full py-4.5 px-4 bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none text-base sm:text-lg font-medium"
          />

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1.5 mr-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="pr-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`p-2.5 rounded-xl border transition-colors ${
                showAdvanced || selectedTypes.length > 0 || scope !== 'all'
                  ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title="Search Filters & Scope"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-lg shadow-brand-500/25 transition-all"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Retrieve</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Storage Scope Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Storage Scope
              </label>
              <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scope === 'all'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>All Sources</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('local')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scope === 'local'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Local Files</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('drive')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    scope === 'drive'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Google Drive</span>
                </button>
              </div>
            </div>

            {/* File Format Toggles */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                File Formats
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'pdf', label: 'PDF', color: 'hover:text-red-400' },
                  { id: 'docx', label: 'DOCX', color: 'hover:text-blue-400' },
                  { id: 'md', label: 'Markdown', color: 'hover:text-purple-400' },
                  { id: 'txt', label: 'Text', color: 'hover:text-slate-300' },
                ].map((type) => {
                  const isSelected = selectedTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => toggleFileType(type.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account filter if multiple drives */}
            {accounts.length > 1 && scope !== 'local' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Drive Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">All Connected Drives</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Custom local directory input */}
          {scope !== 'drive' && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
              <FolderSearch className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1">
                <input
                  type="text"
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  placeholder="Optional custom local folder path (defaults to sample-docs)"
                  className="w-full bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
              {directoryPath && (
                <button
                  type="button"
                  onClick={() => setDirectoryPath('')}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prompt Suggestions */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-slate-400 font-medium whitespace-nowrap">Try asking:</span>
        {EXAMPLE_QUERIES.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handlePromptClick(prompt)}
            disabled={isLoading}
            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 hover:border-brand-500/40 text-slate-300 hover:text-white transition-all text-xs"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};

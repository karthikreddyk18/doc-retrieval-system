import React, { useState } from 'react';
import {
  FileText,
  FileCode,
  HardDrive,
  Cloud,
  ExternalLink,
  Sparkles,
  Network,
  Eye,
  Copy,
  Check,
  Calendar,
} from 'lucide-react';
import { DocumentItem } from '../types';

interface ResultCardProps {
  document: DocumentItem;
  onSelectRelated: (doc: DocumentItem) => void;
  onPreviewContent: (doc: DocumentItem) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  document,
  onSelectRelated,
  onPreviewContent,
}) => {
  const [copied, setCopied] = useState(false);

  const getFormatBadge = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return {
          label: 'PDF',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          icon: <FileText className="w-5 h-5 text-rose-400" />,
        };
      case 'docx':
        return {
          label: 'DOCX',
          bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          icon: <FileText className="w-5 h-5 text-blue-400" />,
        };
      case 'markdown':
        return {
          label: 'MD',
          bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          icon: <FileCode className="w-5 h-5 text-purple-400" />,
        };
      default:
        return {
          label: 'TXT',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: <FileText className="w-5 h-5 text-emerald-400" />,
        };
    }
  };

  const badge = getFormatBadge(document.fileType);

  const handleCopy = () => {
    const textToCopy = document.path || document.webViewLink || document.name;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = document.modifiedAt
    ? new Date(document.modifiedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Recent';

  return (
    <div className="group relative bg-slate-900/70 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-5 transition-all duration-200 glow-card flex flex-col justify-between gap-4">
      <div className="space-y-3">
        {/* Top Header: Source badge, Format badge, Relevance score */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Source Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                document.source === 'local'
                  ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}
            >
              {document.source === 'local' ? (
                <HardDrive className="w-3.5 h-3.5" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              <span>{document.sourceLabel || (document.source === 'local' ? 'Local Drive' : 'Google Drive')}</span>
            </span>

            {/* File Type Pill */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider border ${badge.bg}`}
            >
              {badge.label}
            </span>
          </div>

          {/* Relevance Match Meter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span>{document.relevanceScore}% Match</span>
          </div>
        </div>

        {/* Title and Icon */}
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/50 flex-shrink-0 group-hover:bg-slate-800 transition-colors">
            {badge.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
              {document.name}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5" title={document.path || document.webViewLink}>
              {document.relativePath || document.path || document.webViewLink || 'Cloud Storage'}
            </p>
          </div>
        </div>

        {/* AI Match Reason Badge */}
        {document.matchReason && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">{document.matchReason}</span>
          </div>
        )}

        {/* Document Snippet / Excerpt */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 font-mono leading-relaxed line-clamp-3">
          {document.snippet}
        </div>
      </div>

      {/* Metadata & Actions Footer */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            {formattedDate}
          </span>
          <span>•</span>
          <span>{document.sizeFormatted}</span>
          {document.wordCount !== undefined && document.wordCount > 0 && (
            <>
              <span>•</span>
              <span>{document.wordCount.toLocaleString()} words</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Copy Path/Link */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Copy Document Location"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* View / Inspect Full Content */}
          <button
            onClick={() => onPreviewContent(document)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-brand-400" />
            <span>Inspect</span>
          </button>

          {/* Discover Related Documents Button */}
          <button
            onClick={() => onSelectRelated(document)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 text-brand-300 text-xs font-medium transition-colors"
          >
            <Network className="w-3.5 h-3.5 text-brand-400" />
            <span>Related</span>
          </button>

          {/* External Drive Link if applicable */}
          {document.webViewLink && (
            <a
              href={document.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Open in Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

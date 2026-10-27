import React, { useEffect, useState } from 'react';
import {
  X,
  Network,
  Sparkles,
  FileText,
  Eye,
} from 'lucide-react';
import { DocumentItem } from '../types';

interface RelatedDocsDrawerProps {
  targetDoc: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onInspectDocument: (doc: DocumentItem) => void;
}

export const RelatedDocsDrawer: React.FC<RelatedDocsDrawerProps> = ({
  targetDoc,
  isOpen,
  onClose,
  onInspectDocument,
}) => {
  const [relatedDocs, setRelatedDocs] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !targetDoc) {
      setRelatedDocs([]);
      return;
    }

    const fetchRelated = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/document/related', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetDocIdOrPath: targetDoc.path || targetDoc.id,
            source: targetDoc.source,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to retrieve related documents');
        }

        const data = await res.json();
        setRelatedDocs(data.relatedDocs || []);
      } catch (err: any) {
        setError(err.message || 'Error finding related documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelated();
  }, [isOpen, targetDoc]);

  if (!isOpen || !targetDoc) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Related Documents Discovery
                  </h2>
                  <p className="text-xs text-slate-400">
                    Content similarity, shared topics &amp; folder clustering
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Anchor Document Banner */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  Anchor Document
                </span>
                <p className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                  {targetDoc.name}
                </p>
                <p className="text-xs text-slate-500 truncate">{targetDoc.relativePath || targetDoc.path || targetDoc.sourceLabel}</p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700/60 flex-shrink-0">
                {targetDoc.fileType}
              </span>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-medium">
                  Analyzing document relationships and semantic overlap...
                </p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            ) : relatedDocs.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">No related documents found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adding more documents to the folder or connecting Google Drive to expand the semantic graph.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                  <span>Found {relatedDocs.length} Connected Documents</span>
                  <span>Ranked by Similarity</span>
                </div>

                {relatedDocs.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              doc.fileType === 'pdf'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : doc.fileType === 'docx'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {doc.fileType}
                          </span>
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-brand-300 transition-colors">
                            {doc.name}
                          </h4>
                        </div>

                        {/* Relationship Reason */}
                        {doc.relationshipReason && (
                          <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 flex-shrink-0" />
                            <span>{doc.relationshipReason}</span>
                          </p>
                        )}
                      </div>

                      {/* Similarity Score Pill */}
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-brand-500/10 border border-brand-500/30 text-brand-300 flex-shrink-0">
                        {doc.similarityScore || 75}%
                      </span>
                    </div>

                    {/* Excerpt */}
                    {doc.snippet && (
                      <p className="text-xs text-slate-400 font-mono line-clamp-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                        {doc.snippet}
                      </p>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-500">{doc.sizeFormatted}</span>

                      <button
                        onClick={() => onInspectDocument(doc)}
                        className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Document</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

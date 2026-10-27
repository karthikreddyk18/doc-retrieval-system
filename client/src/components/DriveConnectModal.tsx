import React, { useState } from 'react';
import {
  X,
  Cloud,
  Trash2,
  Plus,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { GoogleAccount } from '../types';

interface DriveConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: GoogleAccount[];
  onRefreshAccounts: () => void;
  isOAuthConfigured: boolean;
}

export const DriveConnectModal: React.FC<DriveConnectModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onRefreshAccounts,
  isOAuthConfigured,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnectOAuth = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error(data.error || 'Could not generate Google OAuth URL.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google OAuth2 flow.');
      setIsConnecting(false);
    }
  };

  const handleToggleDemoAccount = async (enable: boolean) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/google/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable }),
      });
      if (!res.ok) throw new Error('Failed to update demo account.');
      onRefreshAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/auth/google/accounts/${accountId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect account');
      onRefreshAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const hasDemoAccount = accounts.some((a) => a.isDemo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-brand-500/20 border border-amber-500/30 text-amber-400">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Google Drive Connections
              </h3>
              <p className="text-xs text-slate-400">
                Multi-account cloud document search &amp; indexing
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

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Connected Accounts List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>Connected Drives ({accounts.length})</span>
            <button
              onClick={onRefreshAccounts}
              className="text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
              <Cloud className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-medium text-slate-300">No Google Drive accounts connected</p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Connect your Google Workspace or Personal Drive to retrieve cloud files alongside local files.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 group hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {acc.picture ? (
                      <img
                        src={acc.picture}
                        alt={acc.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0">
                        {acc.name?.charAt(0) || acc.email?.charAt(0) || 'G'}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-200 truncate">{acc.name}</p>
                        {acc.isDemo ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Demo Drive
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{acc.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDisconnect(acc.id)}
                    className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Disconnect Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          {/* Real Google OAuth Button */}
          {isOAuthConfigured ? (
            <button
              onClick={handleConnectOAuth}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Connect Google Drive Account (OAuth2)</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-brand-400" />
                <span>OAuth2 Setup Notice</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                To connect real live Google accounts, configure <code className="text-brand-300">GOOGLE_CLIENT_ID</code> and <code className="text-brand-300">GOOGLE_CLIENT_SECRET</code> in <code className="text-brand-300">server/.env</code>.
              </p>
            </div>
          )}

          {/* 1-Click Demo Drive Toggle */}
          <button
            onClick={() => handleToggleDemoAccount(!hasDemoAccount)}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all ${
              hasDemoAccount
                ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-gradient-to-r from-amber-600/20 to-brand-600/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              {hasDemoAccount
                ? 'Disable Demo Cloud Drive'
                : 'Enable Demo Cloud Drive (Instant 1-Click Test)'}
            </span>
          </button>
        </div>

        {/* Footer info */}
        <p className="text-[11px] text-slate-500 text-center">
          Document parsing is done securely on-demand. Tokens are encrypted and restricted to readonly scope.
        </p>
      </div>
    </div>
  );
};

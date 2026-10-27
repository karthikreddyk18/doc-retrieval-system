import React from 'react';
import { Sparkles, HardDrive, Cloud, CheckCircle2, ChevronRight } from 'lucide-react';
import { GoogleAccount, SystemHealth } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  accounts: GoogleAccount[];
  onOpenDriveModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, accounts, onOpenDriveModal }) => {
  const isGeminiReady = health?.gemini.configured;
  const driveAccountsCount = accounts.length;

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-3 flex items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-brand-500/20 flex-shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-brand-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Document Discovery &amp; Retrieval
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                Agentic AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multi-source search across Local Filesystem and Google Drive powered by Gemini 2.5
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Gemini AI Status Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
            {isGeminiReady ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-medium">Gemini 2.5 Flash</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 font-medium">Agent Engine Active</span>
              </>
            )}
          </div>

          {/* Local Storage Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span>Local Storage</span>
          </div>

          {/* Connected Drive Accounts Button */}
          <button
            onClick={onOpenDriveModal}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
              driveAccountsCount > 0
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-brand-600/90 hover:bg-brand-500 text-white border border-brand-400/30 shadow-brand-500/20 hover:shadow-brand-500/30'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {driveAccountsCount > 0
                ? `${driveAccountsCount} Drive Account${driveAccountsCount > 1 ? 's' : ''}`
                : 'Connect Drive'}
            </span>
            <ChevronRight className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>
    </header>
  );
};

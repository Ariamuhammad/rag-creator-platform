import React from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Wallet,
  Coins,
  UserCircle,
  CreditCard,
  Terminal,
} from 'lucide-react';

export type AppViewMode = 'CLASSROOM' | 'MASTER_SILABUS' | 'STOREFRONT' | 'CREATOR_STUDIO';

interface HeaderProps {
  currentView: AppViewMode;
  onViewChange: (view: AppViewMode) => void;
  studentCredits: number;
  creatorWallet: number;
  userName: string;
  userRole: 'STUDENT' | 'CREATOR';
  onSwitchUser: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  studentCredits,
  creatorWallet,
  userName,
  userRole,
  onSwitchUser,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950 border-b border-zinc-800/80 px-4 sm:px-6 py-2.5 select-none">
      <div className="max-w-[1720px] mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Logo & Product Brand (Linear / Vercel Aesthetic - Left Column) */}
        <div className="flex items-center justify-start gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 text-zinc-100 shadow-sm shrink-0">
            <Terminal className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 text-sm tracking-tight truncate">
                EduRAG Workstation
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0 hidden sm:inline-block">
                NotebookLM + LMS
              </span>
            </div>
          </div>
        </div>

        {/* Center View Navigation Switcher (Center Column - Role Based Access) */}
        <div className="flex items-center justify-center">
          <nav className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            {userRole === 'CREATOR' ? (
              <>
                <button
                  type="button"
                  onClick={() => onViewChange('CREATOR_STUDIO')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'CREATOR_STUDIO'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Creator Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewChange('CLASSROOM')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'CLASSROOM'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
                  <span>Classroom (Preview)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewChange('MASTER_SILABUS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'MASTER_SILABUS'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Master Silabus</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onViewChange('MASTER_SILABUS')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'MASTER_SILABUS'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Master Silabus</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewChange('CLASSROOM')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'CLASSROOM'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-sky-400" />
                  <span>Classroom Workspace</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewChange('STOREFRONT')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                    currentView === 'STOREFRONT'
                      ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Paket Kursus (Xendit)</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Right Balance Indicator & Account (Right Column - Right aligned) */}
        <div className="flex items-center justify-end gap-2.5">
          {userRole === 'CREATOR' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 text-xs font-mono">
              <Wallet className="w-3.5 h-3.5" />
              <span>Rp {creatorWallet.toLocaleString('id-ID')}</span>
              <span className="text-[10px] text-zinc-500 font-sans">(80% Net)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 text-xs font-mono">
              <Coins className="w-3.5 h-3.5" />
              <span>{studentCredits.toLocaleString()} Token</span>
            </div>
          )}

          <button
            type="button"
            onClick={onSwitchUser}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs transition"
            title="Klik untuk beralih profil (Student / Creator)"
          >
            <UserCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span className="max-w-[110px] truncate text-[11px]">{userName}</span>
            <span
              className={`text-[9px] font-mono px-1 py-0.5 rounded font-semibold ${
                userRole === 'CREATOR'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {userRole === 'CREATOR' ? 'Creator' : 'Siswa'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

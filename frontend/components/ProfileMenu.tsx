"use client";

import React, { useEffect, useRef, useState } from 'react';

interface ProfileMenuProps {
  displayName: string;
  email: string;
  onLogout: () => void;
}

const getInitials = (displayName: string) => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'U';
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const ProfileMenu: React.FC<ProfileMenuProps> = ({ displayName, email, onLogout }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-left text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800/80"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-bold text-slate-950">
          {getInitials(displayName)}
        </div>
        <div className="hidden min-w-0 md:block">
          <div className="truncate text-sm font-semibold text-white">{displayName}</div>
          <div className="truncate text-xs text-slate-400">{email}</div>
        </div>
        <svg className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-64 rounded-2xl border border-slate-700/70 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
            <div className="text-sm font-semibold text-white">{displayName}</div>
            <div className="mt-1 text-xs text-slate-400">{email}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            Logout
            <span className="text-xs uppercase tracking-[0.2em] text-red-400">Exit</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
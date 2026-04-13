"use client";

import React, { useState } from 'react';

interface SignUpScreenProps {
  onSignUp: (profile: { displayName: string; email: string; password: string }) => void;
  onBackToLogin: () => void;
  existingEmails: string[];
}

const SignUpScreen: React.FC<SignUpScreenProps> = ({ onSignUp, onBackToLogin, existingEmails }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters long.');
      return;
    }

    if (!trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (existingEmails.includes(trimmedEmail)) {
      setError('This email is already registered.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    onSignUp({ displayName: trimmedName, email: trimmedEmail, password });
  };

  return (
    <main className="min-h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.22),_transparent_42%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] text-slate-100">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(rgba(148,163,184,0.12) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/50 px-4 py-2 text-xs uppercase tracking-[0.25em] text-slate-300 backdrop-blur">
              EyeGuardian Access
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Create your account to get started.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-400">
                Register a new account to access EyeGuardian. Your profile stays secure on this device.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 backdrop-blur">
                Secure password storage
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 backdrop-blur">
                Private account management
              </div>
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-4 backdrop-blur">
                Multiple user support
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center">
            <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-950/80 p-8 shadow-2xl shadow-sky-950/30 backdrop-blur-xl">
              <div className="mb-8">
                <p className="text-sm font-medium uppercase tracking-[0.3em] text-sky-400">Create Account</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Sign up for EyeGuardian</h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">Enter your details below to create a new account.</p>
              </div>

              <div className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Full name</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Alex Johnson"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="alex@company.com"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Confirm Password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                {error && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:from-sky-400 hover:to-cyan-300"
                >
                  Create Account
                </button>

                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900/60"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
};

export default SignUpScreen;

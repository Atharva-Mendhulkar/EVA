'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('EVA Client Uncaught Error:', error);
  }, [error]);

  const handleFullReset = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {}
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-zinc-800 bg-[#121216] p-6 shadow-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4 text-zinc-300">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-medium text-white mb-2 font-mono">
          Session State Disruption
        </h2>
        <p className="text-xs text-zinc-400 font-mono mb-4 leading-relaxed">
          {error?.message || 'An unexpected rendering discrepancy occurred during state hydration.'}
        </p>

        <div className="flex items-center gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-mono text-xs font-medium hover:bg-zinc-200 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <button
            type="button"
            onClick={handleFullReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-xs hover:bg-zinc-800 transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            Reset Session
          </button>
        </div>
      </div>
    </div>
  );
}

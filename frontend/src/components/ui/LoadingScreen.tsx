'use client';

import React from 'react';

interface LoadingScreenProps {
  message?: string;
  error?: string | null;
  onRetry?: () => void;
}

export function LoadingScreen({ message, error, onRetry }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2 text-white">Initializing Interview Assistant</h2>
        <p className="text-slate-300">{message || 'Setting up audio and connection...'}</p>
        {error && (
          <div className="mt-4">
            <p className="text-red-400 text-sm mb-2">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
'use client';

import React from 'react';

interface LoadingScreenProps {
  error?: string | null;
}

export function LoadingScreen({ error }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Initializing Interview Assistant</h2>
        <p className="text-muted-foreground">Setting up audio and connection...</p>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </div>
    </div>
  );
}
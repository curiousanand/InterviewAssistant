'use client';

import React from 'react';
import { StatusIndicator } from '../ui/StatusIndicator';
import { ConnectionState } from '../../types';

interface HeaderProps {
  connectionState: ConnectionState;
  onLanguageSettingsToggle: () => void;
  onClearConversation: () => void;
  messagesCount: number;
}

export function Header({ 
  connectionState, 
  onLanguageSettingsToggle, 
  onClearConversation,
  messagesCount 
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <MicrophoneIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Interview Assistant
                </h1>
                <p className="text-xs text-muted-foreground">AI-Powered Voice Assistant</p>
              </div>
            </div>
            <StatusIndicator connectionState={connectionState} />
          </div>
          
          <div className="flex items-center space-x-2">
            {messagesCount > 0 && (
              <div className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                {messagesCount} message{messagesCount !== 1 ? 's' : ''}
              </div>
            )}
            
            <button
              onClick={onLanguageSettingsToggle}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200 rounded-lg"
              title="Language Settings"
              aria-label="Language Settings"
            >
              <LanguageIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={onClearConversation}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear Conversation"
              aria-label="Clear Conversation"
              disabled={messagesCount === 0}
            >
              <ClearIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Icon components
const LanguageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" 
    />
  </svg>
);

const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 1a4 4 0 00-4 4v7a4 4 0 008 0V5a4 4 0 00-4-4zM8 12.5a7 7 0 0014 0M12 19.5v2.5m-3 0h6" 
    />
  </svg>
);

const ClearIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
    />
  </svg>
);
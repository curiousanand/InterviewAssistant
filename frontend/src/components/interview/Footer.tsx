'use client';

import React from 'react';
import { SimpleMicrophoneButton } from '../ui/SimpleMicrophoneButton';
import { ConnectionState, RecordingState } from '../../types';

interface FooterProps {
  recordingState: RecordingState;
  connectionState: ConnectionState;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearError: () => void;
}

export function Footer({
  recordingState,
  connectionState,
  error,
  onStartRecording,
  onStopRecording,
  onClearError
}: FooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center space-y-3">
          {/* Error Display */}
          {error && (
            <ErrorMessage error={error} onClear={onClearError} />
          )}

          {/* Main Microphone Control */}
          <div className="flex flex-col items-center space-y-2">
            <SimpleMicrophoneButton
              recordingState={recordingState}
              onStartRecording={onStartRecording}
              onStopRecording={onStopRecording}
              disabled={connectionState.status !== 'connected'}
            />
            
            {/* Processing Status - only show when processing but not recording */}
            {recordingState.isProcessing && !recordingState.isRecording && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Processing...</span>
              </div>
            )}
          </div>

          {/* Connection Status */}
          {connectionState.status !== 'connected' && (
            <ConnectionStatus status={connectionState.status} />
          )}

          {/* Footer Info */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {connectionState.status === 'connected' 
                ? 'Tap to speak, release to send' 
                : 'Connecting to voice assistant...'}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ErrorMessage({ error, onClear }: { error: string; onClear: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm max-w-md text-center animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between space-x-2">
        <div className="flex items-center space-x-2">
          <ErrorIcon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={onClear}
          className="text-red-500 hover:text-red-700 transition-colors p-1"
          aria-label="Clear error"
        >
          <CloseIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function ConnectionStatus({ status }: { status: string }) {
  const statusConfig: Record<string, { message: string; color: string; icon: React.ReactNode }> = {
    connecting: { 
      message: 'Connecting to voice assistant...', 
      color: 'text-blue-600', 
      icon: <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
    },
    reconnecting: { 
      message: 'Reconnecting...', 
      color: 'text-yellow-600', 
      icon: <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
    },
    disconnected: { 
      message: 'Disconnected from voice assistant', 
      color: 'text-gray-600', 
      icon: <div className="w-2 h-2 bg-gray-500 rounded-full" />
    },
    error: { 
      message: 'Connection error - please refresh', 
      color: 'text-red-600', 
      icon: <div className="w-2 h-2 bg-red-500 rounded-full" />
    }
  };

  const config = statusConfig[status] || { 
    message: status, 
    color: 'text-muted-foreground', 
    icon: <div className="w-2 h-2 bg-gray-400 rounded-full" />
  };

  return (
    <div className={`flex items-center space-x-2 text-sm ${config.color}`}>
      {config.icon}
      <span>{config.message}</span>
    </div>
  );
}

// Icon components
const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M6 18L18 6M6 6l12 12" 
    />
  </svg>
);
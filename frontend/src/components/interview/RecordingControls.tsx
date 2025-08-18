'use client';

import React from 'react';
import { SimpleMicrophoneButton } from '../ui/SimpleMicrophoneButton';
import { ConnectionState, RecordingState } from '../../types';

interface RecordingControlsProps {
  recordingState: RecordingState;
  connectionState: ConnectionState;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onClearError: () => void;
}

export function RecordingControls({
  recordingState,
  connectionState,
  error,
  onStartRecording,
  onStopRecording,
  onClearError
}: RecordingControlsProps) {
  return (
    <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center space-y-4">
          {/* Error Display */}
          {error && (
            <ErrorMessage error={error} onClear={onClearError} />
          )}

          {/* Microphone Button */}
          <SimpleMicrophoneButton
            recordingState={recordingState}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            disabled={connectionState.status !== 'connected'}
          />

          {/* Connection Status */}
          {connectionState.status !== 'connected' && (
            <ConnectionStatus status={connectionState.status} />
          )}
        </div>
    </div>
  );
}

function ErrorMessage({ error, onClear }: { error: string; onClear: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm max-w-md text-center">
      {error}
      <button
        onClick={onClear}
        className="ml-2 text-red-500 hover:text-red-700"
        aria-label="Clear error"
      >
        ✕
      </button>
    </div>
  );
}

function ConnectionStatus({ status }: { status: string }) {
  const statusMessages: Record<string, string> = {
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error'
  };

  return (
    <div className="text-sm text-muted-foreground text-center">
      {statusMessages[status] || status}
    </div>
  );
}
'use client';

import React from 'react';
import { RecordingState } from '../../types';

interface SimpleMicrophoneButtonProps {
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export function SimpleMicrophoneButton({
  recordingState,
  onStartRecording,
  onStopRecording,
  disabled = false
}: SimpleMicrophoneButtonProps) {
  
  const isRecording = recordingState?.isRecording === true;
  
  const handleAction = () => {
    if (disabled) return;
    
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAction();
    }
  };
  
  return (
    <div className="flex flex-col items-center space-y-3">
      <button
        data-testid="microphone-button"
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        onClick={handleAction}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-20 h-20 rounded-full transition-all duration-200 
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${isRecording 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
          }
        `}
        style={{ 
          backgroundColor: isRecording ? '#ef4444' : '#3b82f6',
          color: 'white' 
        }}
      >
        <div className="flex items-center justify-center text-white">
          {isRecording ? (
            // Stop icon (square)
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            // Microphone icon
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
              />
            </svg>
          )}
        </div>
      </button>
      
      <div className="text-sm font-medium">
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </div>
      
      {isRecording && (
        <div className="flex items-center space-x-2 text-xs text-red-500">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>Recording...</span>
        </div>
      )}
      
    </div>
  );
}
'use client';

import React from 'react';
import { SystemStatus } from '../../types/conversation';

interface ConversationControlsProps {
  isListening: boolean;
  isProcessing: boolean;
  systemStatus: SystemStatus;
  onStartListening: () => void;
  onStopListening: () => void;
  onInterrupt: () => void;
  canInterrupt: boolean;
}

/**
 * Modern Conversation Controls with glassmorphism design
 */
export function ConversationControls({
  isListening,
  isProcessing,
  systemStatus,
  onStartListening,
  onStopListening,
  onInterrupt,
  canInterrupt
}: ConversationControlsProps) {

  const getMicrophoneIcon = () => {
    if (isListening) {
      return (
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      );
    } else {
      return (
        <svg className="w-8 h-8 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      );
    }
  };

  const isDisconnected = systemStatus.connectionStatus === 'disconnected' || 
                        systemStatus.connectionStatus === 'error';

  return (
    <div className="fixed bottom-0 left-0 right-0 p-6">
      <div className="container mx-auto">
        <div 
          className="bg-black/20 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(30, 30, 30, 0.3) 100%)',
          }}
        >
          <div className="flex items-center justify-center space-x-8">
            {/* Main Microphone Button */}
            <div className="relative">
              <button
                data-testid="mic-button"
                onClick={isListening ? onStopListening : onStartListening}
                disabled={isDisconnected}
                className={`w-20 h-20 rounded-full flex items-center justify-center
                          transition-all duration-300 hover:scale-110 disabled:opacity-50
                          ${isListening 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse shadow-lg shadow-green-500/30' 
                            : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:shadow-lg hover:shadow-purple-500/30'
                          }`}
                title={isListening ? 'Stop Listening' : 'Start Listening'}
              >
                {getMicrophoneIcon()}
              </button>

              {/* Listening Animation */}
              {isListening && (
                <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-30 pointer-events-none" />
              )}

              {/* Connection Status Indicator */}
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                systemStatus.connectionStatus === 'connected' ? 'bg-green-400' :
                systemStatus.connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                'bg-red-400'
              }`} />
            </div>

            {/* Interrupt Button */}
            {canInterrupt && (
              <button
                onClick={onInterrupt}
                className="w-12 h-12 bg-red-500 hover:bg-red-600 text-white rounded-full
                         flex items-center justify-center transition-all duration-200
                         hover:scale-110 shadow-lg shadow-red-500/30"
                title="Interrupt AI"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>
            )}

            {/* Status Indicators */}
            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  systemStatus.connectionStatus === 'connected' ? 'bg-green-400' :
                  systemStatus.connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                  'bg-red-400'
                }`} />
                <span className="text-xs text-slate-300 capitalize">
                  {systemStatus.connectionStatus}
                </span>
              </div>

              {systemStatus.latency.totalRoundTrip > 0 && (
                <div className="text-xs text-slate-400">
                  {systemStatus.latency.totalRoundTrip}ms
                </div>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center mt-4">
            {isDisconnected ? (
              <p className="text-red-400 text-sm">
                Disconnected from server - Check your connection
              </p>
            ) : isListening ? (
              <p className="text-green-400 text-sm">
                Listening... Speak naturally
              </p>
            ) : isProcessing ? (
              <p className="text-blue-400 text-sm">
                Processing your request...
              </p>
            ) : (
              <p className="text-slate-400 text-sm">
                Click the microphone to start conversation
              </p>
            )}
          </div>

          {/* Error Display */}
          {systemStatus.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm text-center">
                {systemStatus.errors[0].message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
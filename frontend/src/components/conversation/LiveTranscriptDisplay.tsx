'use client';

import React from 'react';
import { VoiceActivityState } from '../../types/conversation';

interface LiveTranscriptDisplayProps {
  liveTranscript: string;
  confirmedTranscript: string;
  isListening: boolean;
  voiceActivity?: VoiceActivityState;
}

/**
 * Live Transcript Display with dual buffers
 */
export function LiveTranscriptDisplay({ 
  liveTranscript, 
  confirmedTranscript, 
  isListening,
  voiceActivity 
}: LiveTranscriptDisplayProps) {
  
  // Only show if there's content or actively listening
  if (!liveTranscript && !confirmedTranscript && !isListening) {
    return null;
  }

  return (
    <div className="fixed bottom-32 left-4 right-4 z-20">
      <div 
        className="bg-black/40 backdrop-blur-xl rounded-lg p-4 border border-white/10"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(30, 30, 30, 0.4) 100%)',
        }}
      >
        {/* Voice Activity Indicator */}
        {isListening && (
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              voiceActivity?.isActive ? 'bg-green-400' : 'bg-blue-400'
            }`} />
            <span className="text-xs text-slate-400">
              {voiceActivity?.isActive ? 'Speaking...' : 'Listening...'}
            </span>
          </div>
        )}

        {/* Confirmed Transcript */}
        {confirmedTranscript && (
          <div className="text-white mb-2">
            <span className="text-xs text-green-400 block mb-1">Confirmed:</span>
            <p className="leading-relaxed">{confirmedTranscript}</p>
          </div>
        )}

        {/* Live Transcript */}
        {liveTranscript && (
          <div className="text-slate-300">
            <span className="text-xs text-blue-400 block mb-1">Live:</span>
            <p className="leading-relaxed opacity-80 animate-pulse">
              {liveTranscript}
            </p>
          </div>
        )}

        {/* No content but listening */}
        {!liveTranscript && !confirmedTranscript && isListening && (
          <div className="text-slate-400 text-center py-2">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <p className="text-xs mt-2">Ready to listen...</p>
          </div>
        )}
      </div>
    </div>
  );
}
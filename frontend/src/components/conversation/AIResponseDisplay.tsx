'use client';

import React, { useEffect, useState } from 'react';

interface AIResponseDisplayProps {
  response: string;
  isThinking: boolean;
  isSpeaking: boolean;
  canInterrupt: boolean;
  onInterrupt: () => void;
}

/**
 * AI Response Display with streaming animation
 */
export function AIResponseDisplay({ 
  response, 
  isThinking, 
  isSpeaking,
  canInterrupt,
  onInterrupt 
}: AIResponseDisplayProps) {
  const [displayedResponse, setDisplayedResponse] = useState('');
  const [showInterruptButton, setShowInterruptButton] = useState(false);

  // Animate response display
  useEffect(() => {
    if (response.length > displayedResponse.length) {
      const timer = setTimeout(() => {
        setDisplayedResponse(response.slice(0, displayedResponse.length + 1));
      }, 20); // 20ms per character for smooth animation
      
      return () => clearTimeout(timer);
    }
  }, [response, displayedResponse.length]);

  // Show interrupt button after a delay
  useEffect(() => {
    if (isSpeaking || isThinking) {
      const timer = setTimeout(() => {
        setShowInterruptButton(true);
      }, 1000); // Show after 1 second
      
      return () => clearTimeout(timer);
    } else {
      setShowInterruptButton(false);
    }
  }, [isSpeaking, isThinking]);

  // Reset when new response starts
  useEffect(() => {
    if (!response) {
      setDisplayedResponse('');
    }
  }, [response]);

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-xs lg:max-w-md bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 mr-12 relative">
        {/* Thinking animation */}
        {isThinking && (
          <div className="flex items-center space-x-2 text-slate-300">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}

        {/* Streaming response */}
        {(isSpeaking || displayedResponse) && (
          <div className="text-white">
            <p className="text-sm leading-relaxed">
              {displayedResponse}
              {isSpeaking && displayedResponse === response && (
                <span className="inline-block w-1 h-4 bg-white animate-pulse ml-1" />
              )}
            </p>
          </div>
        )}

        {/* Interrupt button */}
        {canInterrupt && showInterruptButton && (isSpeaking || isThinking) && (
          <button
            onClick={onInterrupt}
            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 
                     text-white rounded-full flex items-center justify-center
                     transition-all duration-200 hover:scale-110 shadow-lg"
            title="Interrupt AI response"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        )}

        {/* Processing indicator */}
        {isSpeaking && (
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <div className="flex items-center space-x-1">
              <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
              <span>Responding...</span>
            </div>
            <span>Click to interrupt</span>
          </div>
        )}
      </div>
    </div>
  );
}
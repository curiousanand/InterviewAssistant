'use client';

import React, { useState } from 'react';
import { ContextState } from '../../types/conversation';

interface ContextIndicatorProps {
  context: ContextState;
  className?: string;
}

/**
 * Context Indicator showing conversation context and entities
 */
export function ContextIndicator({ context, className = '' }: ContextIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show if no context data
  if (!context.currentTopic && context.entities.length === 0) {
    return null;
  }

  return (
    <div className={`${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10
                   hover:bg-white/20 transition-all duration-200"
        title="Conversation Context"
      >
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span className="text-sm text-slate-300">Context</span>
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Context Panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-black/40 backdrop-blur-xl 
                       rounded-lg p-4 border border-white/10 z-50">
          
          {/* Current Topic */}
          {context.currentTopic && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2">Current Topic</h4>
              <p className="text-sm text-slate-300 bg-white/10 rounded-lg p-2">
                {context.currentTopic}
              </p>
            </div>
          )}

          {/* Entities */}
          {context.entities.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-white mb-2">
                Entities ({context.entities.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {context.entities.slice(0, 10).map((entity, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs"
                  >
                    {entity}
                  </span>
                ))}
                {context.entities.length > 10 && (
                  <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs">
                    +{context.entities.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Session Info */}
          {context.sessionContext && (
            <div>
              <h4 className="text-sm font-medium text-white mb-2">Session</h4>
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Started:</span>
                  <span>{context.sessionContext.startTime.toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages:</span>
                  <span>{context.sessionContext.messageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response:</span>
                  <span>{Math.round(context.sessionContext.averageResponseTime)}ms</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
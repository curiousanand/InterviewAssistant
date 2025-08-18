'use client';

import React from 'react';
import { StatusBarProps } from '../../types/conversation';

/**
 * Status Bar Component showing system health and errors
 */
export function StatusBar({
  systemStatus,
  conversationState,
  onClearError
}: StatusBarProps) {
  
  // Don't render if no errors and system is healthy
  const shouldShow = systemStatus.errors.length > 0 || 
                    systemStatus.connectionStatus === 'error' ||
                    systemStatus.audioStatus === 'error' ||
                    systemStatus.processingStatus === 'error';

  if (!shouldShow) return null;

  const getErrorIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
    }
  };

  const getStatusColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500/20 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-500/10';
      default:
        return 'border-blue-500/20 bg-blue-500/10';
    }
  };

  return (
    <div className="px-4 py-2 space-y-2">
      {/* System Status Errors */}
      {systemStatus.errors.map((error, index) => (
        <div
          key={`${error.timestamp.getTime()}-${index}`}
          className={`flex items-start justify-between p-3 rounded-lg border backdrop-blur-sm ${getStatusColor(error.severity)}`}
        >
          <div className="flex items-start space-x-3">
            {getErrorIcon(error.severity)}
            
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                {error.message}
              </p>
              {error.details && (
                <p className="text-xs text-slate-400 mt-1">
                  {typeof error.details === 'string' 
                    ? error.details 
                    : JSON.stringify(error.details)
                  }
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {error.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Clear Error Button */}
          <button
            onClick={() => onClearError(index)}
            className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
            title="Dismiss"
          >
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      {/* Performance Warnings */}
      {systemStatus.latency.transcription > 1000 && (
        <div className="flex items-center space-x-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 backdrop-blur-sm">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          
          <div className="flex-1">
            <p className="text-sm text-white font-medium">
              High transcription latency
            </p>
            <p className="text-xs text-slate-400">
              {systemStatus.latency.transcription}ms - Consider checking your connection
            </p>
          </div>
        </div>
      )}

      {systemStatus.latency.aiResponse > 5000 && (
        <div className="flex items-center space-x-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 backdrop-blur-sm">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          
          <div className="flex-1">
            <p className="text-sm text-white font-medium">
              Slow AI response time
            </p>
            <p className="text-xs text-slate-400">
              {systemStatus.latency.aiResponse}ms - AI service may be overloaded
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
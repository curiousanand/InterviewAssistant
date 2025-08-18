'use client';

import React from 'react';
import { ModernHeaderProps } from '../../types/conversation';

/**
 * Modern Header Component with Glassmorphism Design
 */
export function ModernHeader({
  systemStatus,
  isListening,
  onToggleSettings,
  onClearConversation,
  messagesCount
}: ModernHeaderProps) {
  
  const getConnectionIcon = () => {
    switch (systemStatus.connectionStatus) {
      case 'connected':
        return (
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        );
      case 'connecting':
        return (
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-spin" />
        );
      case 'error':
      case 'disconnected':
        return (
          <div className="w-2 h-2 bg-red-400 rounded-full" />
        );
      default:
        return (
          <div className="w-2 h-2 bg-slate-400 rounded-full" />
        );
    }
  };

  const getAudioStatusIcon = () => {
    if (isListening) {
      return (
        <svg className="w-5 h-5 text-green-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      );
    }
    
    switch (systemStatus.audioStatus) {
      case 'ready':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            <path d="M2 2l20 20-1.41 1.41L2 3.41z" stroke="currentColor" strokeWidth="1" fill="none"/>
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
          </svg>
        );
    }
  };

  return (
    <header className="relative">
      {/* Glassmorphism Background */}
      <div 
        className="backdrop-blur-xl bg-white/5 border-b border-white/10"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Interview Assistant
                </h1>
                <p className="text-sm text-slate-300">
                  Real-time Multimodal Conversation
                </p>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {getConnectionIcon()}
                <span className="text-sm text-slate-300 capitalize">
                  {systemStatus.connectionStatus}
                </span>
              </div>

              {/* Audio Status */}
              <div className="flex items-center space-x-2">
                {getAudioStatusIcon()}
                <span className="text-sm text-slate-300">
                  {isListening ? 'Listening' : 'Inactive'}
                </span>
              </div>

              {/* Latency Display */}
              {systemStatus.latency.totalRoundTrip > 0 && (
                <div className="text-sm text-slate-300">
                  <span className="text-xs opacity-60">Latency:</span>{' '}
                  {systemStatus.latency.totalRoundTrip}ms
                </div>
              )}

              {/* Message Count */}
              {messagesCount > 0 && (
                <div className="text-sm text-slate-300">
                  <span className="text-xs opacity-60">Messages:</span>{' '}
                  {messagesCount}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Clear Conversation */}
              {messagesCount > 0 && (
                <button
                  onClick={onClearConversation}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 
                           transition-all duration-200 hover:scale-105"
                  title="Clear Conversation"
                >
                  <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

              {/* Settings Toggle */}
              <button
                onClick={onToggleSettings}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 
                         transition-all duration-200 hover:scale-105"
                title="Settings"
              >
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Processing Status Bar */}
          {systemStatus.processingStatus !== 'idle' && (
            <div className="mt-4 py-2">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
                  <span className="text-sm text-slate-300 capitalize">
                    {systemStatus.processingStatus === 'thinking' && 'AI is thinking...'}
                    {systemStatus.processingStatus === 'responding' && 'AI is responding...'}
                    {systemStatus.processingStatus === 'interrupted' && 'Response interrupted'}
                    {systemStatus.processingStatus === 'error' && 'Processing error'}
                  </span>
                </div>
                
                {/* Processing Progress Bar */}
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full
                             animate-pulse transition-all duration-300"
                    style={{ width: systemStatus.processingStatus === 'responding' ? '100%' : '60%' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ambient Glow Effect */}
      <div 
        className="absolute inset-0 -z-10 opacity-20"
        style={{
          background: 'linear-gradient(90deg, rgba(147, 51, 234, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
          filter: 'blur(40px)'
        }}
      />
    </header>
  );
}
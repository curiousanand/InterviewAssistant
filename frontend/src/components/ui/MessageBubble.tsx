'use client';

import React, { useState } from 'react';
import { Message } from '../../types';

/**
 * MessageBubble - Displays individual conversation messages
 * 
 * Why: Provides consistent message display with role-based styling
 * Pattern: Presentational Component - pure UI with no business logic
 * Rationale: Reusable message display following PRD specifications
 */

interface MessageBubbleProps {
  message: Message;
  className?: string;
  showConfidence?: boolean;
  showTimestamp?: boolean;
  enableSelection?: boolean;
  onCopy?: (content: string) => void;
  maxWidth?: string;
  isStreaming?: boolean;
}

export function MessageBubble({
  message,
  className = '',
  showConfidence = false,
  showTimestamp = true,
  enableSelection = true,
  onCopy,
  maxWidth = 'max-w-3xl',
  isStreaming = false
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.content);
    } else {
      navigator.clipboard.writeText(message.content);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) {
      return timestamp.toLocaleDateString();
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const isUserMessage = message.role === 'user';
  const isPartial = message.isPartial || isStreaming;

  return (
    <div 
      className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} mb-4 ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex items-start space-x-3 ${maxWidth} w-full`}>
        {/* Assistant Avatar */}
        {!isUserMessage && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">AI</span>
          </div>
        )}

        {/* Message Content */}
        <div className={`flex-1 ${isUserMessage ? 'flex justify-end' : ''}`}>
          <div
            className={`
              relative px-4 py-3 rounded-lg transition-all duration-200 group
              ${isUserMessage 
                ? 'bg-primary text-primary-foreground ml-12 rounded-br-sm' 
                : 'bg-muted text-muted-foreground mr-12 rounded-bl-sm'
              }
              ${isPartial ? 'opacity-80' : ''}
              ${enableSelection ? 'select-text' : 'select-none'}
              ${showActions ? 'shadow-md' : ''}
            `}
          >
            {/* Content */}
            <div className="break-words whitespace-pre-wrap leading-relaxed">
              {message.content}
              {isPartial && (
                <span className="inline-block w-2 h-4 bg-current opacity-50 animate-pulse ml-1" />
              )}
            </div>

            {/* Confidence Score */}
            {showConfidence && message.confidence && message.confidence < 1 && (
              <div className="mt-2 text-xs opacity-70">
                Confidence: {Math.round(message.confidence * 100)}%
              </div>
            )}

            {/* Message Actions */}
            {showActions && (
              <div className="absolute -top-8 right-0 flex items-center space-x-1 bg-background border border-border rounded-md shadow-sm px-2 py-1">
                <button
                  onClick={handleCopy}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy message"
                >
                  <CopyIcon className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Timestamp */}
          {showTimestamp && (
            <div className={`mt-1 px-1 ${isUserMessage ? 'text-right' : 'text-left'}`}>
              <div className="text-xs text-muted-foreground">
                {formatTimestamp(message.timestamp)}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        {isUserMessage && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">U</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TypingIndicator - Shows when assistant is generating response
 */
interface TypingIndicatorProps {
  isVisible: boolean;
  className?: string;
}

export function TypingIndicator({ 
  isVisible, 
  className = '' 
}: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className={`flex justify-start mb-4 ${className}`}>
      <div className="flex items-start space-x-3 max-w-3xl w-full">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">AI</span>
        </div>

        <div className="bg-muted text-muted-foreground px-4 py-3 rounded-lg mr-12 rounded-bl-sm">
          <div className="flex items-center space-x-2">
            <span className="text-sm">Thinking</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * StreamingMessage - Shows a message that's being streamed in real-time
 */
interface StreamingMessageProps {
  content: string;
  className?: string;
}

export function StreamingMessage({ content, className = '' }: StreamingMessageProps) {
  return (
    <div className={`flex justify-start mb-4 ${className}`}>
      <div className="flex items-start space-x-3 max-w-3xl w-full">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">AI</span>
        </div>

        <div className="bg-muted text-muted-foreground px-4 py-3 rounded-lg mr-12 rounded-bl-sm opacity-90">
          <div className="break-words whitespace-pre-wrap leading-relaxed">
            {content}
            <span className="inline-block w-2 h-4 bg-current opacity-50 animate-pulse ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components
const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);
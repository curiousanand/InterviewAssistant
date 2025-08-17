'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  ConversationMessage, 
  MessageStatus,
  MessageMetadata 
} from '@/hooks/useConversation';

/**
 * MessageBubble - Displays individual conversation messages
 * 
 * Why: Provides consistent message display with role-based styling
 * Pattern: Presentational Component - pure UI with no business logic
 * Rationale: Reusable message display with rich metadata and interactions
 */

interface MessageBubbleProps {
  message: ConversationMessage;
  className?: string;
  showMetadata?: boolean;
  showTimestamp?: boolean;
  enableSelection?: boolean;
  onRetry?: () => void;
  onDelete?: () => void;
  onCopy?: (content: string) => void;
  maxWidth?: string;
}

export function MessageBubble({
  message,
  className = '',
  showMetadata = false,
  showTimestamp = true,
  enableSelection = true,
  onRetry,
  onDelete,
  onCopy,
  maxWidth = 'max-w-3xl'
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Animation effect for new messages
  useEffect(() => {
    if (message.status === MessageStatus.PARTIAL || message.status === MessageStatus.SENDING) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [message.status]);

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

  const getStatusColor = (status: MessageStatus): string => {
    switch (status) {
      case MessageStatus.SENDING:
        return 'text-blue-500';
      case MessageStatus.SENT:
        return 'text-green-500';
      case MessageStatus.DELIVERED:
        return 'text-green-600';
      case MessageStatus.FAILED:
        return 'text-red-500';
      case MessageStatus.PARTIAL:
        return 'text-yellow-500';
      case MessageStatus.PROCESSING:
        return 'text-blue-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: MessageStatus): string => {
    switch (status) {
      case MessageStatus.SENDING:
        return '⏳';
      case MessageStatus.SENT:
        return '✓';
      case MessageStatus.DELIVERED:
        return '✓✓';
      case MessageStatus.FAILED:
        return '❌';
      case MessageStatus.PARTIAL:
        return '⋯';
      case MessageStatus.PROCESSING:
        return '🔄';
      case MessageStatus.COMPLETED:
        return '✅';
      default:
        return '';
    }
  };

  const isUserMessage = message.type === 'user';
  const isSystemMessage = message.type === 'system';
  const hasError = message.status === MessageStatus.FAILED;
  const isPartial = message.status === MessageStatus.PARTIAL;

  return (
    <div 
      className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex items-start space-x-3 ${maxWidth} w-full`}>
        {/* Avatar */}
        {!isUserMessage && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">
              {isSystemMessage ? 'S' : 'AI'}
            </span>
          </div>
        )}

        {/* Message Content */}
        <div className={`flex-1 ${isUserMessage ? 'flex justify-end' : ''}`}>
          <div
            ref={bubbleRef}
            className={`
              relative px-4 py-3 rounded-lg transition-all duration-200 group
              ${isAnimating ? 'scale-105' : 'scale-100'}
              ${isUserMessage 
                ? 'bg-primary text-primary-foreground ml-12' 
                : 'bg-muted text-muted-foreground mr-12'
              }
              ${hasError ? 'border-2 border-destructive' : ''}
              ${isPartial ? 'opacity-70' : ''}
              ${enableSelection ? 'select-text' : 'select-none'}
            `}
          >
            {/* Content */}
            <div className="break-words whitespace-pre-wrap">
              {message.content}
              {isPartial && (
                <span className="inline-block w-2 h-4 bg-current opacity-50 animate-pulse ml-1" />
              )}
            </div>

            {/* Message Actions */}
            {(showActions || hasError) && (
              <div className="absolute -top-8 right-0 flex items-center space-x-1 bg-background border border-border rounded-md shadow-sm px-2 py-1">
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy message"
                >
                  <CopyIcon className="w-3 h-3" />
                </button>

                {/* Retry Button */}
                {hasError && onRetry && (
                  <button
                    onClick={onRetry}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Retry message"
                  >
                    <RetryIcon className="w-3 h-3" />
                  </button>
                )}

                {/* Delete Button */}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete message"
                  >
                    <DeleteIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Status Indicator */}
            {message.status !== MessageStatus.COMPLETED && (
              <div className={`absolute -bottom-5 ${isUserMessage ? 'right-0' : 'left-0'}`}>
                <div className="flex items-center space-x-1 text-xs">
                  <span className={getStatusColor(message.status)}>
                    {getStatusIcon(message.status)}
                  </span>
                  <span className="text-muted-foreground">
                    {message.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Timestamp and Metadata */}
          <div className={`mt-1 px-1 ${isUserMessage ? 'text-right' : 'text-left'}`}>
            {showTimestamp && (
              <div className="text-xs text-muted-foreground">
                {formatTimestamp(message.timestamp)}
              </div>
            )}

            {showMetadata && message.metadata && (
              <MessageMetadataDisplay metadata={message.metadata} />
            )}
          </div>
        </div>

        {/* User Avatar */}
        {isUserMessage && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              U
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * MessageMetadataDisplay - Shows detailed message metadata
 */
interface MessageMetadataDisplayProps {
  metadata: MessageMetadata;
}

function MessageMetadataDisplay({ metadata }: MessageMetadataDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDetails ? 'Hide' : 'Show'} details
      </button>

      {showDetails && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
          {metadata.transcriptionConfidence && (
            <div className="flex justify-between">
              <span>Transcription confidence:</span>
              <span className="font-mono">
                {Math.round(metadata.transcriptionConfidence * 100)}%
              </span>
            </div>
          )}

          {metadata.processingTime && (
            <div className="flex justify-between">
              <span>Processing time:</span>
              <span className="font-mono">{metadata.processingTime}ms</span>
            </div>
          )}

          {metadata.audioLength && (
            <div className="flex justify-between">
              <span>Audio length:</span>
              <span className="font-mono">
                {(metadata.audioLength / 1024).toFixed(1)} KB
              </span>
            </div>
          )}

          {metadata.language && (
            <div className="flex justify-between">
              <span>Language:</span>
              <span className="font-mono">{metadata.language}</span>
            </div>
          )}

          {metadata.chunkIndex !== undefined && (
            <div className="flex justify-between">
              <span>Chunk index:</span>
              <span className="font-mono">{metadata.chunkIndex}</span>
            </div>
          )}

          {metadata.errorDetails && (
            <div className="text-destructive">
              <span>Error:</span>
              <div className="font-mono text-xs mt-1 p-1 bg-destructive/10 rounded">
                {metadata.errorDetails}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * MessageBubbleGroup - Groups multiple messages from the same sender
 */
interface MessageBubbleGroupProps {
  messages: ConversationMessage[];
  showMetadata?: boolean;
  showTimestamp?: boolean;
  onRetry?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageBubbleGroup({
  messages,
  showMetadata = false,
  showTimestamp = true,
  onRetry,
  onDelete
}: MessageBubbleGroupProps) {
  if (messages.length === 0) return null;

  const firstMessage = messages[0];
  const isUserGroup = firstMessage.type === 'user';

  return (
    <div className="space-y-1">
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          showMetadata={showMetadata && index === messages.length - 1}
          showTimestamp={showTimestamp && index === messages.length - 1}
          onRetry={onRetry ? () => onRetry(message.id) : undefined}
          onDelete={onDelete ? () => onDelete(message.id) : undefined}
          className={index > 0 ? (isUserGroup ? 'mr-11' : 'ml-11') : ''}
        />
      ))}
    </div>
  );
}

/**
 * TypingIndicator - Shows when someone is typing
 */
interface TypingIndicatorProps {
  isVisible: boolean;
  sender?: string;
  className?: string;
}

export function TypingIndicator({ 
  isVisible, 
  sender = 'Assistant', 
  className = '' 
}: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className={`flex justify-start ${className}`}>
      <div className="flex items-start space-x-3 max-w-3xl w-full">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">AI</span>
        </div>

        <div className="bg-muted text-muted-foreground px-4 py-3 rounded-lg mr-12">
          <div className="flex items-center space-x-1">
            <span className="text-sm">{sender} is typing</span>
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
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

const RetryIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const DeleteIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
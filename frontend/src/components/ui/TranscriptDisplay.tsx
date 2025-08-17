'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * TranscriptDisplay - Shows live transcript with partial updates
 * 
 * Why: Provides real-time transcript feedback with confidence indicators
 * Pattern: Presentational Component - displays transcription state
 * Rationale: Shows users what's being transcribed in real-time with visual feedback
 */

interface TranscriptDisplayProps {
  partialText: string;
  finalText: string;
  confidence: number;
  isActive: boolean;
  className?: string;
  showConfidence?: boolean;
  showWordTimings?: boolean;
  maxLines?: number;
  placeholder?: string;
}

interface WordTiming {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export function TranscriptDisplay({
  partialText,
  finalText,
  confidence,
  isActive,
  className = '',
  showConfidence = true,
  showWordTimings = false,
  maxLines = 3,
  placeholder = 'Start speaking...'
}: TranscriptDisplayProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<number>(0);

  // Update display text when transcription changes
  useEffect(() => {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateRef.current;

    // Combine final and partial text
    const combinedText = finalText + (partialText ? ' ' + partialText : '');
    
    // Only update if there's a meaningful change and not too frequent
    if (combinedText !== displayText && timeSinceLastUpdate > 50) {
      setDisplayText(combinedText);
      setIsAnimating(true);
      lastUpdateRef.current = currentTime;

      // Reset animation after a short delay
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [partialText, finalText, displayText]);

  // Auto-scroll to bottom when text updates
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayText]);

  const getConfidenceColor = (conf: number): string => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (conf: number): string => {
    if (conf >= 0.8) return 'High';
    if (conf >= 0.6) return 'Medium';
    return 'Low';
  };

  const formatDisplayText = (): React.ReactNode => {
    if (!displayText.trim()) {
      return (
        <span className="text-muted-foreground italic">
          {isActive ? placeholder : 'No transcript available'}
        </span>
      );
    }

    // Split into final and partial sections
    const finalLength = finalText.length;
    const final = displayText.substring(0, finalLength);
    const partial = displayText.substring(finalLength);

    return (
      <>
        {final && (
          <span className="text-foreground">
            {final}
          </span>
        )}
        {partial && (
          <span className="text-muted-foreground italic bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded">
            {partial}
            <span className="inline-block w-1 h-4 bg-current opacity-70 animate-pulse ml-1" />
          </span>
        )}
      </>
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-sm font-medium text-foreground">
            Live Transcript
          </h3>
          
          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${
                isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
              }`}
            />
            <span className="text-xs text-muted-foreground">
              {isActive ? 'Listening' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Confidence Indicator */}
        {showConfidence && displayText.trim() && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">
              Confidence:
            </span>
            <span className={`text-xs font-medium ${getConfidenceColor(confidence)}`}>
              {getConfidenceLabel(confidence)} ({Math.round(confidence * 100)}%)
            </span>
          </div>
        )}
      </div>

      {/* Transcript Content */}
      <div
        ref={containerRef}
        className={`
          relative p-4 bg-card border border-border rounded-lg
          transition-all duration-200
          ${isAnimating ? 'ring-2 ring-primary/20' : ''}
          ${isActive ? 'border-primary/30' : ''}
        `}
        style={{ 
          maxHeight: `${maxLines * 1.5}rem`,
          minHeight: '3rem'
        }}
      >
        <div 
          className="text-sm leading-relaxed overflow-y-auto max-h-full"
          style={{ wordBreak: 'break-word' }}
        >
          {formatDisplayText()}
        </div>

        {/* Active Recording Overlay */}
        {isActive && !displayText.trim() && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm">Listening for speech...</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>
            Characters: {displayText.length}
          </span>
          <span>
            Words: {displayText.trim().split(/\s+/).filter(w => w.length > 0).length}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {finalText && (
            <button
              onClick={() => navigator.clipboard.writeText(finalText)}
              className="hover:text-foreground transition-colors"
              title="Copy final transcript"
            >
              Copy
            </button>
          )}
          
          <button
            onClick={() => setDisplayText('')}
            className="hover:text-foreground transition-colors"
            title="Clear transcript"
            disabled={!displayText.trim()}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * TranscriptWord - Individual word component with timing and confidence
 */
interface TranscriptWordProps {
  word: string;
  confidence: number;
  isPartial?: boolean;
  startTime?: number;
  endTime?: number;
  onClick?: () => void;
}

export function TranscriptWord({
  word,
  confidence,
  isPartial = false,
  startTime,
  endTime,
  onClick
}: TranscriptWordProps) {
  const getWordStyle = (): string => {
    if (isPartial) {
      return 'text-muted-foreground italic bg-yellow-100 dark:bg-yellow-900/30';
    }
    
    if (confidence >= 0.8) {
      return 'text-foreground';
    } else if (confidence >= 0.6) {
      return 'text-yellow-700 dark:text-yellow-300';
    } else {
      return 'text-red-700 dark:text-red-300 underline decoration-dotted';
    }
  };

  return (
    <span
      className={`
        inline-block px-1 py-0.5 rounded cursor-pointer transition-colors
        hover:bg-muted/50
        ${getWordStyle()}
      `}
      onClick={onClick}
      title={`Confidence: ${Math.round(confidence * 100)}%${
        startTime !== undefined ? ` | Time: ${startTime.toFixed(1)}s` : ''
      }`}
    >
      {word}
    </span>
  );
}

/**
 * TranscriptHistory - Shows historical transcript segments
 */
interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: Date;
  confidence: number;
  language?: string;
}

interface TranscriptHistoryProps {
  segments: TranscriptSegment[];
  maxSegments?: number;
  className?: string;
  onSegmentClick?: (segment: TranscriptSegment) => void;
  showTimestamps?: boolean;
}

export function TranscriptHistory({
  segments,
  maxSegments = 10,
  className = '',
  onSegmentClick,
  showTimestamps = true
}: TranscriptHistoryProps) {
  const displaySegments = segments.slice(-maxSegments);

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-foreground mb-3">
        Recent Transcripts
      </h3>
      
      {displaySegments.length === 0 ? (
        <div className="text-center text-muted-foreground py-4">
          No transcript history
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {displaySegments.map((segment) => (
            <div
              key={segment.id}
              className="p-3 bg-card border border-border rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => onSegmentClick?.(segment)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 text-sm text-foreground">
                  {segment.text}
                </div>
                
                <div className="ml-3 text-right">
                  {showTimestamps && (
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(segment.timestamp)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {Math.round(segment.confidence * 100)}%
                  </div>
                </div>
              </div>
              
              {segment.language && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Language: {segment.language}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TranscriptEditor - Allows editing and correction of transcripts
 */
interface TranscriptEditorProps {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
}

export function TranscriptEditor({
  initialText,
  onSave,
  onCancel,
  placeholder = 'Edit transcript...',
  className = ''
}: TranscriptEditorProps) {
  const [text, setText] = useState(initialText);
  const [hasChanges, setHasChanges] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHasChanges(text !== initialText);
  }, [text, initialText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(text.length, text.length);
    }
  }, []);

  const handleSave = () => {
    onSave(text.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Edit Transcript
        </label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-32 px-3 py-2 border border-input rounded-md bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {text.length} characters • Press Ctrl+Enter to save, Esc to cancel
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
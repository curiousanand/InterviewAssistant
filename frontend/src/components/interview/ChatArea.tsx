'use client';

import React, { useRef, useEffect } from 'react';
import { Message } from '../../types';
import { MessageBubble, TypingIndicator, StreamingMessage } from '../ui/MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';

interface ChatAreaProps {
  messages: Message[];
  currentTranscript: string;
  currentAssistantResponse: string;
  isProcessing: boolean;
  error: string | null;
}

export function ChatArea({
  messages,
  currentTranscript,
  currentAssistantResponse,
  isProcessing,
  error
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript, currentAssistantResponse]);

  const hasContent = messages.length > 0 || currentTranscript || currentAssistantResponse;

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto px-4 py-6 max-w-4xl min-h-full">
        {!hasContent && <WelcomeScreen error={error} />}

        {/* Messages */}
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              showConfidence={message.role === 'user'}
              showTimestamp
              enableSelection
            />
          ))}

          {/* Current Transcript (Partial) - Enhanced for visibility */}
          {currentTranscript && (
            <div className="flex justify-end mb-4">
              <div className="flex items-start space-x-3 max-w-3xl w-full">
                <div className="flex-1 flex justify-end">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-4 py-3 rounded-lg ml-12 rounded-br-sm shadow-lg border-2 border-blue-400 animate-pulse-subtle">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <div className="text-xs font-medium text-blue-100">Live Transcription</div>
                    </div>
                    <div className="break-words whitespace-pre-wrap leading-relaxed text-base">
                      {currentTranscript}
                      <span className="inline-block w-2 h-5 bg-white opacity-75 animate-pulse ml-1" />
                    </div>
                    <div className="text-xs mt-2 text-blue-100 flex items-center space-x-1">
                      <svg className="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      <span>Listening & transcribing...</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <span className="text-sm font-medium text-white">U</span>
                </div>
              </div>
            </div>
          )}

          {/* Assistant Typing Indicator */}
          {!currentAssistantResponse && isProcessing && (
            <TypingIndicator isVisible={true} />
          )}

          {/* Streaming Assistant Response */}
          {currentAssistantResponse && (
            <StreamingMessage content={currentAssistantResponse} />
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
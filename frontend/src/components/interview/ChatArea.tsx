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
    <div className="flex-1 overflow-y-auto">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
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

          {/* Current Transcript (Partial) */}
          {currentTranscript && (
            <div className="flex justify-end mb-4">
              <div className="flex items-start space-x-3 max-w-3xl w-full">
                <div className="flex-1 flex justify-end">
                  <div className="bg-primary/50 text-primary-foreground px-4 py-3 rounded-lg ml-12 rounded-br-sm opacity-80">
                    <div className="break-words whitespace-pre-wrap leading-relaxed">
                      {currentTranscript}
                      <span className="inline-block w-2 h-4 bg-current opacity-50 animate-pulse ml-1" />
                    </div>
                    <div className="text-xs mt-1 opacity-70">Speaking...</div>
                  </div>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">U</span>
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
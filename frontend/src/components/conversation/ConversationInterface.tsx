'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { ConversationInterfaceProps } from '../../types/conversation';
import { MessageBubble } from './MessageBubble';
import { LiveTranscriptDisplay } from './LiveTranscriptDisplay';
import { AIResponseDisplay } from './AIResponseDisplay';
import { ConversationControls } from './ConversationControls';
import { ContextIndicator } from './ContextIndicator';

/**
 * Modern Conversation Interface Component
 * 
 * Features:
 * - Dual transcript display (live + confirmed)
 * - Streaming AI responses with interruption
 * - Context-aware conversation history
 * - Modern glassmorphism design
 * - Real-time status indicators
 */
export function ConversationInterface({
  conversationState,
  systemStatus,
  settings,
  isListening,
  onStartListening,
  onStopListening,
  onInterruptAI
}: ConversationInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [conversationState.messages, conversationState.aiResponse]);

  // Handle interrupt on user speech
  const handleUserInterrupt = useCallback(() => {
    if (conversationState.isAiSpeaking || conversationState.isAiThinking) {
      onInterruptAI();
    }
  }, [conversationState.isAiSpeaking, conversationState.isAiThinking, onInterruptAI]);

  // Detect user speech during AI response for interruption
  useEffect(() => {
    if (conversationState.liveTranscript && 
        (conversationState.isAiSpeaking || conversationState.isAiThinking)) {
      // User started speaking while AI is responding - interrupt
      handleUserInterrupt();
    }
  }, [conversationState.liveTranscript, conversationState.isAiSpeaking, conversationState.isAiThinking, handleUserInterrupt]);

  return (
    <div className="h-full flex flex-col relative">
      {/* Context Indicator */}
      <ContextIndicator 
        context={conversationState.context}
        className="absolute top-4 right-4 z-10"
      />

      {/* Main Conversation Area */}
      <div 
        ref={conversationAreaRef}
        data-testid="chat-window"
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(30, 41, 59, 0.2) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      >
        {/* Welcome Message */}
        {conversationState.messages.length === 0 && (
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Ready to Assist
              </h3>
              <p className="text-slate-300">
                I&apos;m listening and ready to help with real-time conversation. 
                Start speaking to begin our interactive session.
              </p>
            </div>
          </div>
        )}

        {/* Conversation Messages */}
        <div className="space-y-4">
          {conversationState.messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLatest={index === conversationState.messages.length - 1}
              showConfidence={settings.uiSettings.showConfidenceScores}
            />
          ))}

          {/* Live AI Response */}
          {(conversationState.isAiThinking || conversationState.isAiSpeaking || conversationState.aiResponse) && (
            <AIResponseDisplay
              response={conversationState.aiResponse}
              isThinking={conversationState.isAiThinking}
              isSpeaking={conversationState.isAiSpeaking}
              canInterrupt={settings.uiSettings.enableInterruptions}
              onInterrupt={handleUserInterrupt}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Live Transcript Overlay */}
      {settings.uiSettings.showLiveTranscript && (
        <LiveTranscriptDisplay
          liveTranscript={conversationState.liveTranscript}
          confirmedTranscript={conversationState.confirmedTranscript}
          isListening={isListening}
          voiceActivity={conversationState.voiceActivity}
        />
      )}

      {/* Conversation Controls */}
      <ConversationControls
        isListening={isListening}
        isProcessing={conversationState.isAiThinking || conversationState.isAiSpeaking}
        systemStatus={systemStatus}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
        onInterrupt={handleUserInterrupt}
        canInterrupt={conversationState.isAiSpeaking || conversationState.isAiThinking}
      />
    </div>
  );
}
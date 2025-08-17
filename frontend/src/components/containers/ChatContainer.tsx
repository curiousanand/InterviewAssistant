'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConversation } from '@/hooks/useConversation';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useTranscription } from '@/hooks/useTranscription';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { ConversationOrchestrator } from '@/services/ConversationOrchestrator';
import { 
  ConversationMessage, 
  ConversationSettings, 
  ConversationError,
  MessageStatus 
} from '@/hooks/useConversation';

/**
 * ChatContainer - Main container orchestrating chat functionality
 * 
 * Why: Coordinates all chat-related services and state management
 * Pattern: Container Component - manages business logic and state
 * Rationale: Provides centralized control for the entire chat experience
 */

interface ChatContainerProps {
  initialSettings?: Partial<ConversationSettings>;
  className?: string;
  onError?: (error: ConversationError) => void;
  onMessageSent?: (message: ConversationMessage) => void;
  onResponseReceived?: (message: ConversationMessage) => void;
  enableAutoScroll?: boolean;
  maxMessages?: number;
}

interface ChatState {
  isInitialized: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  currentInput: string;
  inputMode: 'text' | 'voice';
  showTranscript: boolean;
}

export function ChatContainer({
  initialSettings = {},
  className = '',
  onError,
  onMessageSent,
  onResponseReceived,
  enableAutoScroll = true,
  maxMessages = 100
}: ChatContainerProps) {
  // State management
  const [chatState, setChatState] = useState<ChatState>({
    isInitialized: false,
    isRecording: false,
    isProcessing: false,
    currentInput: '',
    inputMode: 'text',
    showTranscript: true
  });

  // Refs for stable references
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<ConversationOrchestrator | null>(null);
  const lastMessageCountRef = useRef<number>(0);

  // WebSocket connection
  const webSocketConnection = useWebSocketConnection({
    url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream',
    autoConnect: true,
    autoReconnect: true,
    onError: (error) => {
      console.error('WebSocket error:', error);
      onError?.({
        type: 'connection_failed',
        message: error.message,
        timestamp: new Date(),
        recoverable: error.recoverable,
        context: error
      });
    }
  });

  // Conversation management
  const conversation = useConversation(webSocketConnection.client!, {
    persistToLocalStorage: true,
    autoStartSession: true,
    defaultSettings: {
      language: 'en-US',
      autoDetectLanguage: true,
      enableTranscription: true,
      enableAudioResponse: false,
      maxMessageHistory: maxMessages,
      summarizationThreshold: 50,
      ...initialSettings
    }
  });

  // Transcription management
  const transcription = useTranscription({
    webSocketClient: webSocketConnection.client!,
    settings: {
      language: conversation.state.settings.language,
      autoDetectLanguage: conversation.state.settings.autoDetectLanguage,
      enableInterimResults: true,
      enableWordConfidence: true,
      punctuation: true
    },
    onPartialResult: (result) => {
      setChatState(prev => ({ ...prev, currentInput: result.text }));
    },
    onFinalResult: (result) => {
      if (result.text.trim()) {
        handleTextInput(result.text);
      }
    },
    onError: (error) => {
      console.error('Transcription error:', error);
      onError?.({
        type: 'transcription_failed',
        message: error.message,
        timestamp: error.timestamp,
        recoverable: error.recoverable
      });
    }
  });

  // Audio recording management
  const audioRecording = useAudioRecording({
    onAudioData: (data) => {
      // Audio data is automatically handled by the WebSocket client
      // This could be used for visualization or additional processing
    },
    onError: (error) => {
      console.error('Audio recording error:', error);
      setChatState(prev => ({ ...prev, isRecording: false }));
      onError?.({
        type: 'audio_error',
        message: error.message,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  });

  // Initialize orchestrator
  useEffect(() => {
    if (webSocketConnection.client && !orchestratorRef.current) {
      orchestratorRef.current = new ConversationOrchestrator(
        webSocketConnection.client,
        {
          autoTranscription: true,
          autoResponse: true,
          maxRetries: 3,
          timeoutMs: 30000,
          enableStatistics: true
        },
        {
          onError: (error) => {
            console.error('Orchestrator error:', error);
            onError?.(error);
          },
          onMessageAdded: (message) => {
            if (message.type === 'user') {
              onMessageSent?.(message);
            } else if (message.type === 'assistant') {
              onResponseReceived?.(message);
            }
          },
          onResponseCompleted: () => {
            setChatState(prev => ({ ...prev, isProcessing: false }));
          }
        }
      );
    }
  }, [webSocketConnection.client, onError, onMessageSent, onResponseReceived]);

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      try {
        if (webSocketConnection.isConnected && !chatState.isInitialized) {
          await conversation.actions.startConversation();
          setChatState(prev => ({ ...prev, isInitialized: true }));
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        onError?.({
          type: 'connection_failed',
          message: `Failed to initialize chat: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        });
      }
    };

    initializeChat();
  }, [webSocketConnection.isConnected, conversation.actions, chatState.isInitialized, onError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (enableAutoScroll && conversation.state.messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = conversation.state.messages.length;
    }
  }, [conversation.state.messages.length, enableAutoScroll]);

  // Handler functions
  const handleTextInput = useCallback(async (text: string) => {
    if (!text.trim() || chatState.isProcessing) return;

    try {
      setChatState(prev => ({ ...prev, isProcessing: true, currentInput: '' }));
      await conversation.actions.sendMessage(text, 'text');
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatState(prev => ({ ...prev, isProcessing: false }));
      onError?.({
        type: 'message_send_failed',
        message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [chatState.isProcessing, conversation.actions, onError]);

  const handleVoiceInput = useCallback(async () => {
    if (chatState.isRecording) {
      // Stop recording
      try {
        await audioRecording.stopRecording();
        transcription.stopTranscription();
        setChatState(prev => ({ ...prev, isRecording: false }));
      } catch (error) {
        console.error('Failed to stop recording:', error);
        setChatState(prev => ({ ...prev, isRecording: false }));
      }
    } else {
      // Start recording
      try {
        setChatState(prev => ({ ...prev, isRecording: true, inputMode: 'voice' }));
        await audioRecording.startRecording();
        transcription.startTranscription();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setChatState(prev => ({ ...prev, isRecording: false }));
        onError?.({
          type: 'audio_error',
          message: `Failed to start voice recording: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        });
      }
    }
  }, [chatState.isRecording, audioRecording, transcription, onError]);

  const handleInputModeToggle = useCallback(() => {
    setChatState(prev => ({
      ...prev,
      inputMode: prev.inputMode === 'text' ? 'voice' : 'text'
    }));
  }, []);

  const handleClearConversation = useCallback(() => {
    conversation.actions.clearHistory();
    setChatState(prev => ({ ...prev, currentInput: '' }));
  }, [conversation.actions]);

  const handleRetryMessage = useCallback(async (messageId: string) => {
    try {
      await conversation.actions.retryMessage(messageId);
    } catch (error) {
      console.error('Failed to retry message:', error);
      onError?.({
        type: 'message_send_failed',
        message: `Failed to retry message: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [conversation.actions, onError]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    conversation.actions.deleteMessage(messageId);
  }, [conversation.actions]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Status calculations
  const connectionStatus = webSocketConnection.state;
  const isConnected = webSocketConnection.isConnected;
  const hasError = conversation.state.error || webSocketConnection.error || transcription.error;
  const isLoading = conversation.state.isLoading || chatState.isProcessing;

  return (
    <div className={`flex flex-col h-full bg-background ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-foreground">
              Interview Assistant
            </h1>
            <div className="flex items-center space-x-2">
              {/* Connection Status */}
              <div 
                className={`w-2 h-2 rounded-full ${
                  isConnected 
                    ? 'bg-green-500' 
                    : webSocketConnection.isConnecting 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500'
                }`}
                title={`Connection: ${connectionStatus}`}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Language Display */}
            <span className="text-sm text-muted-foreground">
              {conversation.state.settings.language}
            </span>
            
            {/* Clear Button */}
            <button
              onClick={handleClearConversation}
              className="px-3 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={conversation.state.messages.length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Error Display */}
        {hasError && (
          <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="text-sm text-destructive">
              {hasError.message}
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {conversation.state.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Welcome to Interview Assistant</p>
              <p className="text-sm">
                Start a conversation by typing a message or using voice input
              </p>
            </div>
          </div>
        ) : (
          <>
            {conversation.state.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onRetry={message.status === MessageStatus.FAILED ? () => handleRetryMessage(message.id) : undefined}
                onDelete={() => handleDeleteMessage(message.id)}
                showMetadata={true}
              />
            ))}
            
            {/* Loading indicator for processing messages */}
            {isLoading && (
              <div className="flex justify-center">
                <div className="flex items-center space-x-2 text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Processing...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Transcript Display */}
      {chatState.showTranscript && chatState.inputMode === 'voice' && (
        <div className="flex-shrink-0 border-t border-border p-4 bg-muted/30">
          <TranscriptDisplay
            partialText={transcription.partialTranscription}
            finalText={transcription.finalTranscription}
            confidence={transcription.confidence}
            isActive={chatState.isRecording}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-border p-4">
        <div className="flex items-end space-x-3">
          {/* Text Input */}
          {chatState.inputMode === 'text' && (
            <div className="flex-1">
              <textarea
                value={chatState.currentInput}
                onChange={(e) => setChatState(prev => ({ ...prev, currentInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextInput(chatState.currentInput);
                  }
                }}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                className="w-full min-h-[44px] max-h-32 px-3 py-2 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading || !isConnected}
                rows={1}
              />
            </div>
          )}

          {/* Voice Input Indicator */}
          {chatState.inputMode === 'voice' && (
            <div className="flex-1 flex items-center justify-center py-3">
              <MicrophoneVisualizer
                isRecording={chatState.isRecording}
                audioLevel={0.5} // This would come from audio recording hook
                className="h-12"
              />
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center space-x-2">
            {/* Input Mode Toggle */}
            <button
              onClick={handleInputModeToggle}
              className={`p-2 rounded-md transition-colors ${
                chatState.inputMode === 'voice'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              title={`Switch to ${chatState.inputMode === 'text' ? 'voice' : 'text'} input`}
            >
              {chatState.inputMode === 'text' ? (
                <MicIcon className="w-4 h-4" />
              ) : (
                <KeyboardIcon className="w-4 h-4" />
              )}
            </button>

            {/* Send/Record Button */}
            {chatState.inputMode === 'text' ? (
              <button
                onClick={() => handleTextInput(chatState.currentInput)}
                disabled={!chatState.currentInput.trim() || isLoading || !isConnected}
                className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Send message"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleVoiceInput}
                disabled={!isConnected}
                className={`p-2 rounded-md transition-colors ${
                  chatState.isRecording
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
                title={chatState.isRecording ? 'Stop recording' : 'Start recording'}
              >
                {chatState.isRecording ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <MicIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>
              Messages: {conversation.state.messages.length}
            </span>
            {transcription.statistics.totalResults > 0 && (
              <span>
                Confidence: {Math.round(transcription.statistics.averageConfidence * 100)}%
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {conversation.state.sessionId && (
              <span title={`Session: ${conversation.state.sessionId}`}>
                Connected
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components (these would typically come from a library like lucide-react)
const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const KeyboardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const StopIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

// Import placeholder components (these will be implemented in the next steps)
import { MessageBubble } from '@/components/ui/MessageBubble';
import { TranscriptDisplay } from '@/components/ui/TranscriptDisplay';
import { MicrophoneVisualizer } from '@/components/ui/MicrophoneVisualizer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
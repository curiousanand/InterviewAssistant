'use client';

import React, { useEffect, useState, useRef } from 'react';
import { InterviewWebSocketClient } from '../lib/websocket/InterviewWebSocketClient';
import { AudioStreamingService } from '../lib/services/AudioStreamingService';
import { ConversationService } from '../lib/services/ConversationService';
import { MessageBubble, TypingIndicator, StreamingMessage } from '../components/ui/MessageBubble';
import { SimpleMicrophoneButton } from '../components/ui/SimpleMicrophoneButton';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { 
  Message, 
  Session, 
  ConnectionState, 
  RecordingState
} from '../types';

/**
 * Main Interview Assistant application page
 * 
 * Why: Orchestrates the entire real-time conversation experience
 * Pattern: Container Component - manages state and service coordination
 * Rationale: Implements PRD requirements for complete user experience
 */
export default function HomePage() {
  // Services
  const [wsClient] = useState(() => new InterviewWebSocketClient());
  const [audioService] = useState(() => new AudioStreamingService(wsClient));
  const [conversationService] = useState(() => new ConversationService(wsClient));

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0
  });
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    error: null
  });
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentAssistantResponse, setCurrentAssistantResponse] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Setup event handlers
        setupEventHandlers();

        // Connect to WebSocket
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream';
        await wsClient.connect(wsUrl);

        // Initialize audio streaming
        await audioService.initialize();

        // Initialize basic services first
        setIsInitialized(true);
        setError(null);

        // Create conversation session (non-blocking)
        try {
          await conversationService.createSession(selectedLanguage, autoDetectLanguage);
        } catch (sessionError) {
          console.warn('Session creation failed, will retry on first interaction:', sessionError);
          // Don't fail initialization for session creation issues
        }

      } catch (error) {
        console.error('Failed to initialize application:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize');
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  // Setup event handlers for all services
  const setupEventHandlers = () => {
    // WebSocket connection events
    wsClient.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    wsClient.onErrorOccurred((error) => {
      setError(error);
    });

    // Audio streaming events
    audioService.onRecordingStateChange((state) => {
      console.log('Page received recording state change:', {
        newState: state,
        timestamp: new Date().toISOString()
      });
      setRecordingState(prevState => {
        console.log('State update comparison:', {
          prevState,
          newState: state,
          isChanged: JSON.stringify(prevState) !== JSON.stringify(state)
        });
        return state;
      });
    });

    audioService.onErrorOccurred((error) => {
      setError(error);
    });

    // Conversation events
    conversationService.onSessionStateChange((session) => {
      setCurrentSession(session);
    });

    conversationService.onConversationChange((messages) => {
      setMessages(messages);
    });

    conversationService.onTranscriptReceived((transcript, isFinal) => {
      if (isFinal) {
        setCurrentTranscript('');
      } else {
        setCurrentTranscript(transcript);
      }
    });

    conversationService.onAssistantResponseReceived((response, isComplete) => {
      if (isComplete) {
        setCurrentAssistantResponse('');
      } else {
        setCurrentAssistantResponse(response);
      }
    });

    conversationService.onErrorOccurred((error) => {
      setError(error);
    });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript, currentAssistantResponse]);

  // Handle language change
  const handleLanguageChange = async (languageCode: string) => {
    setSelectedLanguage(languageCode);
    
    if (currentSession) {
      try {
        // Create new session with new language
        await conversationService.createSession(languageCode, autoDetectLanguage);
      } catch (error) {
        console.error('Failed to update language:', error);
        setError('Failed to update language setting');
      }
    }
  };

  // Handle recording controls
  const handleStartRecording = async () => {
    try {
      // Check connection state first
      if (connectionState.status !== 'connected') {
        console.log('Cannot start recording: not connected');
        setError('Cannot start recording: not connected to server');
        return;
      }
      
      // Ensure we have a session before recording
      if (!currentSession) {
        console.log('No session found, creating one before recording...');
        await conversationService.createSession(selectedLanguage, autoDetectLanguage);
      }
      
      console.log('Starting recording with connection state:', connectionState.status);
      
      // Manually set recording state to true immediately
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null
      }));
      
      await audioService.startRecording();
      setError(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      // Manually set recording state to false immediately
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        audioLevel: 0
      }));
      
      await audioService.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to stop recording');
    }
  };

  // Handle clear conversation
  const handleClearConversation = () => {
    conversationService.clearConversation();
    setCurrentTranscript('');
    setCurrentAssistantResponse('');
    setError(null);
  };

  // Cleanup function
  const cleanup = async () => {
    try {
      await audioService.cleanup();
      conversationService.cleanup();
      wsClient.disconnect();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Initializing Interview Assistant</h2>
          <p className="text-muted-foreground">Setting up audio and connection...</p>
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Interview Assistant</h1>
              <StatusIndicator connectionState={connectionState} />
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowLanguageSettings(!showLanguageSettings)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Language Settings"
              >
                <LanguageIcon className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleClearConversation}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear Conversation"
                disabled={messages.length === 0}
              >
                <ClearIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Language Settings Panel */}
          {showLanguageSettings && (
            <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
                autoDetectLanguage={autoDetectLanguage}
                onAutoDetectChange={setAutoDetectLanguage}
                variant="dropdown"
                searchable
                showFlags
                showNativeNames
                className="max-w-md"
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* Welcome Message */}
            {messages.length === 0 && !currentTranscript && !currentAssistantResponse && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Welcome to Interview Assistant</h2>
                <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Start a conversation by clicking the microphone button. I can help you with questions, 
                  provide information, and assist with interview preparation in multiple languages.
                </p>
                {error && error.includes('microphone') && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
                    <p className="text-blue-800 text-sm">
                      <strong>Microphone Access:</strong> Please allow microphone access when prompted by your browser. 
                      If blocked, click the 🔒 icon in your address bar to enable microphone permissions.
                      <br />
                      <em>Note: The demo will work with simulated audio if microphone access is unavailable.</em>
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
                  <div className="p-4 border border-border rounded-lg">
                    <div className="text-lg mb-2">🎙️</div>
                    <div className="font-medium">Voice Input</div>
                    <div className="text-muted-foreground">Real-time speech recognition</div>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <div className="text-lg mb-2">🤖</div>
                    <div className="font-medium">AI Responses</div>
                    <div className="text-muted-foreground">Intelligent context-aware answers</div>
                  </div>
                  <div className="p-4 border border-border rounded-lg">
                    <div className="text-lg mb-2">🌍</div>
                    <div className="font-medium">Multilingual</div>
                    <div className="text-muted-foreground">Support for 15+ languages</div>
                  </div>
                </div>
              </div>
            )}

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
              {!currentAssistantResponse && recordingState.isProcessing && (
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

        {/* Recording Controls */}
        <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-md text-sm max-w-md text-center">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Microphone Button */}
              <SimpleMicrophoneButton
                recordingState={recordingState}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                disabled={connectionState.status !== 'connected'}
              />
              
              {/* Force Re-render Trigger */}
              <div style={{ display: 'none' }}>{JSON.stringify(recordingState)}</div>
              
              {/* Debug Info */}
              <div className="text-xs text-gray-500 mt-2 text-center">
                Connection: {connectionState.status} | Recording: {recordingState.isRecording ? 'Yes' : 'No'} | Processing: {recordingState.isProcessing ? 'Yes' : 'No'}
              </div>

              {/* Connection Status */}
              {connectionState.status !== 'connected' && (
                <div className="text-sm text-muted-foreground text-center">
                  {connectionState.status === 'connecting' && 'Connecting...'}
                  {connectionState.status === 'reconnecting' && 'Reconnecting...'}
                  {connectionState.status === 'disconnected' && 'Disconnected'}
                  {connectionState.status === 'error' && 'Connection Error'}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Icon components
const LanguageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  </svg>
);

const ClearIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
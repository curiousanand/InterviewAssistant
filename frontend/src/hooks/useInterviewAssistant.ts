'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { InterviewWebSocketClient } from '../lib/websocket/InterviewWebSocketClient';
import { AudioStreamingService } from '../lib/services/AudioStreamingService';
import { ConversationService } from '../lib/services/ConversationService';
import { 
  Message, 
  Session, 
  ConnectionState, 
  RecordingState 
} from '../types';

/**
 * Custom hook for managing Interview Assistant state and services
 * Centralizes all state management and service coordination
 */
export function useInterviewAssistant() {
  // Services (singleton instances)
  const wsClientRef = useRef<InterviewWebSocketClient>();
  const audioServiceRef = useRef<AudioStreamingService>();
  const conversationServiceRef = useRef<ConversationService>();

  // Core state
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
  const [error, setError] = useState<string | null>(null);

  // Initialize services once
  useEffect(() => {
    if (!wsClientRef.current) {
      wsClientRef.current = new InterviewWebSocketClient();
      audioServiceRef.current = new AudioStreamingService(wsClientRef.current);
      conversationServiceRef.current = new ConversationService(wsClientRef.current);
    }
  }, []);

  // Initialize application
  const initialize = useCallback(async (language: string = 'en-US', autoDetect: boolean = true) => {
    if (!wsClientRef.current || !audioServiceRef.current || !conversationServiceRef.current) {
      return;
    }

    try {
      // Setup event handlers
      setupEventHandlers();

      // Connect to WebSocket
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream';
      await wsClientRef.current.connect(wsUrl);

      // Initialize audio streaming
      await audioServiceRef.current.initialize();

      setIsInitialized(true);
      setError(null);

      // Create initial session (non-blocking)
      try {
        await conversationServiceRef.current.createSession(language, autoDetect);
      } catch (sessionError) {
        console.warn('Session creation failed, will retry on first interaction:', sessionError);
      }
    } catch (error) {
      console.error('Failed to initialize application:', error);
      setError(error instanceof Error ? error.message : 'Failed to initialize');
      throw error;
    }
  }, []);

  // Setup event handlers
  const setupEventHandlers = useCallback(() => {
    if (!wsClientRef.current || !audioServiceRef.current || !conversationServiceRef.current) {
      return;
    }

    // WebSocket connection events
    wsClientRef.current.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    wsClientRef.current.onErrorOccurred((error) => {
      setError(error);
    });

    // Audio streaming events  
    audioServiceRef.current.onRecordingStateChange((state) => {
      setRecordingState(state);
    });

    audioServiceRef.current.onErrorOccurred((error) => {
      setError(error);
    });

    // Conversation events
    conversationServiceRef.current.onSessionStateChange((session) => {
      setCurrentSession(session);
    });

    conversationServiceRef.current.onConversationChange((messages) => {
      setMessages(messages);
    });

    conversationServiceRef.current.onTranscriptReceived((transcript, isFinal) => {
      if (isFinal) {
        setCurrentTranscript('');
      } else {
        setCurrentTranscript(transcript);
      }
    });

    conversationServiceRef.current.onAssistantResponseReceived((response, isComplete) => {
      if (isComplete) {
        setCurrentAssistantResponse('');
      } else {
        setCurrentAssistantResponse(response);
      }
    });

    conversationServiceRef.current.onErrorOccurred((error) => {
      setError(error);
    });
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!audioServiceRef.current || !conversationServiceRef.current) {
      throw new Error('Services not initialized');
    }

    if (connectionState.status !== 'connected') {
      setError('Cannot start recording: not connected to server');
      return;
    }

    try {
      // Ensure session exists
      if (!currentSession) {
        await conversationServiceRef.current.createSession('en-US', true);
      }

      // Update state immediately for responsive UI
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null
      }));

      await audioServiceRef.current.startRecording();
      setError(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setError(errorMessage);
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [connectionState.status, currentSession]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!audioServiceRef.current) {
      return;
    }

    try {
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        audioLevel: 0
      }));

      await audioServiceRef.current.stopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to stop recording');
    }
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    if (conversationServiceRef.current) {
      conversationServiceRef.current.clearConversation();
    }
    setCurrentTranscript('');
    setCurrentAssistantResponse('');
    setError(null);
  }, []);

  // Change language
  const changeLanguage = useCallback(async (languageCode: string, autoDetect: boolean = true) => {
    if (!conversationServiceRef.current) {
      return;
    }

    try {
      await conversationServiceRef.current.createSession(languageCode, autoDetect);
      setError(null);
    } catch (error) {
      console.error('Failed to update language:', error);
      setError('Failed to update language setting');
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(async () => {
    try {
      if (audioServiceRef.current) {
        await audioServiceRef.current.cleanup();
      }
      if (conversationServiceRef.current) {
        conversationServiceRef.current.cleanup();
      }
      if (wsClientRef.current) {
        wsClientRef.current.disconnect();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }, []);

  return {
    // State
    isInitialized,
    connectionState,
    recordingState,
    currentSession,
    messages,
    currentTranscript,
    currentAssistantResponse,
    error,

    // Actions
    initialize,
    startRecording,
    stopRecording,
    clearConversation,
    changeLanguage,
    setError,
    cleanup
  };
}
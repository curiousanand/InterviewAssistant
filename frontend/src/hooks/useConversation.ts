import { useState, useEffect, useCallback, useRef } from 'react';
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * Conversation state management hook
 * 
 * Why: Centralizes conversation logic in reusable hook
 * Pattern: Custom Hook - encapsulates stateful conversation logic
 * Rationale: Provides clean API for managing conversation state and history
 */

/**
 * Message types for conversation
 */
export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: MessageStatus;
  metadata?: MessageMetadata;
}

export enum MessageStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export interface MessageMetadata {
  audioLength?: number;
  transcriptionConfidence?: number;
  processingTime?: number;
  errorDetails?: string;
  chunkIndex?: number;
  isComplete?: boolean;
  language?: string;
}

/**
 * Conversation state
 */
export interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessage[];
  isActive: boolean;
  isLoading: boolean;
  error: ConversationError | null;
  statistics: ConversationStatistics;
  settings: ConversationSettings;
}

export interface ConversationError {
  type: ConversationErrorType;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  context?: any;
}

export enum ConversationErrorType {
  CONNECTION_FAILED = 'connection_failed',
  MESSAGE_SEND_FAILED = 'message_send_failed',
  TRANSCRIPTION_FAILED = 'transcription_failed',
  AI_RESPONSE_FAILED = 'ai_response_failed',
  SESSION_EXPIRED = 'session_expired',
  RATE_LIMITED = 'rate_limited',
  UNKNOWN_ERROR = 'unknown_error'
}

export interface ConversationStatistics {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  averageResponseTime: number;
  totalSessionTime: number;
  messagesSentSuccessfully: number;
  messagesFailedToSend: number;
  transcriptionAccuracy: number;
}

export interface ConversationSettings {
  language: string;
  autoDetectLanguage: boolean;
  enableTranscription: boolean;
  enableAudioResponse: boolean;
  maxMessageHistory: number;
  summarizationThreshold: number;
}

/**
 * Conversation actions
 */
export interface ConversationActions {
  startConversation: (settings?: Partial<ConversationSettings>) => Promise<void>;
  endConversation: () => Promise<void>;
  sendMessage: (content: string, type?: 'text' | 'audio') => Promise<void>;
  sendAudioMessage: (audioData: ArrayBuffer) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  clearHistory: () => void;
  updateSettings: (settings: Partial<ConversationSettings>) => void;
  restoreSession: (sessionId: string) => Promise<void>;
  summarizeConversation: () => Promise<void>;
}

/**
 * Hook return type
 */
export interface UseConversationReturn {
  state: ConversationState;
  actions: ConversationActions;
  currentMessage: ConversationMessage | null;
  lastMessage: ConversationMessage | null;
  isProcessingResponse: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

/**
 * Hook options
 */
export interface UseConversationOptions {
  webSocketClient?: IWebSocketClient;
  persistToLocalStorage?: boolean;
  autoStartSession?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableStatistics?: boolean;
  defaultSettings?: Partial<ConversationSettings>;
}

const DEFAULT_SETTINGS: ConversationSettings = {
  language: 'en-US',
  autoDetectLanguage: true,
  enableTranscription: true,
  enableAudioResponse: false,
  maxMessageHistory: 100,
  summarizationThreshold: 50
};

const DEFAULT_OPTIONS: Required<UseConversationOptions> = {
  webSocketClient: null as any,
  persistToLocalStorage: true,
  autoStartSession: false,
  maxRetries: 3,
  retryDelay: 1000,
  enableStatistics: true,
  defaultSettings: DEFAULT_SETTINGS
};

/**
 * Main conversation hook
 */
export function useConversation(
  webSocketClient: IWebSocketClient,
  options: UseConversationOptions = {}
): UseConversationReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options, webSocketClient };
  
  // State management
  const [state, setState] = useState<ConversationState>(() => 
    initializeConversationState(opts.defaultSettings)
  );
  
  // Refs for stable references
  const sessionStartTimeRef = useRef<number>(0);
  const messageRetryCountRef = useRef<Map<string, number>>(new Map());
  const responseTimesRef = useRef<number[]>([]);
  const lastMessageTimeRef = useRef<number>(0);
  
  // Connection status tracking
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  
  // Derived state
  const currentMessage = state.messages[state.messages.length - 1] || null;
  const lastMessage = state.messages.length > 1 ? state.messages[state.messages.length - 2] : null;
  const isProcessingResponse = state.messages.some(msg => 
    msg.type === 'assistant' && (msg.status === MessageStatus.PROCESSING || msg.status === MessageStatus.PARTIAL)
  );

  // Initialize conversation state
  function initializeConversationState(defaultSettings: Partial<ConversationSettings>): ConversationState {
    const settings = { ...DEFAULT_SETTINGS, ...defaultSettings };
    
    return {
      sessionId: null,
      messages: [],
      isActive: false,
      isLoading: false,
      error: null,
      statistics: {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        averageResponseTime: 0,
        totalSessionTime: 0,
        messagesSentSuccessfully: 0,
        messagesFailedToSend: 0,
        transcriptionAccuracy: 0
      },
      settings
    };
  }

  // WebSocket event handlers
  useEffect(() => {
    if (!webSocketClient) return;

    const handleConnected = () => {
      setConnectionStatus('connected');
      setState(prev => ({ ...prev, error: null }));
    };

    const handleDisconnected = () => {
      setConnectionStatus('disconnected');
    };

    const handleConnecting = () => {
      setConnectionStatus('connecting');
    };

    const handleError = (event: any) => {
      setConnectionStatus('error');
      setState(prev => ({
        ...prev,
        error: {
          type: ConversationErrorType.CONNECTION_FAILED,
          message: event.error?.message || 'Connection error',
          timestamp: new Date(),
          recoverable: true,
          context: event.error
        }
      }));
    };

    const handleMessage = (event: any) => {
      try {
        const messageData = event.data;
        
        if (messageData.type === 'transcript.partial') {
          handlePartialTranscript(messageData);
        } else if (messageData.type === 'transcript.final') {
          handleFinalTranscript(messageData);
        } else if (messageData.type === 'assistant.delta') {
          handleAssistantDelta(messageData);
        } else if (messageData.type === 'assistant.done') {
          handleAssistantComplete(messageData);
        } else if (messageData.type === 'error') {
          handleServerError(messageData);
        } else if (messageData.type === 'session.started') {
          handleSessionStarted(messageData);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        setState(prev => ({
          ...prev,
          error: {
            type: ConversationErrorType.UNKNOWN_ERROR,
            message: 'Failed to process server message',
            timestamp: new Date(),
            recoverable: true,
            context: error
          }
        }));
      }
    };

    // Register event listeners
    webSocketClient.addEventListener('connected', handleConnected);
    webSocketClient.addEventListener('disconnected', handleDisconnected);
    webSocketClient.addEventListener('connecting', handleConnecting);
    webSocketClient.addEventListener('error', handleError);
    webSocketClient.addEventListener('json_message', handleMessage);

    return () => {
      webSocketClient.removeEventListener('connected', handleConnected);
      webSocketClient.removeEventListener('disconnected', handleDisconnected);
      webSocketClient.removeEventListener('connecting', handleConnecting);
      webSocketClient.removeEventListener('error', handleError);
      webSocketClient.removeEventListener('json_message', handleMessage);
    };
  }, [webSocketClient]);

  // Message handlers
  const handlePartialTranscript = useCallback((data: any) => {
    setState(prev => {
      const messages = [...prev.messages];
      const lastUserMessage = [...messages].reverse().find(msg => msg.type === 'user');
      
      if (lastUserMessage && lastUserMessage.status === MessageStatus.PROCESSING) {
        // Update the last user message with partial transcript
        const messageIndex = messages.findIndex(msg => msg.id === lastUserMessage.id);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...lastUserMessage,
            content: data.text || '',
            status: MessageStatus.PARTIAL,
            metadata: {
              ...lastUserMessage.metadata,
              transcriptionConfidence: data.confidence,
              isComplete: false
            }
          };
        }
      }
      
      return { ...prev, messages };
    });
  }, []);

  const handleFinalTranscript = useCallback((data: any) => {
    setState(prev => {
      const messages = [...prev.messages];
      const lastUserMessage = [...messages].reverse().find(msg => msg.type === 'user');
      
      if (lastUserMessage && (lastUserMessage.status === MessageStatus.PARTIAL || lastUserMessage.status === MessageStatus.PROCESSING)) {
        const messageIndex = messages.findIndex(msg => msg.id === lastUserMessage.id);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...lastUserMessage,
            content: data.text || '',
            status: MessageStatus.COMPLETED,
            metadata: {
              ...lastUserMessage.metadata,
              transcriptionConfidence: data.confidence,
              isComplete: true
            }
          };
        }
      }
      
      return { 
        ...prev, 
        messages,
        statistics: {
          ...prev.statistics,
          transcriptionAccuracy: data.confidence || prev.statistics.transcriptionAccuracy
        }
      };
    });
  }, []);

  const handleAssistantDelta = useCallback((data: any) => {
    setState(prev => {
      const messages = [...prev.messages];
      let lastAssistantMessage = [...messages].reverse().find(msg => msg.type === 'assistant');
      
      if (!lastAssistantMessage || lastAssistantMessage.status === MessageStatus.COMPLETED) {
        // Create new assistant message
        const newMessage: ConversationMessage = {
          id: generateMessageId(),
          type: 'assistant',
          content: data.content || '',
          timestamp: new Date(),
          status: MessageStatus.PARTIAL,
          metadata: {
            chunkIndex: 0,
            isComplete: false
          }
        };
        messages.push(newMessage);
      } else {
        // Update existing assistant message
        const messageIndex = messages.findIndex(msg => msg.id === lastAssistantMessage!.id);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...lastAssistantMessage,
            content: lastAssistantMessage.content + (data.content || ''),
            status: MessageStatus.PARTIAL,
            metadata: {
              ...lastAssistantMessage.metadata,
              chunkIndex: (lastAssistantMessage.metadata?.chunkIndex || 0) + 1,
              isComplete: false
            }
          };
        }
      }
      
      return { ...prev, messages };
    });
  }, []);

  const handleAssistantComplete = useCallback((data: any) => {
    const responseTime = performance.now() - lastMessageTimeRef.current;
    responseTimesRef.current.push(responseTime);
    
    setState(prev => {
      const messages = [...prev.messages];
      const lastAssistantMessage = [...messages].reverse().find(msg => msg.type === 'assistant');
      
      if (lastAssistantMessage && lastAssistantMessage.status === MessageStatus.PARTIAL) {
        const messageIndex = messages.findIndex(msg => msg.id === lastAssistantMessage.id);
        if (messageIndex !== -1) {
          messages[messageIndex] = {
            ...lastAssistantMessage,
            status: MessageStatus.COMPLETED,
            metadata: {
              ...lastAssistantMessage.metadata,
              processingTime: responseTime,
              isComplete: true
            }
          };
        }
      }
      
      // Update statistics
      const avgResponseTime = responseTimesRef.current.length > 0 
        ? responseTimesRef.current.reduce((sum, time) => sum + time, 0) / responseTimesRef.current.length
        : 0;
      
      return {
        ...prev,
        messages,
        statistics: {
          ...prev.statistics,
          assistantMessages: prev.statistics.assistantMessages + 1,
          totalMessages: prev.statistics.totalMessages + 1,
          averageResponseTime: avgResponseTime
        }
      };
    });
  }, []);

  const handleServerError = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      error: {
        type: ConversationErrorType.AI_RESPONSE_FAILED,
        message: data.error || 'Server error occurred',
        timestamp: new Date(),
        recoverable: true,
        context: data
      }
    }));
  }, []);

  const handleSessionStarted = useCallback((data: any) => {
    setState(prev => ({
      ...prev,
      sessionId: data.sessionId,
      isActive: true,
      isLoading: false
    }));
    sessionStartTimeRef.current = performance.now();
  }, []);

  // Actions implementation
  const startConversation = useCallback(async (settings?: Partial<ConversationSettings>) => {
    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null,
        settings: { ...prev.settings, ...settings }
      }));

      // Ensure WebSocket connection
      if (!webSocketClient.isConnected()) {
        await webSocketClient.connect(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream');
      }

      // Send session start message
      await webSocketClient.sendJSON({
        type: 'session.start',
        data: {
          language: state.settings.language,
          autoDetectLanguage: state.settings.autoDetectLanguage,
          enableTranscription: state.settings.enableTranscription
        }
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: {
          type: ConversationErrorType.CONNECTION_FAILED,
          message: `Failed to start conversation: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        }
      }));
    }
  }, [webSocketClient, state.settings]);

  const endConversation = useCallback(async () => {
    try {
      if (webSocketClient.isConnected() && state.sessionId) {
        await webSocketClient.sendJSON({
          type: 'session.end',
          data: { sessionId: state.sessionId }
        });
      }

      const sessionDuration = performance.now() - sessionStartTimeRef.current;
      
      setState(prev => ({
        ...prev,
        isActive: false,
        statistics: {
          ...prev.statistics,
          totalSessionTime: sessionDuration
        }
      }));

    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  }, [webSocketClient, state.sessionId]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'audio' = 'text') => {
    const messageId = generateMessageId();
    lastMessageTimeRef.current = performance.now();

    try {
      // Add message to state immediately
      const newMessage: ConversationMessage = {
        id: messageId,
        type: 'user',
        content,
        timestamp: new Date(),
        status: MessageStatus.SENDING
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));

      // Send message via WebSocket
      await webSocketClient.sendJSON({
        type: 'message.send',
        data: {
          messageId,
          content,
          messageType: type,
          sessionId: state.sessionId
        }
      });

      // Update message status
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId
            ? { ...msg, status: MessageStatus.SENT }
            : msg
        ),
        statistics: {
          ...prev.statistics,
          userMessages: prev.statistics.userMessages + 1,
          messagesSentSuccessfully: prev.statistics.messagesSentSuccessfully + 1
        }
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId
            ? { 
                ...msg, 
                status: MessageStatus.FAILED,
                metadata: { 
                  ...msg.metadata, 
                  errorDetails: error instanceof Error ? error.message : String(error)
                }
              }
            : msg
        ),
        statistics: {
          ...prev.statistics,
          messagesFailedToSend: prev.statistics.messagesFailedToSend + 1
        },
        error: {
          type: ConversationErrorType.MESSAGE_SEND_FAILED,
          message: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        }
      }));
    }
  }, [webSocketClient, state.sessionId]);

  const sendAudioMessage = useCallback(async (audioData: ArrayBuffer) => {
    const messageId = generateMessageId();
    lastMessageTimeRef.current = performance.now();

    try {
      // Add processing message to state
      const newMessage: ConversationMessage = {
        id: messageId,
        type: 'user',
        content: '[Processing audio...]',
        timestamp: new Date(),
        status: MessageStatus.PROCESSING,
        metadata: {
          audioLength: audioData.byteLength
        }
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, newMessage]
      }));

      // Send audio data via WebSocket
      await webSocketClient.sendBinary(audioData);

    } catch (error) {
      setState(prev => ({
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === messageId
            ? { 
                ...msg, 
                status: MessageStatus.FAILED,
                content: '[Audio processing failed]',
                metadata: { 
                  ...msg.metadata, 
                  errorDetails: error instanceof Error ? error.message : String(error)
                }
              }
            : msg
        ),
        error: {
          type: ConversationErrorType.MESSAGE_SEND_FAILED,
          message: `Failed to send audio: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        }
      }));
    }
  }, [webSocketClient]);

  const retryMessage = useCallback(async (messageId: string) => {
    const message = state.messages.find(msg => msg.id === messageId);
    if (!message) return;

    const retryCount = messageRetryCountRef.current.get(messageId) || 0;
    if (retryCount >= opts.maxRetries) {
      setState(prev => ({
        ...prev,
        error: {
          type: ConversationErrorType.MESSAGE_SEND_FAILED,
          message: 'Maximum retry attempts reached',
          timestamp: new Date(),
          recoverable: false
        }
      }));
      return;
    }

    messageRetryCountRef.current.set(messageId, retryCount + 1);

    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, opts.retryDelay));

    // Retry sending the message
    if (message.metadata?.audioLength) {
      // This would need the original audio data - simplified for now
      console.warn('Audio message retry not fully implemented');
    } else {
      await sendMessage(message.content, 'text');
    }
  }, [state.messages, opts.maxRetries, opts.retryDelay, sendMessage]);

  const deleteMessage = useCallback((messageId: string) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== messageId)
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      messages: [],
      statistics: {
        ...prev.statistics,
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0
      }
    }));
    responseTimesRef.current = [];
    messageRetryCountRef.current.clear();
  }, []);

  const updateSettings = useCallback((newSettings: Partial<ConversationSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  const restoreSession = useCallback(async (sessionId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));

      await webSocketClient.sendJSON({
        type: 'session.restore',
        data: { sessionId }
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: {
          type: ConversationErrorType.SESSION_EXPIRED,
          message: `Failed to restore session: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
          recoverable: true,
          context: error
        }
      }));
    }
  }, [webSocketClient]);

  const summarizeConversation = useCallback(async () => {
    try {
      await webSocketClient.sendJSON({
        type: 'conversation.summarize',
        data: { sessionId: state.sessionId }
      });
    } catch (error) {
      console.error('Failed to request conversation summary:', error);
    }
  }, [webSocketClient, state.sessionId]);

  // Auto-start session if configured
  useEffect(() => {
    if (opts.autoStartSession && !state.isActive && !state.isLoading && connectionStatus === 'connected') {
      startConversation();
    }
  }, [opts.autoStartSession, state.isActive, state.isLoading, connectionStatus, startConversation]);

  // Persistence to localStorage
  useEffect(() => {
    if (opts.persistToLocalStorage && state.sessionId) {
      try {
        const persistData = {
          sessionId: state.sessionId,
          messages: state.messages,
          settings: state.settings,
          statistics: state.statistics
        };
        localStorage.setItem('conversation-state', JSON.stringify(persistData));
      } catch (error) {
        console.warn('Failed to persist conversation state:', error);
      }
    }
  }, [opts.persistToLocalStorage, state.sessionId, state.messages, state.settings, state.statistics]);

  // Load persisted state on mount
  useEffect(() => {
    if (opts.persistToLocalStorage) {
      try {
        const persistedData = localStorage.getItem('conversation-state');
        if (persistedData) {
          const parsed = JSON.parse(persistedData);
          setState(prev => ({
            ...prev,
            sessionId: parsed.sessionId,
            messages: parsed.messages || [],
            settings: { ...prev.settings, ...parsed.settings },
            statistics: { ...prev.statistics, ...parsed.statistics }
          }));
        }
      } catch (error) {
        console.warn('Failed to load persisted conversation state:', error);
      }
    }
  }, [opts.persistToLocalStorage]);

  const actions: ConversationActions = {
    startConversation,
    endConversation,
    sendMessage,
    sendAudioMessage,
    retryMessage,
    deleteMessage,
    clearHistory,
    updateSettings,
    restoreSession,
    summarizeConversation
  };

  return {
    state,
    actions,
    currentMessage,
    lastMessage,
    isProcessingResponse,
    connectionStatus
  };
}

// Utility functions
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
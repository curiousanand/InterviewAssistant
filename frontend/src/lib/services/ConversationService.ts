import { 
  Session, 
  Message, 
  CreateSessionRequest, 
  SessionResponse,
  WebSocketMessage,
  WebSocketMessageType,
  TranscriptPayload,
  ErrorPayload,
  SUPPORTED_LANGUAGES,
  LanguageOption
} from '../../types';
import { InterviewWebSocketClient } from '../websocket/InterviewWebSocketClient';

/**
 * Conversation management service
 * 
 * Why: Manages session lifecycle, message history, and backend integration
 * Pattern: Service Layer - handles business logic for conversations
 * Rationale: Centralizes conversation state and provides clean API for UI
 */
export class ConversationService {
  private wsClient: InterviewWebSocketClient;
  private currentSession: Session | null = null;
  private messages: Message[] = [];
  private currentTranscript: string = '';
  private currentAssistantResponse: string = '';
  
  // Configuration
  private baseUrl: string;
  private apiKey: string;
  
  // Event handlers
  private onSessionChange: ((session: Session | null) => void) | undefined;
  private onMessagesChange: ((messages: Message[]) => void) | undefined;
  private onTranscriptUpdate: ((transcript: string, isFinal: boolean, confidence: number) => void) | undefined;
  private onAssistantResponse: ((response: string, isComplete: boolean) => void) | undefined;
  private onError: ((error: string) => void) | undefined;

  constructor(wsClient: InterviewWebSocketClient, baseUrl: string = 'http://localhost:8080', apiKey: string = '') {
    this.wsClient = wsClient;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    
    // Setup WebSocket message handling
    this.wsClient.onMessageReceived((message) => {
      this.handleWebSocketMessage(message);
    });
    
    this.wsClient.onErrorOccurred((error) => {
      if (this.onError) {
        this.onError(error);
      }
    });
  }

  /**
   * Create a new conversation session
   */
  async createSession(targetLanguage: string = 'en-US', autoDetect: boolean = true): Promise<Session> {
    try {
      const request: CreateSessionRequest = {
        targetLanguage,
        autoDetect
      };

      const response = await fetch(`${this.baseUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const sessionResponse: SessionResponse = await response.json();
      
      // Convert to UI session model
      this.currentSession = {
        id: sessionResponse.id,
        status: sessionResponse.status as Session['status'],
        targetLanguage: sessionResponse.targetLanguage,
        autoDetectLanguage: sessionResponse.autoDetectLanguage,
        createdAt: new Date(sessionResponse.createdAt),
        messageCount: sessionResponse.messageCount
      };

      // Set session ID in WebSocket client
      this.wsClient.setSessionId(this.currentSession.id);

      // Clear previous conversation state
      this.messages = [];
      this.currentTranscript = '';
      this.currentAssistantResponse = '';

      console.log('Session created:', this.currentSession.id);
      
      if (this.onSessionChange) {
        this.onSessionChange(this.currentSession);
      }
      
      if (this.onMessagesChange) {
        this.onMessagesChange(this.messages);
      }

      return this.currentSession;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create session';
      console.error('Error creating session:', error);
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Get existing session by ID
   */
  async getSession(sessionId: string): Promise<Session> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get session: ${response.status} ${response.statusText}`);
      }

      const sessionResponse: SessionResponse = await response.json();
      
      // Convert to UI session model
      this.currentSession = {
        id: sessionResponse.id,
        status: sessionResponse.status as Session['status'],
        targetLanguage: sessionResponse.targetLanguage,
        autoDetectLanguage: sessionResponse.autoDetectLanguage,
        createdAt: new Date(sessionResponse.createdAt),
        messageCount: sessionResponse.messageCount
      };

      // Set session ID in WebSocket client
      this.wsClient.setSessionId(this.currentSession.id);

      console.log('Session retrieved:', this.currentSession.id);
      
      if (this.onSessionChange) {
        this.onSessionChange(this.currentSession);
      }

      return this.currentSession;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve session';
      console.error('Error retrieving session:', error);
      
      if (this.onError) {
        this.onError(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Close the current session
   */
  async closeSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/sessions/${this.currentSession.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        console.warn(`Failed to close session on server: ${response.status} ${response.statusText}`);
      }

      // Clean up local state
      this.currentSession = null;
      this.messages = [];
      this.currentTranscript = '';
      this.currentAssistantResponse = '';

      console.log('Session closed');
      
      if (this.onSessionChange) {
        this.onSessionChange(null);
      }
      
      if (this.onMessagesChange) {
        this.onMessagesChange(this.messages);
      }

    } catch (error) {
      console.error('Error closing session:', error);
      // Don't throw error for session cleanup
    }
  }

  /**
   * Handle WebSocket messages from backend
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketMessageType.SESSION_READY:
        console.log('Session ready for communication');
        break;

      case WebSocketMessageType.TRANSCRIPT_PARTIAL:
        this.handleTranscriptMessage(message, false);
        break;

      case WebSocketMessageType.TRANSCRIPT_FINAL:
        this.handleTranscriptMessage(message, true);
        break;

      case WebSocketMessageType.ASSISTANT_DELTA:
        this.handleAssistantDelta(message);
        break;

      case WebSocketMessageType.ASSISTANT_DONE:
        this.handleAssistantComplete(message);
        break;

      case WebSocketMessageType.ERROR:
        this.handleErrorMessage(message);
        break;

      default:
        console.log('Unhandled message type:', message.type);
    }
  }

  /**
   * Handle transcript messages (partial and final)
   */
  private handleTranscriptMessage(message: WebSocketMessage, isFinal: boolean): void {
    const payload = message.payload as TranscriptPayload;
    
    if (isFinal) {
      // Add final transcript as user message
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: payload.text,
        timestamp: new Date(),
        confidence: payload.confidence
      };
      
      this.messages.push(userMessage);
      this.currentTranscript = '';
      
      console.log('Final transcript:', payload.text);
      
      if (this.onMessagesChange) {
        this.onMessagesChange([...this.messages]);
      }
      
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(payload.text, true, payload.confidence);
      }
    } else {
      // Update current partial transcript
      this.currentTranscript = payload.text;
      
      console.log('Partial transcript:', payload.text);
      
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(payload.text, false, payload.confidence);
      }
    }
  }

  /**
   * Handle assistant response delta (streaming)
   */
  private handleAssistantDelta(message: WebSocketMessage): void {
    const delta = message.payload as string;
    this.currentAssistantResponse += delta;
    
    console.log('Assistant delta:', delta);
    
    if (this.onAssistantResponse) {
      this.onAssistantResponse(this.currentAssistantResponse, false);
    }
  }

  /**
   * Handle assistant response completion
   */
  private handleAssistantComplete(message: WebSocketMessage): void {
    const fullResponse = message.payload as string;
    
    // Add assistant message to conversation
    const assistantMessage: Message = {
      id: this.generateMessageId(),
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date()
    };
    
    this.messages.push(assistantMessage);
    this.currentAssistantResponse = '';
    
    console.log('Assistant response complete:', fullResponse);
    
    if (this.onMessagesChange) {
      this.onMessagesChange([...this.messages]);
    }
    
    if (this.onAssistantResponse) {
      this.onAssistantResponse(fullResponse, true);
    }
  }

  /**
   * Handle error messages from backend
   */
  private handleErrorMessage(message: WebSocketMessage): void {
    const error = message.payload as ErrorPayload;
    console.error('Backend error:', error);
    
    if (this.onError) {
      this.onError(error.message);
    }
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.messages = [];
    this.currentTranscript = '';
    this.currentAssistantResponse = '';
    
    if (this.onMessagesChange) {
      this.onMessagesChange(this.messages);
    }
    
    console.log('Conversation cleared');
  }

  /**
   * Add a manual text message to the conversation
   */
  addTextMessage(text: string): void {
    const userMessage: Message = {
      id: this.generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      confidence: 1.0 // Manual text has full confidence
    };
    
    this.messages.push(userMessage);
    
    if (this.onMessagesChange) {
      this.onMessagesChange([...this.messages]);
    }
    
    console.log('Manual text message added:', text);
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public getters
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  getCurrentAssistantResponse(): string {
    return this.currentAssistantResponse;
  }

  isSessionActive(): boolean {
    return this.currentSession?.status === 'ACTIVE';
  }

  // Utility methods
  getSupportedLanguages(): LanguageOption[] {
    return SUPPORTED_LANGUAGES;
  }

  getLanguageByCode(code: string): LanguageOption | undefined {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
  }

  // Event handler setters
  onSessionStateChange(handler: (session: Session | null) => void): void {
    this.onSessionChange = handler;
  }

  onConversationChange(handler: (messages: Message[]) => void): void {
    this.onMessagesChange = handler;
  }

  onTranscriptReceived(handler: (transcript: string, isFinal: boolean, confidence: number) => void): void {
    this.onTranscriptUpdate = handler;
  }

  onAssistantResponseReceived(handler: (response: string, isComplete: boolean) => void): void {
    this.onAssistantResponse = handler;
  }

  onErrorOccurred(handler: (error: string) => void): void {
    this.onError = handler;
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    sessionDuration: number;
    averageConfidence: number;
  } {
    const userMessages = this.messages.filter(m => m.role === 'user');
    const assistantMessages = this.messages.filter(m => m.role === 'assistant');
    
    const confidenceValues = userMessages
      .map(m => m.confidence || 0)
      .filter(c => c > 0);
    
    const averageConfidence = confidenceValues.length > 0 
      ? confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length 
      : 0;
    
    const sessionDuration = this.currentSession 
      ? Date.now() - this.currentSession.createdAt.getTime()
      : 0;

    return {
      messageCount: this.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      sessionDuration,
      averageConfidence
    };
  }

  /**
   * Export conversation as JSON
   */
  exportConversation(): {
    session: Session | null;
    messages: Message[];
    exportedAt: Date;
    stats: any;
  } {
    return {
      session: this.currentSession,
      messages: this.getMessages(),
      exportedAt: new Date(),
      stats: this.getConversationStats()
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.closeSession().catch(error => {
      console.warn('Error during cleanup:', error);
    });
    
    // Clear event handlers
    this.onSessionChange = undefined;
    this.onMessagesChange = undefined;
    this.onTranscriptUpdate = undefined;
    this.onAssistantResponse = undefined;
    this.onError = undefined;
  }
}
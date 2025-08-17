import { renderHook, act } from '@testing-library/react';
import { useConversation, MessageStatus, ConversationErrorType } from '../useConversation';

/**
 * Test suite for useConversation hook
 * 
 * Tests state management, message handling, and conversation lifecycle
 * Rationale: Ensures conversation logic works correctly across all scenarios
 */

describe('useConversation', () => {
  let mockWebSocketClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket client
    mockWebSocketClient = {
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(() => Promise.resolve()),
      sendJSON: jest.fn(() => Promise.resolve()),
      sendBinary: jest.fn(() => Promise.resolve()),
      isConnected: jest.fn(() => true),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      expect(result.current.state.messages).toEqual([]);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.sessionId).toBeNull();
      expect(result.current.state.statistics.totalMessages).toBe(0);
      expect(result.current.state.isActive).toBe(false);
    });

    it('should initialize with custom settings', () => {
      const customSettings = { language: 'es-ES', autoDetectLanguage: false };
      const { result } = renderHook(() => 
        useConversation(mockWebSocketClient, { defaultSettings: customSettings })
      );

      expect(result.current.state.settings.language).toBe('es-ES');
      expect(result.current.state.settings.autoDetectLanguage).toBe(false);
    });
  });

  describe('conversation management', () => {
    it('should start conversation successfully', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      await act(async () => {
        await result.current.actions.startConversation();
      });

      expect(result.current.state.isLoading).toBe(true);
      expect(result.current.state.error).toBeNull();
      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.start'
        })
      );
    });

    it('should handle conversation start failure', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      
      mockWebSocketClient.sendJSON.mockRejectedValue(new Error('Connection failed'));

      await act(async () => {
        await result.current.actions.startConversation();
      });

      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBeTruthy();
      expect(result.current.state.error?.type).toBe(ConversationErrorType.CONNECTION_FAILED);
    });

    it('should end conversation successfully', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      await act(async () => {
        await result.current.actions.endConversation();
      });

      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.end'
        })
      );
    });
  });

  describe('message handling', () => {
    it('should send user message correctly', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const messageContent = 'Hello, this is a test message';

      await act(async () => {
        await result.current.actions.sendMessage(messageContent);
      });

      expect(result.current.state.messages).toHaveLength(1);
      expect(result.current.state.messages[0]).toEqual(
        expect.objectContaining({
          content: messageContent,
          type: 'user',
          status: MessageStatus.SENT,
        })
      );
      expect(result.current.state.statistics.userMessages).toBe(1);
    });

    it('should handle message send failure', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const messageContent = 'Failed message';
      
      mockWebSocketClient.sendJSON.mockRejectedValue(new Error('Send failed'));

      await act(async () => {
        await result.current.actions.sendMessage(messageContent);
      });

      expect(result.current.state.messages).toHaveLength(1);
      expect(result.current.state.messages[0].status).toBe(MessageStatus.FAILED);
      expect(result.current.state.error?.type).toBe(ConversationErrorType.MESSAGE_SEND_FAILED);
    });

    it('should send audio message correctly', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const audioData = new ArrayBuffer(1024);

      await act(async () => {
        await result.current.actions.sendAudioMessage(audioData);
      });

      expect(result.current.state.messages).toHaveLength(1);
      expect(result.current.state.messages[0]).toEqual(
        expect.objectContaining({
          type: 'user',
          status: MessageStatus.PROCESSING,
          content: '[Processing audio...]',
        })
      );
      expect(mockWebSocketClient.sendBinary).toHaveBeenCalledWith(audioData);
    });

    it('should retry failed message', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const messageContent = 'Test message';

      // First send a message that will succeed  
      await act(async () => {
        await result.current.actions.sendMessage(messageContent);
      });

      const messageId = result.current.state.messages[0].id;

      // Mock retry scenario
      jest.clearAllMocks();
      mockWebSocketClient.sendJSON.mockResolvedValue(undefined);

      await act(async () => {
        await result.current.actions.retryMessage(messageId);
      });

      expect(mockWebSocketClient.sendJSON).toHaveBeenCalled();
    });

    it('should delete message correctly', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      // Add a message first
      act(() => {
        result.current.state.messages.push({
          id: 'test-message-1',
          content: 'Test message',
          type: 'user',
          status: MessageStatus.SENT,
          timestamp: new Date(),
        });
      });

      act(() => {
        result.current.actions.deleteMessage('test-message-1');
      });

      expect(result.current.state.messages).toHaveLength(0);
    });
  });

  describe('conversation settings', () => {
    it('should update settings correctly', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const newSettings = { language: 'fr-FR', enableTranscription: false };

      act(() => {
        result.current.actions.updateSettings(newSettings);
      });

      expect(result.current.state.settings.language).toBe('fr-FR');
      expect(result.current.state.settings.enableTranscription).toBe(false);
    });

    it('should clear conversation history', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      // Add messages first
      act(() => {
        result.current.state.messages.push(
          {
            id: 'msg-1',
            content: 'Message 1',
            type: 'user',
            status: MessageStatus.SENT,
            timestamp: new Date(),
          },
          {
            id: 'msg-2', 
            content: 'Message 2',
            type: 'assistant',
            status: MessageStatus.COMPLETED,
            timestamp: new Date(),
          }
        );
      });

      expect(result.current.state.messages).toHaveLength(2);

      act(() => {
        result.current.actions.clearHistory();
      });

      expect(result.current.state.messages).toEqual([]);
      expect(result.current.state.statistics.totalMessages).toBe(0);
    });
  });

  describe('session restoration', () => {
    it('should restore session correctly', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      const sessionId = 'existing-session-123';

      await act(async () => {
        await result.current.actions.restoreSession(sessionId);
      });

      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session.restore',
          data: { sessionId }
        })
      );
    });

    it('should handle session restore failure', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));
      
      mockWebSocketClient.sendJSON.mockRejectedValue(new Error('Session not found'));

      await act(async () => {
        await result.current.actions.restoreSession('invalid-session');
      });

      expect(result.current.state.error?.type).toBe(ConversationErrorType.SESSION_EXPIRED);
    });
  });

  describe('WebSocket event handling', () => {
    it('should handle connection events', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      // Verify event listeners were registered
      expect(mockWebSocketClient.addEventListener).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWebSocketClient.addEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockWebSocketClient.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocketClient.addEventListener).toHaveBeenCalledWith('json_message', expect.any(Function));
    });

    it('should handle session started event', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      // Get the message handler
      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'session.started',
            sessionId: 'new-session-123'
          }
        });
      });

      expect(result.current.state.sessionId).toBe('new-session-123');
      expect(result.current.state.isActive).toBe(true);
      expect(result.current.state.isLoading).toBe(false);
    });
  });

  describe('conversation summarization', () => {
    it('should request conversation summary', async () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      // Set up active session
      act(() => {
        result.current.state.sessionId = 'test-session';
      });

      await act(async () => {
        await result.current.actions.summarizeConversation();
      });

      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'conversation.summarize',
          data: { sessionId: 'test-session' }
        })
      );
    });
  });

  describe('derived state', () => {
    it('should correctly identify current and last messages', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      expect(result.current.currentMessage).toBeNull();
      expect(result.current.lastMessage).toBeNull();

      // Add messages
      act(() => {
        result.current.state.messages.push(
          {
            id: 'msg-1',
            content: 'First message',
            type: 'user',
            status: MessageStatus.SENT,
            timestamp: new Date(),
          },
          {
            id: 'msg-2',
            content: 'Second message',
            type: 'assistant',
            status: MessageStatus.COMPLETED,
            timestamp: new Date(),
          }
        );
      });

      expect(result.current.currentMessage?.id).toBe('msg-2');
      expect(result.current.lastMessage?.id).toBe('msg-1');
    });

    it('should correctly identify processing response state', () => {
      const { result } = renderHook(() => useConversation(mockWebSocketClient));

      expect(result.current.isProcessingResponse).toBe(false);

      // Add processing assistant message
      act(() => {
        result.current.state.messages.push({
          id: 'processing-msg',
          content: 'Processing...',
          type: 'assistant',
          status: MessageStatus.PROCESSING,
          timestamp: new Date(),
        });
      });

      expect(result.current.isProcessingResponse).toBe(true);
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      // Clear localStorage
      localStorage.clear();
    });

    it('should persist conversation state to localStorage', () => {
      const { result } = renderHook(() => 
        useConversation(mockWebSocketClient, { persistToLocalStorage: true })
      );

      act(() => {
        result.current.state.sessionId = 'test-session';
        result.current.state.messages.push({
          id: 'msg-1',
          content: 'Test message',
          type: 'user',
          status: MessageStatus.SENT,
          timestamp: new Date(),
        });
      });

      // Verify localStorage was updated
      const persistedData = localStorage.getItem('conversation-state');
      expect(persistedData).toBeTruthy();
      
      const parsed = JSON.parse(persistedData!);
      expect(parsed.sessionId).toBe('test-session');
      expect(parsed.messages).toHaveLength(1);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useConversation(mockWebSocketClient));

      unmount();

      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith('json_message', expect.any(Function));
    });
  });
});
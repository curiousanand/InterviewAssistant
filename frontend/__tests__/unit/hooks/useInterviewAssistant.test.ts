/**
 * Unit tests for useInterviewAssistant hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useInterviewAssistant } from '../../../src/hooks/useInterviewAssistant';
import { MockWebSocketClient, MockAudioStreamingService, MockConversationService } from '../../utils/test-utils';

// Mock the service modules
jest.mock('../../../src/lib/websocket/InterviewWebSocketClient');
jest.mock('../../../src/lib/services/AudioStreamingService');
jest.mock('../../../src/lib/services/ConversationService');

describe('useInterviewAssistant', () => {
  let mockWsClient: MockWebSocketClient;
  let mockAudioService: MockAudioStreamingService;
  let mockConversationService: MockConversationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWsClient = new MockWebSocketClient();
    mockAudioService = new MockAudioStreamingService();
    mockConversationService = new MockConversationService();

    // Mock the constructors
    const WebSocketClient = require('../../../src/lib/websocket/InterviewWebSocketClient').InterviewWebSocketClient;
    const AudioService = require('../../../src/lib/services/AudioStreamingService').AudioStreamingService;
    const ConversationService = require('../../../src/lib/services/ConversationService').ConversationService;

    WebSocketClient.mockImplementation(() => mockWsClient);
    AudioService.mockImplementation(() => mockAudioService);
    ConversationService.mockImplementation(() => mockConversationService);
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useInterviewAssistant());

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.connectionState.status).toBe('disconnected');
      expect(result.current.recordingState.isRecording).toBe(false);
      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should initialize services on mount', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockWsClient.connect).toHaveBeenCalledWith('ws://localhost:8080/ws/stream');
      expect(mockAudioService.initialize).toHaveBeenCalled();
      expect(result.current.isInitialized).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockWsClient.connect.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        try {
          await result.current.initialize();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Connection failed');
      expect(result.current.isInitialized).toBe(false);
    });
  });

  describe('Recording', () => {
    it('should start recording when connected', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      // Initialize first
      await act(async () => {
        await result.current.initialize();
      });

      // Update connection state
      act(() => {
        const onStateChange = mockWsClient.onConnectionStateChange.mock.calls[0][0];
        onStateChange({ status: 'connected', reconnectAttempts: 0 });
      });

      // Start recording
      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockAudioService.startRecording).toHaveBeenCalled();
      expect(result.current.recordingState.isRecording).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should not start recording when disconnected', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockAudioService.startRecording).not.toHaveBeenCalled();
      expect(result.current.error).toBe('Cannot start recording: not connected to server');
    });

    it('should stop recording', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      // Start recording first
      act(() => {
        const onStateChange = mockWsClient.onConnectionStateChange.mock.calls[0][0];
        onStateChange({ status: 'connected', reconnectAttempts: 0 });
      });

      await act(async () => {
        await result.current.startRecording();
      });

      // Stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(mockAudioService.stopRecording).toHaveBeenCalled();
      expect(result.current.recordingState.isRecording).toBe(false);
    });

    it('should handle recording errors', async () => {
      mockAudioService.startRecording.mockRejectedValue(new Error('Microphone access denied'));

      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        const onStateChange = mockWsClient.onConnectionStateChange.mock.calls[0][0];
        onStateChange({ status: 'connected', reconnectAttempts: 0 });
      });

      await act(async () => {
        try {
          await result.current.startRecording();
        } catch (error) {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Microphone access denied');
      expect(result.current.recordingState.isRecording).toBe(false);
    });
  });

  describe('Conversation Management', () => {
    it('should clear conversation', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        result.current.clearConversation();
      });

      expect(mockConversationService.clearConversation).toHaveBeenCalled();
      expect(result.current.currentTranscript).toBe('');
      expect(result.current.currentAssistantResponse).toBe('');
      expect(result.current.error).toBeNull();
    });

    it('should change language', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      await act(async () => {
        await result.current.changeLanguage('fr-FR', false);
      });

      expect(mockConversationService.createSession).toHaveBeenCalledWith('fr-FR', false);
    });

    it('should handle messages from conversation service', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      const mockMessages = [
        { id: '1', content: 'Hello', role: 'user' as const, timestamp: new Date().toISOString(), sessionId: '123', status: 'completed' as const },
        { id: '2', content: 'Hi there', role: 'assistant' as const, timestamp: new Date().toISOString(), sessionId: '123', status: 'completed' as const },
      ];

      act(() => {
        const onConversationChange = mockConversationService.onConversationChange.mock.calls[0][0];
        onConversationChange(mockMessages);
      });

      expect(result.current.messages).toEqual(mockMessages);
    });

    it('should handle transcript updates', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      // Partial transcript
      act(() => {
        const onTranscriptReceived = mockConversationService.onTranscriptReceived.mock.calls[0][0];
        onTranscriptReceived('Hello world', false);
      });

      expect(result.current.currentTranscript).toBe('Hello world');

      // Final transcript
      act(() => {
        const onTranscriptReceived = mockConversationService.onTranscriptReceived.mock.calls[0][0];
        onTranscriptReceived('Hello world!', true);
      });

      expect(result.current.currentTranscript).toBe('');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup services on unmount', async () => {
      const { result, unmount } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      await act(async () => {
        await result.current.cleanup();
      });

      expect(mockAudioService.cleanup).toHaveBeenCalled();
      expect(mockConversationService.cleanup).toHaveBeenCalled();
      expect(mockWsClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        const onError = mockWsClient.onErrorOccurred.mock.calls[0][0];
        onError('WebSocket connection lost');
      });

      expect(result.current.error).toBe('WebSocket connection lost');
    });

    it('should handle audio service errors', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      await act(async () => {
        await result.current.initialize();
      });

      act(() => {
        const onError = mockAudioService.onErrorOccurred.mock.calls[0][0];
        onError('Audio processing failed');
      });

      expect(result.current.error).toBe('Audio processing failed');
    });

    it('should clear errors', async () => {
      const { result } = renderHook(() => useInterviewAssistant());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.setError(null);
      });

      expect(result.current.error).toBeNull();
    });
  });
});
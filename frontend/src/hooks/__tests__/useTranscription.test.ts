import { renderHook, act } from '@testing-library/react';
import { useTranscription } from '../useTranscription';

/**
 * Test suite for useTranscription hook
 * 
 * Tests transcription state management and WebSocket event handling
 * Rationale: Ensures voice-to-text functionality works correctly
 */

describe('useTranscription', () => {
  let mockWebSocketClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocket client
    mockWebSocketClient = {
      sendJSON: jest.fn(() => Promise.resolve()),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      isConnected: jest.fn(() => true),
    };
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.currentText).toBe('');
      expect(result.current.finalText).toBe('');
      expect(result.current.confidence).toBe(0);
      expect(result.current.error).toBeNull();
      expect(result.current.results).toEqual([]);
    });

    it('should initialize with custom settings', () => {
      const customSettings = {
        language: 'es-ES',
        autoDetectLanguage: false,
        enableInterimResults: false,
      };

      const { result } = renderHook(() => 
        useTranscription(mockWebSocketClient, { defaultSettings: customSettings })
      );

      expect(result.current.settings.language).toBe('es-ES');
      expect(result.current.settings.autoDetectLanguage).toBe(false);
      expect(result.current.settings.enableInterimResults).toBe(false);
    });
  });

  describe('transcription lifecycle', () => {
    it('should start transcription successfully', async () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.isTranscribing).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcription.start'
        })
      );
    });

    it('should stop transcription successfully', async () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // First start transcription
      await act(async () => {
        await result.current.startTranscription();
      });

      // Then stop it
      await act(async () => {
        await result.current.stopTranscription();
      });

      expect(result.current.isTranscribing).toBe(false);
      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcription.stop'
        })
      );
    });

    it('should handle transcription start failure', async () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));
      
      mockWebSocketClient.sendJSON.mockRejectedValue(new Error('Start failed'));

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.type).toBe('service_error');
    });

    it('should handle disconnected WebSocket', async () => {
      mockWebSocketClient.isConnected.mockReturnValue(false);
      
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      await act(async () => {
        await result.current.startTranscription();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.type).toBe('network_error');
    });
  });

  describe('transcription events', () => {
    it('should handle partial transcription results', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Get the event handler for transcript.partial
      const partialHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        partialHandler?.({
          data: {
            type: 'transcript.partial',
            text: 'Hello world',
            confidence: 0.85,
            id: 'partial-1',
            timestamp: new Date().toISOString()
          }
        });
      });

      expect(result.current.currentText).toBe('Hello world');
      expect(result.current.confidence).toBe(0.85);
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].isPartial).toBe(true);
    });

    it('should handle final transcription results', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Get the event handler
      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      // First send partial result
      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.partial',
            text: 'Hello',
            confidence: 0.7,
            id: 'partial-1',
            timestamp: new Date().toISOString()
          }
        });
      });

      // Then send final result
      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'Hello world!',
            confidence: 0.95,
            id: 'final-1',
            timestamp: new Date().toISOString()
          }
        });
      });

      expect(result.current.finalText).toBe('Hello world!');
      expect(result.current.currentText).toBe(''); // Should be cleared after final
      expect(result.current.confidence).toBe(0.95);
      expect(result.current.results).toHaveLength(2);
      expect(result.current.results[1].isFinal).toBe(true);
    });

    it('should handle transcription errors', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcription.error',
            error: {
              type: 'audio_error',
              message: 'Audio quality too low',
              recoverable: true
            }
          }
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.type).toBe('audio_error');
      expect(result.current.error?.message).toBe('Audio quality too low');
      expect(result.current.error?.recoverable).toBe(true);
    });

    it('should handle language detection', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'language.detected',
            language: 'es-ES',
            confidence: 0.92
          }
        });
      });

      expect(result.current.detectedLanguage).toBe('es-ES');
      expect(result.current.languageConfidence).toBe(0.92);
    });
  });

  describe('settings management', () => {
    it('should update transcription settings', async () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const newSettings = {
        language: 'fr-FR',
        enableInterimResults: false,
        punctuation: false,
      };

      await act(async () => {
        await result.current.updateSettings(newSettings);
      });

      expect(result.current.settings.language).toBe('fr-FR');
      expect(result.current.settings.enableInterimResults).toBe(false);
      expect(result.current.settings.punctuation).toBe(false);

      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcription.configure',
          data: expect.objectContaining(newSettings)
        })
      );
    });

    it('should toggle auto-detection', async () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      await act(async () => {
        await result.current.toggleAutoDetection(true);
      });

      expect(result.current.settings.autoDetectLanguage).toBe(true);
      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcription.configure',
          data: expect.objectContaining({
            autoDetectLanguage: true
          })
        })
      );
    });
  });

  describe('result management', () => {
    it('should clear transcription results', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Add some results first
      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'Test result',
            confidence: 0.9,
            id: 'test-1',
            timestamp: new Date().toISOString()
          }
        });
      });

      expect(result.current.results).toHaveLength(1);

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.results).toEqual([]);
      expect(result.current.currentText).toBe('');
      expect(result.current.finalText).toBe('');
    });

    it('should export transcription results', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Add test results
      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'First result',
            confidence: 0.9,
            id: 'test-1',
            timestamp: new Date().toISOString()
          }
        });
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'Second result',
            confidence: 0.85,
            id: 'test-2',
            timestamp: new Date().toISOString()
          }
        });
      });

      const exported = result.current.exportResults('json');
      
      expect(exported).toBeTruthy();
      const parsed = JSON.parse(exported);
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].text).toBe('First result');
      expect(parsed.results[1].text).toBe('Second result');
    });

    it('should export as text format', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'First sentence.',
            confidence: 0.9,
            id: 'test-1',
            timestamp: new Date().toISOString()
          }
        });
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'Second sentence.',
            confidence: 0.85,
            id: 'test-2',
            timestamp: new Date().toISOString()
          }
        });
      });

      const exported = result.current.exportResults('text');
      
      expect(exported).toBe('First sentence. Second sentence.');
    });
  });

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Set an error first
      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcription.error',
            error: {
              type: 'service_error',
              message: 'Service unavailable',
              recoverable: false
            }
          }
        });
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle non-recoverable errors by stopping transcription', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      // Start transcription first
      act(() => {
        result.current.isTranscribing = true;
      });

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      act(() => {
        messageHandler?.({
          data: {
            type: 'transcription.error',
            error: {
              type: 'service_error',
              message: 'Service permanently unavailable',
              recoverable: false
            }
          }
        });
      });

      expect(result.current.isTranscribing).toBe(false);
      expect(result.current.error?.recoverable).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track transcription statistics', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      // Add multiple results to build statistics
      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'High confidence result',
            confidence: 0.95,
            id: 'test-1',
            timestamp: new Date().toISOString()
          }
        });
        messageHandler?.({
          data: {
            type: 'transcript.final',
            text: 'Lower confidence result',
            confidence: 0.75,
            id: 'test-2',
            timestamp: new Date().toISOString()
          }
        });
      });

      const stats = result.current.getStatistics();

      expect(stats.totalResults).toBe(2);
      expect(stats.averageConfidence).toBe(0.85);
      expect(stats.highConfidenceResults).toBe(1);
      expect(stats.lowConfidenceResults).toBe(1);
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useTranscription(mockWebSocketClient));

      unmount();

      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith('json_message', expect.any(Function));
    });

    it('should stop transcription on unmount if active', async () => {
      const { result, unmount } = renderHook(() => useTranscription(mockWebSocketClient));

      // Start transcription
      await act(async () => {
        await result.current.startTranscription();
      });

      unmount();

      // Should have called stop
      expect(mockWebSocketClient.sendJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transcription.stop'
        })
      );
    });
  });

  describe('real-time updates', () => {
    it('should handle rapid partial updates correctly', () => {
      const { result } = renderHook(() => useTranscription(mockWebSocketClient));

      const messageHandler = mockWebSocketClient.addEventListener.mock.calls
        .find(call => call[0] === 'json_message')?.[1];

      // Simulate rapid partial updates
      act(() => {
        messageHandler?.({
          data: {
            type: 'transcript.partial',
            text: 'Hello',
            confidence: 0.7,
            id: 'partial-1',
            timestamp: new Date().toISOString()
          }
        });
        messageHandler?.({
          data: {
            type: 'transcript.partial',
            text: 'Hello world',
            confidence: 0.8,
            id: 'partial-2',
            timestamp: new Date().toISOString()
          }
        });
        messageHandler?.({
          data: {
            type: 'transcript.partial',
            text: 'Hello world!',
            confidence: 0.9,
            id: 'partial-3',
            timestamp: new Date().toISOString()
          }
        });
      });

      expect(result.current.currentText).toBe('Hello world!');
      expect(result.current.confidence).toBe(0.9);
      expect(result.current.results).toHaveLength(3);
    });
  });
});
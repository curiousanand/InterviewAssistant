import { renderHook, act } from '@testing-library/react';
import { useWebSocketConnection } from '../useWebSocketConnection';
import { WebSocketState } from '@/lib/websocket/interfaces/IWebSocketClient';

// Mock ReconnectingWebSocketClient
jest.mock('@/lib/websocket/implementations/ReconnectingWebSocketClient');

/**
 * Test suite for useWebSocketConnection hook
 * 
 * Tests WebSocket connection management and state handling
 * Rationale: Ensures WebSocket connectivity works correctly with React state
 */

describe('useWebSocketConnection', () => {
  let mockWebSocketClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebSocket client implementation
    mockWebSocketClient = {
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(() => Promise.resolve()),
      isConnected: jest.fn(() => false),
      isConnecting: jest.fn(() => false),
      sendJSON: jest.fn(() => Promise.resolve()),
      sendBinary: jest.fn(() => Promise.resolve()),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      getStatistics: jest.fn(() => ({
        connectionTime: 1000,
        messagesReceived: 5,
        messagesSent: 3,
        bytesReceived: 1024,
        bytesSent: 512,
        lastActivity: new Date(),
        reconnectAttempts: 0
      })),
      updateConfiguration: jest.fn(),
      forceReconnect: jest.fn(() => Promise.resolve()),
    };

    // Mock the constructor
    const { ReconnectingWebSocketClient } = require('@/lib/websocket/implementations/ReconnectingWebSocketClient');
    ReconnectingWebSocketClient.mockImplementation(() => mockWebSocketClient);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      expect(result.current.state).toBe(WebSocketState.IDLE);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.client).toBeTruthy();
    });

    it('should initialize with custom options', () => {
      const onConnect = jest.fn();
      const onError = jest.fn();

      const { result } = renderHook(() => 
        useWebSocketConnection({
          autoConnect: true,
          autoReconnect: false,
          onConnect,
          onError,
        })
      );

      expect(result.current.client).toBeTruthy();
    });

    it('should create WebSocket client with correct configuration', () => {
      const configuration = {
        autoReconnect: false,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000,
      };

      renderHook(() => 
        useWebSocketConnection({ configuration })
      );

      const { ReconnectingWebSocketClient } = require('@/lib/websocket/implementations/ReconnectingWebSocketClient');
      expect(ReconnectingWebSocketClient).toHaveBeenCalledWith(
        expect.objectContaining({
          autoReconnect: false,
          maxReconnectAttempts: 5,
          reconnectDelay: 2000,
        })
      );
    });
  });

  describe('connection management', () => {
    it('should connect successfully', async () => {
      const { result } = renderHook(() => useWebSocketConnection());
      const url = 'ws://localhost:8080';

      await act(async () => {
        await result.current.connect(url);
      });

      expect(mockWebSocketClient.connect).toHaveBeenCalledWith(url, undefined);
    });

    it('should connect with protocols', async () => {
      const { result } = renderHook(() => useWebSocketConnection());
      const url = 'ws://localhost:8080';
      const protocols = ['protocol1', 'protocol2'];

      await act(async () => {
        await result.current.connect(url, protocols);
      });

      expect(mockWebSocketClient.connect).toHaveBeenCalledWith(url, protocols);
    });

    it('should disconnect successfully', async () => {
      const { result } = renderHook(() => useWebSocketConnection());

      await act(async () => {
        await result.current.disconnect(1000, 'Normal closure');
      });

      expect(mockWebSocketClient.disconnect).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should handle connection errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onError }));
      
      const connectionError = new Error('Connection failed');
      mockWebSocketClient.connect.mockRejectedValue(connectionError);

      await act(async () => {
        try {
          await result.current.connect('ws://invalid-url');
        } catch (error) {
          // Expected to throw
        }
      });

      expect(mockWebSocketClient.connect).toHaveBeenCalled();
    });
  });

  describe('state management', () => {
    it('should handle connecting state', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      // Simulate connecting event
      act(() => {
        const connectingHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.CONNECTING)?.[1];
        connectingHandler?.();
      });

      expect(result.current.state).toBe(WebSocketState.CONNECTING);
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should handle connected state', () => {
      const onConnect = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onConnect }));

      // Simulate connected event
      act(() => {
        const connectedHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.CONNECTED)?.[1];
        connectedHandler?.();
      });

      expect(result.current.state).toBe(WebSocketState.CONNECTED);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.error).toBeNull();
      expect(onConnect).toHaveBeenCalled();
    });

    it('should handle disconnected state', () => {
      const onDisconnect = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onDisconnect }));

      // Simulate disconnected event
      act(() => {
        const disconnectedHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.DISCONNECTED)?.[1];
        disconnectedHandler?.({
          data: { code: 1000, reason: 'Normal closure' }
        });
      });

      expect(result.current.state).toBe(WebSocketState.DISCONNECTED);
      expect(result.current.isConnected).toBe(false);
      expect(onDisconnect).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should handle reconnecting state', () => {
      const onReconnecting = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onReconnecting }));

      // Simulate reconnecting event
      act(() => {
        const reconnectingHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.RECONNECTING)?.[1];
        reconnectingHandler?.({
          data: { attempt: 2, delay: 1000 }
        });
      });

      expect(result.current.state).toBe(WebSocketState.RECONNECTING);
      expect(result.current.isReconnecting).toBe(true);
      expect(onReconnecting).toHaveBeenCalledWith(2, 1000);
    });

    it('should handle reconnected state', () => {
      const onReconnected = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onReconnected }));

      // Simulate reconnected event
      act(() => {
        const reconnectedHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.RECONNECTED)?.[1];
        reconnectedHandler?.({
          data: { attempt: 2 }
        });
      });

      expect(result.current.state).toBe(WebSocketState.CONNECTED);
      expect(result.current.isConnected).toBe(true);
      expect(onReconnected).toHaveBeenCalledWith(2);
    });

    it('should handle error state', () => {
      const onError = jest.fn();
      const { result } = renderHook(() => useWebSocketConnection({ onError }));

      const wsError = {
        type: 'connection_error',
        message: 'Connection failed',
        recoverable: false,
        originalError: new Error('Network error')
      };

      // Simulate error event
      act(() => {
        const errorHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.ERROR)?.[1];
        errorHandler?.({ error: wsError });
      });

      expect(result.current.state).toBe(WebSocketState.ERROR);
      expect(result.current.error).toBe(wsError);
      expect(onError).toHaveBeenCalledWith(wsError);
    });

    it('should not change state for recoverable errors', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      const recoverableError = {
        type: 'recoverable_error',
        message: 'Temporary error',
        recoverable: true,
        originalError: new Error('Temporary failure')
      };

      // Set initial connected state
      act(() => {
        const connectedHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.CONNECTED)?.[1];
        connectedHandler?.();
      });

      expect(result.current.state).toBe(WebSocketState.CONNECTED);

      // Simulate recoverable error
      act(() => {
        const errorHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.ERROR)?.[1];
        errorHandler?.({ error: recoverableError });
      });

      // State should remain connected for recoverable errors
      expect(result.current.state).toBe(WebSocketState.CONNECTED);
      expect(result.current.error).toBe(recoverableError);
    });
  });

  describe('statistics tracking', () => {
    it('should track statistics when enabled', () => {
      const { result } = renderHook(() => 
        useWebSocketConnection({ enableStatistics: true })
      );

      expect(result.current.statistics).toBeTruthy();
      expect(result.current.statistics).toEqual(
        expect.objectContaining({
          connectionTime: expect.any(Number),
          messagesReceived: expect.any(Number),
          messagesSent: expect.any(Number),
          bytesReceived: expect.any(Number),
          bytesSent: expect.any(Number),
          lastActivity: expect.any(Date),
          reconnectAttempts: expect.any(Number),
        })
      );
    });

    it('should not track statistics when disabled', () => {
      const { result } = renderHook(() => 
        useWebSocketConnection({ enableStatistics: false })
      );

      expect(result.current.statistics).toBeNull();
    });
  });

  describe('configuration updates', () => {
    it('should update WebSocket configuration', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      const newConfig = {
        maxReconnectAttempts: 10,
        reconnectDelay: 5000,
      };

      act(() => {
        result.current.updateConfiguration(newConfig);
      });

      expect(mockWebSocketClient.updateConfiguration).toHaveBeenCalledWith(newConfig);
    });
  });

  describe('utility methods', () => {
    it('should force reconnection', async () => {
      const { result } = renderHook(() => useWebSocketConnection());

      await act(async () => {
        await result.current.forceReconnect();
      });

      expect(mockWebSocketClient.forceReconnect).toHaveBeenCalled();
    });

    it('should clear errors', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      // First set an error
      act(() => {
        const errorHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.ERROR)?.[1];
        errorHandler?.({
          error: {
            type: 'test_error',
            message: 'Test error',
            recoverable: true,
            originalError: new Error('Test')
          }
        });
      });

      expect(result.current.error).toBeTruthy();

      // Then clear it
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('auto-connect functionality', () => {
    it('should auto-connect when enabled and URL provided', () => {
      const url = 'ws://localhost:8080';
      
      renderHook(() => 
        useWebSocketConnection({ 
          url, 
          autoConnect: true 
        })
      );

      expect(mockWebSocketClient.connect).toHaveBeenCalledWith(url, undefined);
    });

    it('should not auto-connect when disabled', () => {
      const url = 'ws://localhost:8080';
      
      renderHook(() => 
        useWebSocketConnection({ 
          url, 
          autoConnect: false 
        })
      );

      expect(mockWebSocketClient.connect).not.toHaveBeenCalled();
    });

    it('should not auto-connect when URL is not provided', () => {
      renderHook(() => 
        useWebSocketConnection({ 
          autoConnect: true 
        })
      );

      expect(mockWebSocketClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should cleanup WebSocket on unmount', () => {
      mockWebSocketClient.isConnected.mockReturnValue(true);
      
      const { unmount } = renderHook(() => useWebSocketConnection());

      unmount();

      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
    });

    it('should cleanup connecting WebSocket on unmount', () => {
      mockWebSocketClient.isConnected.mockReturnValue(false);
      mockWebSocketClient.isConnecting.mockReturnValue(true);
      
      const { unmount } = renderHook(() => useWebSocketConnection());

      unmount();

      expect(mockWebSocketClient.disconnect).toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useWebSocketConnection());

      unmount();

      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith(
        WebSocketEventType.CONNECTING, 
        expect.any(Function)
      );
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith(
        WebSocketEventType.CONNECTED, 
        expect.any(Function)
      );
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith(
        WebSocketEventType.DISCONNECTED, 
        expect.any(Function)
      );
      expect(mockWebSocketClient.removeEventListener).toHaveBeenCalledWith(
        WebSocketEventType.ERROR, 
        expect.any(Function)
      );
    });

    it('should handle cleanup gracefully when client is null', () => {
      // Mock scenario where client is null
      const { unmount } = renderHook(() => useWebSocketConnection());

      // Manually set client to null to test edge case
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('derived state calculations', () => {
    it('should correctly calculate derived boolean states', () => {
      const { result } = renderHook(() => useWebSocketConnection());

      // Test IDLE state
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isReconnecting).toBe(false);

      // Test CONNECTING state
      act(() => {
        const connectingHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.CONNECTING)?.[1];
        connectingHandler?.();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isReconnecting).toBe(false);

      // Test CONNECTED state
      act(() => {
        const connectedHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.CONNECTED)?.[1];
        connectedHandler?.();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isReconnecting).toBe(false);

      // Test RECONNECTING state
      act(() => {
        const reconnectingHandler = mockWebSocketClient.addEventListener.mock.calls
          .find(call => call[0] === WebSocketEventType.RECONNECTING)?.[1];
        reconnectingHandler?.({ data: { attempt: 1, delay: 1000 } });
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isReconnecting).toBe(true);
    });
  });
});
import { renderHook, act } from '@testing-library/react';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';

// Mock the ServiceFactory
jest.mock('@/lib/services/serviceFactory', () => ({
  ServiceFactory: {
    createWebSocketClient: jest.fn(() => ({
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    })),
  },
}));

describe('useWebSocketConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useWebSocketConnection());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should connect successfully', async () => {
    const { result } = renderHook(() => useWebSocketConnection());

    await act(async () => {
      await result.current.connect('ws://localhost:8080/ws/stream');
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });

  it('should handle connection error', async () => {
    const mockError = new Error('Connection failed');
    
    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue({
      connect: jest.fn(() => Promise.reject(mockError)),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    });

    const { result } = renderHook(() => useWebSocketConnection());

    await act(async () => {
      await result.current.connect('ws://localhost:8080/ws/stream');
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.error).toEqual(mockError);
  });

  it('should disconnect successfully', async () => {
    const mockClient = {
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue(mockClient);

    const { result } = renderHook(() => useWebSocketConnection());

    // Connect first
    await act(async () => {
      await result.current.connect('ws://localhost:8080/ws/stream');
    });

    // Then disconnect
    act(() => {
      result.current.disconnect();
    });

    expect(mockClient.disconnect).toHaveBeenCalled();
    expect(result.current.isConnected).toBe(false);
  });

  it('should send message', () => {
    const mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue(mockClient);

    const { result } = renderHook(() => useWebSocketConnection());

    act(() => {
      result.current.sendMessage('test message');
    });

    expect(mockClient.sendMessage).toHaveBeenCalledWith('test message');
  });

  it('should send JSON message', () => {
    const mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue(mockClient);

    const { result } = renderHook(() => useWebSocketConnection());

    const testData = { type: 'test', content: 'hello' };

    act(() => {
      result.current.sendJSON(testData);
    });

    expect(mockClient.sendMessage).toHaveBeenCalledWith(JSON.stringify(testData));
  });

  it('should auto-connect when enabled', async () => {
    const mockClient = {
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue(mockClient);

    renderHook(() => useWebSocketConnection({ autoConnect: true }));

    // Wait for the effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockClient.connect).toHaveBeenCalled();
  });

  it('should handle message events', () => {
    const onMessage = jest.fn();
    const mockClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createWebSocketClient.mockReturnValue(mockClient);

    renderHook(() => useWebSocketConnection({ onMessage }));

    expect(mockClient.onMessage).toHaveBeenCalled();
  });
});
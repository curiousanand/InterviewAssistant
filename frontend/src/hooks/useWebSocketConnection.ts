import { useState, useCallback, useEffect, useRef } from 'react';
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';
import { ReconnectingWebSocketClient } from '@/lib/websocket/implementations/ReconnectingWebSocketClient';
import { 
  WebSocketState, 
  WebSocketEventType, 
  WebSocketError,
  WebSocketStatistics,
  WebSocketConfiguration
} from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * WebSocket connection management hook
 * 
 * Why: Manages WebSocket connection lifecycle with React state integration
 * Pattern: Custom Hook - encapsulates WebSocket management complexity
 * Rationale: Provides clean API for components to manage real-time communication
 */

interface UseWebSocketConnectionOptions {
  url?: string;
  autoConnect?: boolean;
  autoReconnect?: boolean;
  protocols?: string | string[];
  configuration?: Partial<WebSocketConfiguration>;
  onConnect?: () => void;
  onDisconnect?: (code?: number, reason?: string) => void;
  onError?: (error: WebSocketError) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onReconnected?: (attempt: number) => void;
  enableStatistics?: boolean;
}

interface UseWebSocketConnectionReturn {
  client: IWebSocketClient | null;
  state: WebSocketState;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: WebSocketError | null;
  statistics: WebSocketStatistics | null;
  connect: (url?: string, protocols?: string | string[]) => Promise<void>;
  disconnect: (code?: number, reason?: string) => Promise<void>;
  forceReconnect: () => Promise<void>;
  updateConfiguration: (config: Partial<WebSocketConfiguration>) => void;
  clearError: () => void;
}

const DEFAULT_OPTIONS: UseWebSocketConnectionOptions = {
  url: '',
  autoConnect: false,
  autoReconnect: true,
  protocols: undefined,
  configuration: {},
  onConnect: () => {},
  onDisconnect: () => {},
  onError: () => {},
  onReconnecting: () => {},
  onReconnected: () => {},
  enableStatistics: true
};

export function useWebSocketConnection(
  options: UseWebSocketConnectionOptions = {}
): UseWebSocketConnectionReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [client, setClient] = useState<IWebSocketClient | null>(null);
  const [state, setState] = useState<WebSocketState>(WebSocketState.IDLE);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [statistics, setStatistics] = useState<WebSocketStatistics | null>(null);
  
  // Refs for stable references
  const optionsRef = useRef(opts);
  const statisticsIntervalRef = useRef<number | null>(null);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
  }, [options]);

  // Derived state
  const isConnected = state === WebSocketState.CONNECTED;
  const isConnecting = state === WebSocketState.CONNECTING;
  const isReconnecting = state === WebSocketState.RECONNECTING;

  // Initialize WebSocket client
  useEffect(() => {
    const config: Partial<WebSocketConfiguration> = {
      autoReconnect: opts.autoReconnect,
      enableLogging: process.env.NODE_ENV === 'development',
      ...opts.configuration
    };

    const wsClient = new ReconnectingWebSocketClient(config);
    setClient(wsClient);

    return () => {
      // Cleanup on unmount
      if (wsClient.isConnected() || wsClient.isConnecting()) {
        wsClient.disconnect().catch(console.error);
      }
    };
  }, []); // Only run once on mount

  // Setup event listeners
  useEffect(() => {
    if (!client) return;

    const handleConnecting = () => {
      setState(WebSocketState.CONNECTING);
      setError(null);
    };

    const handleConnected = () => {
      setState(WebSocketState.CONNECTED);
      setError(null);
      optionsRef.current.onConnect();
    };

    const handleDisconnected = (event: any) => {
      setState(WebSocketState.DISCONNECTED);
      optionsRef.current.onDisconnect(event.data?.code, event.data?.reason);
    };

    const handleReconnecting = (event: any) => {
      setState(WebSocketState.RECONNECTING);
      setError(null);
      const { attempt, delay } = event.data || {};
      optionsRef.current.onReconnecting(attempt, delay);
    };

    const handleReconnected = (event: any) => {
      setState(WebSocketState.CONNECTED);
      setError(null);
      const { attempt } = event.data || {};
      optionsRef.current.onReconnected(attempt);
    };

    const handleError = (event: any) => {
      const wsError = event.error as WebSocketError;
      setError(wsError);
      
      // Only set error state if not recoverable
      if (!wsError.recoverable) {
        setState(WebSocketState.ERROR);
      }
      
      optionsRef.current.onError(wsError);
    };

    const handleStateChange = (event: any) => {
      const { newState } = event.data || {};
      if (newState) {
        setState(newState);
      }
    };

    // Register event listeners
    client.addEventListener(WebSocketEventType.CONNECTING, handleConnecting);
    client.addEventListener(WebSocketEventType.CONNECTED, handleConnected);
    client.addEventListener(WebSocketEventType.DISCONNECTED, handleDisconnected);
    client.addEventListener(WebSocketEventType.RECONNECTING, handleReconnecting);
    client.addEventListener(WebSocketEventType.RECONNECTED, handleReconnected);
    client.addEventListener(WebSocketEventType.ERROR, handleError);
    client.addEventListener(WebSocketEventType.STATE_CHANGE, handleStateChange);

    return () => {
      // Remove event listeners
      client.removeEventListener(WebSocketEventType.CONNECTING, handleConnecting);
      client.removeEventListener(WebSocketEventType.CONNECTED, handleConnected);
      client.removeEventListener(WebSocketEventType.DISCONNECTED, handleDisconnected);
      client.removeEventListener(WebSocketEventType.RECONNECTING, handleReconnecting);
      client.removeEventListener(WebSocketEventType.RECONNECTED, handleReconnected);
      client.removeEventListener(WebSocketEventType.ERROR, handleError);
      client.removeEventListener(WebSocketEventType.STATE_CHANGE, handleStateChange);
    };
  }, [client]);

  // Action implementations
  const connect = useCallback(async (url?: string, protocols?: string | string[]) => {
    if (!client) {
      throw new Error('WebSocket client not initialized');
    }

    const connectUrl = url || opts.url;
    const connectProtocols = protocols || opts.protocols;

    if (!connectUrl) {
      throw new Error('WebSocket URL is required');
    }

    try {
      await client.connect(connectUrl, connectProtocols);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }, [client, opts.url, opts.protocols]);

  // Auto-connect if configured
  useEffect(() => {
    if (opts.autoConnect && opts.url && client && state === WebSocketState.IDLE) {
      connect(opts.url, opts.protocols).catch(console.error);
    }
  }, [opts.autoConnect, opts.url, client, state, connect]);

  // Statistics polling
  useEffect(() => {
    if (opts.enableStatistics && client) {
      const updateStatistics = () => {
        try {
          const stats = client.getStatistics();
          setStatistics(stats);
        } catch (error) {
          console.warn('Failed to get WebSocket statistics:', error);
        }
      };

      // Initial update
      updateStatistics();

      // Periodic updates
      statisticsIntervalRef.current = window.setInterval(updateStatistics, 5000);

      return () => {
        if (statisticsIntervalRef.current !== null) {
          clearInterval(statisticsIntervalRef.current);
          statisticsIntervalRef.current = null;
        }
      };
    }
  }, [opts.enableStatistics, client]);

  const disconnect = useCallback(async (code?: number, reason?: string) => {
    if (!client) {
      return;
    }

    try {
      await client.disconnect(code, reason);
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
      throw error;
    }
  }, [client]);

  const forceReconnect = useCallback(async () => {
    if (!client) {
      throw new Error('WebSocket client not initialized');
    }

    try {
      await client.forceReconnect();
    } catch (error) {
      console.error('Failed to force reconnect WebSocket:', error);
      throw error;
    }
  }, [client]);

  const updateConfiguration = useCallback((config: Partial<WebSocketConfiguration>) => {
    if (!client) {
      return;
    }

    try {
      client.updateConfiguration(config);
    } catch (error) {
      console.error('Failed to update WebSocket configuration:', error);
    }
  }, [client]);

  const clearError = useCallback(() => {
    setError(null);
    if (client) {
      client.clearError();
    }
  }, [client]);

  return {
    client,
    state,
    isConnected,
    isConnecting,
    isReconnecting,
    error,
    statistics,
    connect,
    disconnect,
    forceReconnect,
    updateConfiguration,
    clearError
  };
}

/**
 * Convenience hook for simple WebSocket connections
 */
export function useSimpleWebSocket(
  url: string,
  options: Omit<UseWebSocketConnectionOptions, 'url'> = {}
): UseWebSocketConnectionReturn {
  return useWebSocketConnection({
    ...options,
    url,
    autoConnect: options.autoConnect ?? true
  });
}

/**
 * Hook for WebSocket with automatic reconnection
 */
export function useReconnectingWebSocket(
  url: string,
  options: Omit<UseWebSocketConnectionOptions, 'url' | 'autoReconnect'> = {}
): UseWebSocketConnectionReturn {
  return useWebSocketConnection({
    ...options,
    url,
    autoConnect: options.autoConnect ?? true,
    autoReconnect: true
  });
}

/**
 * Hook with typed message handling
 */
export function useTypedWebSocket<TMessage = any>(
  url: string,
  options: Omit<UseWebSocketConnectionOptions, 'url'> & {
    onMessage?: (message: TMessage) => void;
    onTextMessage?: (message: string) => void;
    onBinaryMessage?: (data: ArrayBuffer) => void;
  } = {}
): UseWebSocketConnectionReturn & {
  sendMessage: (message: TMessage) => Promise<void>;
  sendText: (text: string) => Promise<void>;
  sendBinary: (data: ArrayBuffer | Uint8Array) => Promise<void>;
} {
  const connection = useWebSocketConnection({ ...options, url });

  // Setup message listeners
  useEffect(() => {
    if (!connection.client) return;

    const handleJsonMessage = (event: any) => {
      if (options.onMessage) {
        options.onMessage(event.data);
      }
    };

    const handleTextMessage = (event: any) => {
      if (options.onTextMessage) {
        options.onTextMessage(event.data);
      }
    };

    const handleBinaryMessage = (event: any) => {
      if (options.onBinaryMessage) {
        options.onBinaryMessage(event.data);
      }
    };

    connection.client.addEventListener(WebSocketEventType.JSON_MESSAGE, handleJsonMessage);
    connection.client.addEventListener(WebSocketEventType.TEXT_MESSAGE, handleTextMessage);
    connection.client.addEventListener(WebSocketEventType.BINARY_MESSAGE, handleBinaryMessage);

    return () => {
      connection.client?.removeEventListener(WebSocketEventType.JSON_MESSAGE, handleJsonMessage);
      connection.client?.removeEventListener(WebSocketEventType.TEXT_MESSAGE, handleTextMessage);
      connection.client?.removeEventListener(WebSocketEventType.BINARY_MESSAGE, handleBinaryMessage);
    };
  }, [connection.client, options.onMessage, options.onTextMessage, options.onBinaryMessage]);

  const sendMessage = useCallback(async (message: TMessage) => {
    if (!connection.client) {
      throw new Error('WebSocket not connected');
    }
    await connection.client.sendJSON(message);
  }, [connection.client]);

  const sendText = useCallback(async (text: string) => {
    if (!connection.client) {
      throw new Error('WebSocket not connected');
    }
    await connection.client.sendText(text);
  }, [connection.client]);

  const sendBinary = useCallback(async (data: ArrayBuffer | Uint8Array) => {
    if (!connection.client) {
      throw new Error('WebSocket not connected');
    }
    await connection.client.sendBinary(data);
  }, [connection.client]);

  return {
    ...connection,
    sendMessage,
    sendText,
    sendBinary
  };
}
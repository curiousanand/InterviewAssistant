/**
 * Test Utilities
 * Provides custom render functions and test helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionState, RecordingState, Message, Session } from '../../src/types';

// Custom render with providers if needed
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, options);
}

// Mock data factories
export const mockFactory = {
  connectionState: (overrides?: Partial<ConnectionState>): ConnectionState => ({
    status: 'connected',
    reconnectAttempts: 0,
    ...overrides,
  }),

  recordingState: (overrides?: Partial<RecordingState>): RecordingState => ({
    isRecording: false,
    isProcessing: false,
    audioLevel: 0,
    error: null,
    ...overrides,
  }),

  message: (overrides?: Partial<Message>): Message => ({
    id: 'msg-' + Math.random().toString(36).substr(2, 9),
    role: 'user',
    content: 'Test message',
    timestamp: new Date().toISOString(),
    sessionId: 'session-123',
    status: 'completed',
    ...overrides,
  }),

  session: (overrides?: Partial<Session>): Session => ({
    id: 'session-' + Math.random().toString(36).substr(2, 9),
    status: 'active',
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    messageCount: 0,
    targetLanguage: 'en-US',
    autoDetectLanguage: true,
    ...overrides,
  }),
};

// WebSocket mock helper
export class MockWebSocketClient {
  isConnected = jest.fn().mockReturnValue(true);
  connect = jest.fn().mockResolvedValue(undefined);
  disconnect = jest.fn();
  sendAudioData = jest.fn().mockResolvedValue(undefined);
  startSession = jest.fn().mockResolvedValue(undefined);
  endSession = jest.fn().mockResolvedValue(undefined);
  onConnectionStateChange = jest.fn();
  onMessageReceived = jest.fn();
  onErrorOccurred = jest.fn();
  getConnectionState = jest.fn().mockReturnValue(mockFactory.connectionState());
  destroy = jest.fn();
}

// Audio service mock helper
export class MockAudioStreamingService {
  initialize = jest.fn().mockResolvedValue(undefined);
  startRecording = jest.fn().mockResolvedValue(undefined);
  stopRecording = jest.fn().mockResolvedValue(undefined);
  cleanup = jest.fn().mockResolvedValue(undefined);
  getRecordingState = jest.fn().mockReturnValue(mockFactory.recordingState());
  onRecordingStateChange = jest.fn();
  onErrorOccurred = jest.fn();
}

// Conversation service mock helper
export class MockConversationService {
  createSession = jest.fn().mockResolvedValue(mockFactory.session());
  clearConversation = jest.fn();
  cleanup = jest.fn();
  onSessionStateChange = jest.fn();
  onConversationChange = jest.fn();
  onTranscriptReceived = jest.fn();
  onAssistantResponseReceived = jest.fn();
  onErrorOccurred = jest.fn();
}

// Async utilities
export const waitForAsync = async (callback: () => void, timeout = 1000) => {
  await waitFor(callback, { timeout });
};

// User event setup
export const setupUser = () => userEvent.setup();

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
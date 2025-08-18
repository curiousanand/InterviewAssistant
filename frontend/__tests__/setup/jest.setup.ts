/**
 * Jest Setup File
 * Configures the test environment and global mocks
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { mockWebAudioAPI, MockAudioCaptureFactory } from './audio-mocks';

// Polyfills for Node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  }
}));

// Mock environment variables
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:8080/ws/stream';
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8080/api';

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.CONNECTING;
  url: string;
  
  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.({} as Event);
    }, 0);
  }
  
  send = jest.fn();
  close = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  
  onopen?: (event: Event) => void;
  onclose?: (event: CloseEvent) => void;
  onerror?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
}

global.WebSocket = MockWebSocket as any;

// Mock AudioCaptureFactory
jest.mock('../../src/lib/audio/AudioCaptureFactory', () => ({
  AudioCaptureFactory: MockAudioCaptureFactory,
}));

// Initialize Web Audio API mocks
mockWebAudioAPI();

// Mock scrollIntoView for testing
Element.prototype.scrollIntoView = jest.fn();

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
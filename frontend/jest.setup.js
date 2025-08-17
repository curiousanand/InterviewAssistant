import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    reload: jest.fn(),
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  createMediaStreamSource: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
  createScriptProcessor: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    onaudioprocess: null,
  })),
  audioWorklet: {
    addModule: jest.fn(() => Promise.resolve()),
  },
  sampleRate: 44100,
  state: 'running',
  suspend: jest.fn(() => Promise.resolve()),
  resume: jest.fn(() => Promise.resolve()),
  close: jest.fn(() => Promise.resolve()),
}))

global.AudioWorkletNode = jest.fn().mockImplementation(() => ({
  port: {
    postMessage: jest.fn(),
    onmessage: null,
  },
  connect: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() =>
      Promise.resolve({
        getTracks: () => [
          {
            stop: jest.fn(),
            kind: 'audio',
          },
        ],
      })
    ),
  },
})

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
}))

global.MediaRecorder.isTypeSupported = jest.fn(() => true)

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  readyState: WebSocket.CONNECTING,
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
}))

// WebSocket constants
global.WebSocket.CONNECTING = 0
global.WebSocket.OPEN = 1
global.WebSocket.CLOSING = 2
global.WebSocket.CLOSED = 3

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Suppress console warnings in tests
const originalConsoleWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalConsoleWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalConsoleWarn
})
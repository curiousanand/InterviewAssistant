# Interview Assistant - Frontend

Next.js 14 frontend application with real-time audio capture, WebSocket communication, and responsive chat interface.

## Architecture

The frontend follows a modular architecture with clear separation of concerns:

```
/frontend
├── /app                  # Next.js App Router pages
├── /components          
│   ├── /smart           # Container components with business logic
│   └── /presentational  # Pure UI components
├── /lib
│   ├── /audio           # Audio capture and processing
│   ├── /websocket       # WebSocket client and communication
│   ├── /conversation    # Conversation state management
│   └── /services        # Service interfaces and factories
├── /hooks               # Custom React hooks
└── /types               # TypeScript type definitions
```

## Key Modules

### Audio Module
- `IAudioCapture` - Audio capture interface
- `AudioWorkletCapture` - Low-latency audio capture
- `MediaRecorderCapture` - Fallback for older browsers
- `AudioCaptureFactory` - Browser capability detection

### Communication Module
- `IWebSocketClient` - WebSocket interface
- `ReconnectingWebSocketClient` - Auto-reconnection logic
- `MessageRouter` - Message handling and routing

### Conversation Module
- `ConversationStateManager` - Conversation state
- `MessageStore` - Message persistence
- `TranscriptProcessor` - Transcript handling

## Design Patterns

- **Factory Pattern**: Audio capture selection
- **Strategy Pattern**: Recording modes
- **Observer Pattern**: Real-time updates
- **Dependency Injection**: React Context providers

## Setup

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### Configuration

Edit `.env.local`:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws/stream
NEXT_PUBLIC_API_KEY=your_api_key_here
NEXT_PUBLIC_TARGET_LANGUAGE=en
```

### Running

```bash
# Development
pnpm dev

# Build
pnpm build

# Production
pnpm start
```

## Testing

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

## Key Features

- **Audio Capture**: AudioWorklet for low-latency, MediaRecorder fallback
- **WebSocket**: Real-time communication with auto-reconnection
- **Responsive UI**: TailwindCSS with shadcn/ui components
- **State Management**: Custom hooks with React Context
- **TypeScript**: Full type safety throughout

## Browser Support

- Chrome 90+ (AudioWorklet)
- Firefox 85+ (AudioWorklet)
- Safari 14+ (MediaRecorder fallback)
- Edge 90+ (AudioWorklet)

## Performance

- Audio chunk size: 100-200ms
- UI updates: 60fps target
- Bundle size: Code-split and lazy-loaded
- Memory: Automatic cleanup for long sessions
# Interview Assistant - Shared Types and Interfaces

Common TypeScript types and interfaces shared between frontend and backend for type-safe communication.

## Structure

```
/shared
├── /types
│   ├── websocket.ts    # WebSocket message types
│   ├── session.ts      # Session and conversation types
│   ├── audio.ts        # Audio format and chunk types
│   └── responses.ts    # API response types
└── /constants
    ├── events.ts       # Event type constants
    └── errors.ts       # Error code constants
```

## Usage

### Frontend
```typescript
import { WebSocketMessage, SessionState } from '@shared/types';
```

### Backend (if using TypeScript for type generation)
```typescript
// Generate TypeScript types from Java classes
// Use tools like typescript-generator-maven-plugin
```

## Key Types

- `WebSocketMessage` - All WebSocket message formats
- `SessionState` - Session state and metadata
- `TranscriptionEvent` - Transcription event types
- `AIResponseEvent` - AI response streaming events
- `AudioFormat` - Audio configuration types

## Maintaining Type Safety

1. Update types in `/shared` when protocol changes
2. Both frontend and backend must use these types
3. Version control ensures consistency
4. Use strict TypeScript settings
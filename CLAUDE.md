# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InterviewAssistant is a real-time multilingual Q&A assistant that uses Azure Speech Services for voice transcription and Azure OpenAI for intelligent responses. The application streams audio from the browser to a Spring Boot backend via WebSocket, processes it with Azure services, and streams AI responses back in real-time.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui, Web Audio API
- **Backend**: Spring Boot 3, Java 17+, Spring WebSocket, H2 Database
- **Cloud Services**: Azure Speech Services (STT), Azure OpenAI (Chat Completions)
- **Deployment**: Docker containers with docker-compose

## Common Commands

### Development
```bash
# Start with Docker (recommended)
docker-compose up --build

# Or start services individually:
# Backend
cd backend && mvn spring-boot:run

# Frontend  
cd frontend && pnpm dev
```

### Testing
```bash
# Backend tests
cd backend && mvn test

# Frontend tests
cd frontend && pnpm test

# Integration tests
cd backend && mvn test -Dtest=**/*IntegrationTest

# E2E tests
cd frontend && pnpm test:e2e
```

### Build and Lint
```bash
# Backend build
cd backend && mvn clean package

# Frontend build
cd frontend && pnpm build

# Frontend lint
cd frontend && pnpm lint
```

## Architecture

### High-Level Flow
1. **Browser** captures microphone audio (Web Audio API)
2. **WebSocket** streams 100-200ms audio chunks to Spring Boot backend
3. **Azure Speech** processes audio stream for real-time transcription
4. **Azure OpenAI** generates context-aware responses with streaming
5. **H2 Database** persists conversation history for session continuity

### Key Components

#### Frontend (`/frontend`)
- `app/page.tsx` - Main chat interface
- `components/ChatWindow.tsx` - Message display and conversation UI
- `components/MicButton.tsx` - Recording controls with visual feedback
- `lib/wsClient.ts` - WebSocket client with reconnection logic
- `lib/recorder.ts` - Audio capture using Web Audio API

#### Backend (`/backend`)
- `ws/StreamingWebSocketHandler.java` - Main WebSocket handler
- `service/AzureSpeechService.java` - Speech-to-text integration
- `service/AzureOpenAIService.java` - AI chat completions with streaming
- `service/ConversationService.java` - Session and memory management
- `model/Session.java` & `model/Message.java` - JPA entities

### WebSocket Protocol
- **Binary frames**: 16-bit PCM audio (16kHz, mono)
- **JSON messages**: Control commands and events
- **Event types**: `transcript.partial`, `transcript.final`, `assistant.delta`, `assistant.done`, `error`

### Azure Integration
- **Speech Services**: Streaming STT with partial results and language detection
- **OpenAI**: Chat completions with server-sent streaming for real-time token delivery
- **System Prompt**: Optimized for concise, accurate real-time responses

## Configuration

### Environment Variables
Create `.env` files in both `/frontend` and `/backend` directories:

**Backend (`/backend/.env`)**:
```
AZURE_SPEECH_KEY=your_speech_service_key
AZURE_SPEECH_REGION=your_region
AZURE_OPENAI_KEY=your_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your_chat_model_deployment
APP_API_KEY=shared_secret_for_frontend_auth
```

**Frontend (`/frontend/.env.local`)**:
```
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws/stream
NEXT_PUBLIC_API_KEY=shared_secret_for_backend_auth
```

## Development Guidelines

### Architecture Principles

#### SOLID Principles Implementation
- **Single Responsibility**: Each class/module has one clear purpose and reason to change
- **Open/Closed**: Use interfaces and abstract classes for extensibility without modification
- **Liskov Substitution**: All implementations must be interchangeable through their interfaces
- **Interface Segregation**: Create focused, minimal interfaces (IAudioCapture, ITranscriptionService, etc.)
- **Dependency Inversion**: Inject all dependencies through interfaces, never depend on concrete implementations

#### Design Patterns Usage
- **Factory Pattern**: Use for creating audio processors, transcription services, and WebSocket clients
- **Strategy Pattern**: Implement for recording modes, response delivery, and error handling
- **Observer Pattern**: Use for WebSocket events, conversation state changes, and UI updates
- **Repository Pattern**: Abstract all data access through repository interfaces
- **Adapter Pattern**: Wrap external services (Azure Speech, OpenAI) with domain-specific interfaces
- **Chain of Responsibility**: Process messages and handle errors through configurable chains

### Module Development

#### Frontend Modules
```typescript
// Always define interfaces first
interface IAudioCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioData(callback: (data: Float32Array) => void): void;
}

// Implement with clear rationale comments
/**
 * AudioWorklet-based capture for low-latency audio processing
 * Why: Provides better performance than MediaRecorder for real-time applications
 * When: Use as primary implementation, fallback to MediaRecorder if unavailable
 */
class AudioWorkletCapture implements IAudioCapture {
  // Implementation with detailed comments explaining design decisions
}
```

#### Backend Modules
```java
// Use dependency injection consistently
@Service
public class ConversationService {
    
    private final ITranscriptionService transcriptionService;
    private final IAIService aiService;
    private final ISessionRepository sessionRepository;
    
    /**
     * Constructor injection for testability and flexibility
     * Why: Enables easy mocking and service replacement
     */
    public ConversationService(
        ITranscriptionService transcriptionService,
        IAIService aiService, 
        ISessionRepository sessionRepository
    ) {
        this.transcriptionService = transcriptionService;
        this.aiService = aiService;
        this.sessionRepository = sessionRepository;
    }
}
```

### Audio Processing Guidelines
- **Modular Design**: Use IAudioCapture, IAudioProcessor, and IVoiceActivityDetector interfaces
- **Chunk Size**: Use 100-200ms audio chunks for optimal latency (rationale: balances responsiveness with processing efficiency)
- **Browser Compatibility**: Factory pattern automatically selects AudioWorklet or MediaRecorder
- **Resource Management**: Always cleanup audio resources in finally blocks or using try-with-resources
- **Error Handling**: Graceful degradation from AudioWorklet → MediaRecorder → Manual text input

### Session Management
- **UUID Generation**: Use cryptographically secure UUIDs for session IDs (security consideration)
- **State Management**: Implement ISessionManager interface with multiple backend support
- **Persistence Strategy**: Use Repository pattern for flexible storage backends (H2 → PostgreSQL → Redis)
- **Memory Management**: Automatic summarization after 12+ turns using IConversationSummarizer
- **Restoration Logic**: Full context restoration including conversation history and user preferences

### Error Handling Architecture
```java
// Chain of responsibility for error handling
public class ErrorHandlerChain {
    private IErrorHandler retryableErrorHandler;
    private IErrorHandler userNotificationHandler;
    private IErrorHandler loggingHandler;
    
    /**
     * Process errors through configurable chain
     * Why: Provides consistent error handling across all components
     */
    public void handleError(Exception error, ErrorContext context) {
        retryableErrorHandler
            .setNext(userNotificationHandler)
            .setNext(loggingHandler)
            .handle(error, context);
    }
}
```

### Performance Optimization Strategies
- **Latency Targets**: STT partial results <300ms, first AI token <900ms (user experience requirement)
- **Async Processing**: Use CompletableFuture and reactive streams for non-blocking operations
- **Connection Pooling**: Configure HikariCP for database, HTTP connection pools for Azure services
- **Memory Management**: Monitor conversation memory usage, implement automatic cleanup
- **Caching Strategy**: In-memory caching for frequently accessed session data

### Testing Strategies

#### Unit Testing
```typescript
// Frontend: Test interfaces and business logic
describe('AudioCaptureFactory', () => {
  it('should create AudioWorkletCapture when supported', () => {
    // Test factory pattern implementation
    // Verify correct implementation selection
  });
});
```

```java
// Backend: Test with dependency injection
@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {
    @Mock private ITranscriptionService transcriptionService;
    @Mock private IAIService aiService;
    @InjectMocks private ConversationService conversationService;
    
    @Test
    void shouldProcessConversationCorrectly() {
        // Test business logic with mocked dependencies
    }
}
```

#### Integration Testing
- **WebSocket Integration**: Test complete message flow through handler chains
- **Azure Service Integration**: Use TestContainers for integration testing with mock services
- **Database Integration**: Test repository implementations with different backends

#### Component Interface Testing
```typescript
// Test that all implementations satisfy interface contracts
const audioCaptures: IAudioCapture[] = [
  new AudioWorkletCapture(),
  new MediaRecorderCapture()
];

audioCaptures.forEach(capture => {
  it(`${capture.constructor.name} should implement IAudioCapture correctly`, () => {
    // Test interface contract compliance
  });
});
```

### Code Quality and Maintenance

#### Code Documentation Standards
```typescript
/**
 * Handles real-time audio capture with browser compatibility
 * 
 * Why: Abstracts different browser APIs to provide consistent audio capture
 * When: Use this factory instead of direct AudioWorklet/MediaRecorder instantiation
 * How: Automatically detects browser capabilities and selects best implementation
 * 
 * @example
 * const factory = new AudioCaptureFactory();
 * const capture = factory.createCapture();
 * await capture.start();
 */
export class AudioCaptureFactory {
  // Implementation...
}
```

#### Dependency Management
- **Frontend**: Use exact versions in package.json, avoid wildcard dependencies
- **Backend**: Use Spring Boot's dependency management, explicit version overrides when needed
- **Security**: Regular dependency scanning with `npm audit` and `mvn dependency:check`

#### Performance Monitoring
```typescript
// Built-in performance monitoring
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState<{
    audioLatency: number;
    transcriptionLatency: number;
    aiResponseLatency: number;
  }>();

  // Implementation tracks key performance indicators
  // Why: Enables proactive performance issue detection
};
```

## Advanced Architecture Patterns

### Event-Driven Architecture
```typescript
// Event bus for loose coupling
interface IDomainEvent {
  eventType: string;
  timestamp: Date;
  payload: unknown;
}

/**
 * Central event bus for cross-module communication
 * Why: Reduces coupling between modules
 * Pattern: Observer pattern with type safety
 */
export class DomainEventBus {
  private subscribers = new Map<string, ((event: IDomainEvent) => void)[]>();
  
  subscribe<T extends IDomainEvent>(
    eventType: string, 
    handler: (event: T) => void
  ): void {
    // Implementation enables type-safe event handling
  }
}
```

### Hexagonal Architecture Implementation
```java
// Port (interface) - defines what the application needs
public interface ITranscriptionPort {
    CompletableFuture<TranscriptionResult> transcribe(AudioData audio);
}

// Adapter (implementation) - how external services are integrated
@Component
public class AzureSpeechAdapter implements ITranscriptionPort {
    /**
     * Adapts Azure Speech Service to our domain interface
     * Why: Isolates domain logic from external service details
     * Pattern: Hexagonal Architecture (Ports and Adapters)
     */
    @Override
    public CompletableFuture<TranscriptionResult> transcribe(AudioData audio) {
        // Azure-specific implementation
    }
}
```

### Testing Strategy

#### Test-Driven Development (TDD)
```typescript
// 1. Write test first
describe('ConversationMemoryService', () => {
  it('should summarize conversation when exceeding token limit', async () => {
    // Arrange: Create conversation with many messages
    // Act: Add message that exceeds limit
    // Assert: Verify summarization was triggered
  });
});

// 2. Implement minimum code to pass test
// 3. Refactor while keeping tests green
```

#### Contract Testing
```java
// Test that implementations satisfy interface contracts
@TestMethodSource("transcriptionServiceImplementations")
void shouldHandleAudioTranscription(ITranscriptionService service) {
    // Test all implementations with same contract
    AudioData testAudio = createTestAudio();
    
    CompletableFuture<TranscriptionResult> result = service.transcribe(testAudio);
    
    assertThat(result).completesWithin(Duration.ofSeconds(5));
    assertThat(result.join().getText()).isNotEmpty();
}

static Stream<ITranscriptionService> transcriptionServiceImplementations() {
    return Stream.of(
        new AzureSpeechAdapter(/* config */),
        new MockTranscriptionService(),
        new GoogleSpeechAdapter(/* config */)
    );
}
```

#### Property-Based Testing
```typescript
// Test with generated data to find edge cases
import { fc } from 'fast-check';

describe('AudioProcessor', () => {
  it('should handle any valid audio format', () => {
    fc.assert(fc.property(
      fc.record({
        sampleRate: fc.integer(8000, 48000),
        channels: fc.integer(1, 2),
        bitDepth: fc.constantFrom(16, 24, 32)
      }),
      (audioFormat) => {
        const processor = new AudioProcessor(audioFormat);
        const result = processor.validateFormat(audioFormat);
        expect(result.isValid).toBe(true);
      }
    ));
  });
});
```

## Deployment

### Local Development
```bash
# One-command startup
docker-compose up --build

# Access points:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8080
# - H2 Console: http://localhost:8080/h2-console
```

### Production Considerations
- Replace H2 with PostgreSQL or MongoDB for scalability
- Implement proper authentication (OAuth2/JWT)
- Add TLS termination for HTTPS/WSS
- Use Azure Key Vault for secrets management
- Implement horizontal scaling with session affinity

## Troubleshooting

### Common Issues
- **Microphone access denied**: Ensure HTTPS in production, provide manual text input fallback
- **WebSocket connection fails**: Check CORS configuration and firewall rules
- **Azure service timeouts**: Verify API keys and regional availability
- **Memory issues**: Check conversation summarization and session cleanup

### Debug Tools
- H2 Console: `/h2-console` for database inspection
- Health endpoint: `/api/health` for service status
- Browser dev tools: Network tab for WebSocket message inspection
- Application logs: Structured JSON logging with correlation IDs
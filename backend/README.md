# Interview Assistant - Backend

Spring Boot backend application providing WebSocket-based real-time communication, Azure service integration, and
session management.

## Architecture

The backend follows a layered architecture with clear separation of concerns:

```
/backend
├── /src/main/java/com/interview/assistant
│   ├── /presentation     # WebSocket handlers, REST controllers
│   ├── /application      # Use cases, event handlers, orchestrators
│   ├── /domain          # Entities, value objects, domain services
│   └── /infrastructure  # Azure adapters, repositories, external services
```

## Key Components

### Presentation Layer

- `StreamingWebSocketHandler` - Main WebSocket endpoint with chain of responsibility
- `HealthController` - System health monitoring
- `SessionController` - RESTful session management

### Application Layer

- `StartConversationUseCase` - Initialize conversation sessions
- `ProcessAudioUseCase` - Handle audio processing workflow
- `GenerateResponseUseCase` - Coordinate AI response generation

### Domain Layer

- `Session` - Core session aggregate
- `Message` - Message entity with metadata
- `ConversationMemoryService` - Conversation context management

### Infrastructure Layer

- `AzureSpeechServiceAdapter` - Azure Speech Services integration
- `AzureOpenAIServiceAdapter` - Azure OpenAI integration
- `H2SessionRepository` - Session persistence

## Design Patterns

- **Chain of Responsibility**: Message processing pipeline
- **Adapter Pattern**: External service integration
- **Repository Pattern**: Data access abstraction
- **Factory Pattern**: Service creation
- **Strategy Pattern**: Response delivery strategies

## Setup

### Prerequisites

- Java 17+
- Maven 3.8+
- Azure credentials

### Configuration

Create `src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: interview-assistant-backend
    
server:
  port: 8080

azure:
  speech:
    key: ${AZURE_SPEECH_KEY}
    region: ${AZURE_SPEECH_REGION}
  openai:
    key: ${AZURE_OPENAI_KEY}
    endpoint: ${AZURE_OPENAI_ENDPOINT}
    deployment: ${AZURE_OPENAI_DEPLOYMENT}

app:
  api:
    key: ${APP_API_KEY}
```

### Running

```bash
# Development
mvn spring-boot:run

# Build
mvn clean package

# Run JAR
java -jar target/interview-assistant-backend.jar
```

## Testing

```bash
# All tests
mvn test

# Unit tests only
mvn test -Dtest=**/*Test

# Integration tests
mvn test -Dtest=**/*IntegrationTest
```

## API Documentation

- WebSocket endpoint: `ws://localhost:8080/ws/stream`
- Health check: `GET /api/health`
- Session management: `GET/POST /api/sessions`

See WebSocket protocol documentation in `/docs`.
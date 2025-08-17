# Interview Assistant

A real-time multilingual Q&A assistant using Azure Speech Services for voice transcription and Azure OpenAI for intelligent responses.

## Architecture

This application follows a modular architecture with SOLID principles and design patterns throughout. See our documentation for details:

- [`architecture_design.json`](./architecture_design.json) - Comprehensive architecture with SOLID principles
- [`system_design.json`](./system_design.json) - Detailed system design and component isolation  
- [`prd.json`](./prd.json) - Product requirements with modular feature breakdown
- [`implementation_guide.md`](./implementation_guide.md) - Code examples and pattern implementations
- [`DEVELOPMENT_TODO.md`](./DEVELOPMENT_TODO.md) - Complete development roadmap

## Project Structure

```
/InterviewAssistant
├── /backend          # Spring Boot application (Java 17+)
├── /frontend         # Next.js 14 application (TypeScript)
├── /shared           # Common types and interfaces
├── /docs             # Architecture and API documentation
├── /scripts          # Build and deployment scripts
└── docker-compose.yml # One-command local development
```

## Tech Stack

### Backend
- **Framework**: Spring Boot 3, Java 17+
- **WebSocket**: Spring WebSocket for real-time communication
- **Database**: H2 (development), PostgreSQL (production)
- **Cloud Services**: Azure Speech Services, Azure OpenAI

### Frontend  
- **Framework**: Next.js 14 with App Router, TypeScript
- **Styling**: TailwindCSS with shadcn/ui components
- **Audio**: Web Audio API (AudioWorklet/MediaRecorder)
- **Communication**: WebSocket client with auto-reconnection

## Quick Start

### Prerequisites
- Java 17+
- Node.js 18+
- Docker & Docker Compose
- Azure Speech Services account
- Azure OpenAI account

### Development Setup

1. **Clone the repository**
```bash
git clone [repository-url]
cd InterviewAssistant
```

2. **Set up environment variables**

Backend (`/backend/.env`):
```env
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=your_region_here
AZURE_OPENAI_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
APP_API_KEY=shared_secret_key
```

Frontend (`/frontend/.env.local`):
```env
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws/stream
NEXT_PUBLIC_API_KEY=shared_secret_key
```

3. **Run with Docker Compose** (Recommended)
```bash
docker-compose up --build
```

Or run services individually:

**Backend:**
```bash
cd backend
mvn spring-boot:run
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

4. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- H2 Console: http://localhost:8080/h2-console

## Key Features

- 🎙️ **Real-time Voice Transcription**: Low-latency speech-to-text with Azure Speech Services
- 🤖 **AI-Powered Responses**: Context-aware responses using Azure OpenAI with streaming
- 🌍 **Multi-language Support**: Automatic language detection and translation
- 💾 **Conversation Memory**: Persistent conversation history with automatic summarization
- 🔄 **Robust Error Handling**: Automatic reconnection and graceful degradation
- 📱 **Responsive Design**: Beautiful UI that works on desktop and mobile

## Development

### Testing

```bash
# Backend tests
cd backend && mvn test

# Frontend tests  
cd frontend && pnpm test

# E2E tests
cd frontend && pnpm test:e2e
```

### Code Quality

```bash
# Backend
cd backend && mvn verify

# Frontend
cd frontend && pnpm lint
```

## Architecture Principles

This application strictly follows:

- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **Design Patterns**: Factory, Strategy, Observer, Repository, Adapter, Chain of Responsibility
- **Domain-Driven Design**: Clear separation between domain, application, and infrastructure layers
- **Test-Driven Development**: Comprehensive test coverage at all levels

## Performance Targets

- Audio chunk processing: 100-200ms
- STT partial results: <300ms latency
- First AI token: 500-900ms after final transcript
- WebSocket reconnection: Exponential backoff (200ms → 10s)
- Concurrent sessions: 100+ users

## Contributing

Please read our development guidelines in [`CLAUDE.md`](./CLAUDE.md) and follow the roadmap in [`DEVELOPMENT_TODO.md`](./DEVELOPMENT_TODO.md).

## License

[MIT License](LICENSE)

## Support

For issues and questions, please check our troubleshooting guide or open an issue on GitHub.
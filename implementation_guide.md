# Implementation Guide - Interview Assistant

This guide provides detailed implementation examples following the modular architecture and SOLID principles outlined in `architecture_design.json`.

## Table of Contents
1. [Frontend Module Implementation](#frontend-module-implementation)
2. [Backend Module Implementation](#backend-module-implementation)
3. [Design Pattern Examples](#design-pattern-examples)
4. [Testing Strategies](#testing-strategies)
5. [Development Workflow](#development-workflow)

## Frontend Module Implementation

### Audio Module

#### Interface Definitions
```typescript
// Purpose: Define contracts for audio processing components
// Rationale: Enables dependency injection and easy testing with mocks

/**
 * Abstraction for audio capture functionality
 * Why: Allows different capture implementations (AudioWorklet vs MediaRecorder)
 * without changing dependent code
 */
export interface IAudioCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioData(callback: (audioData: Float32Array) => void): void;
  isSupported(): boolean;
}

/**
 * Abstraction for audio processing (format conversion, VAD)
 * Why: Separates audio processing logic from capture logic
 * following Single Responsibility Principle
 */
export interface IAudioProcessor {
  processAudioChunk(chunk: Float32Array): ProcessedAudioChunk;
  detectVoiceActivity(chunk: Float32Array): boolean;
  convertToTargetFormat(chunk: Float32Array): ArrayBuffer;
}

/**
 * Factory for creating audio capture instances
 * Why: Encapsulates browser detection logic and provides clean creation interface
 */
export interface IAudioCaptureFactory {
  createCapture(): IAudioCapture;
  getSupportedFormats(): AudioFormat[];
}
```

#### Concrete Implementations
```typescript
/**
 * Modern audio capture using AudioWorklet
 * Why: Provides low-latency audio processing in a separate thread
 * Benefits: Better performance and reduced main thread blocking
 */
export class AudioWorkletCapture implements IAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onDataCallback: ((data: Float32Array) => void) | null = null;

  /**
   * Initialize audio context and start capture
   * Why: Lazy initialization reduces resource usage until actually needed
   */
  async start(): Promise<void> {
    try {
      // Initialize audio context with optimal settings for speech
      this.audioContext = new AudioContext({
        sampleRate: 16000, // Optimal for speech recognition
        latencyHint: 'interactive' // Prioritize low latency
      });

      // Request microphone access with speech-optimized constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1, // Mono for reduced bandwidth
          echoCancellation: true, // Improve audio quality
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Load and create the audio worklet
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

      // Set up audio processing pipeline
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.workletNode);

      // Listen for processed audio data from worklet
      this.workletNode.port.onmessage = (event) => {
        if (this.onDataCallback && event.data.audioData) {
          this.onDataCallback(event.data.audioData);
        }
      };

    } catch (error) {
      throw new Error(`Failed to start audio capture: ${error.message}`);
    }
  }

  /**
   * Clean up audio resources
   * Why: Prevents memory leaks and releases microphone access
   */
  async stop(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  onAudioData(callback: (audioData: Float32Array) => void): void {
    this.onDataCallback = callback;
  }

  /**
   * Check if AudioWorklet is supported
   * Why: Graceful degradation for older browsers
   */
  isSupported(): boolean {
    return 'AudioWorklet' in window;
  }
}

/**
 * Fallback audio capture using MediaRecorder
 * Why: Ensures compatibility with browsers that don't support AudioWorklet
 */
export class MediaRecorderCapture implements IAudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private onDataCallback: ((data: Float32Array) => void) | null = null;

  async start(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // Configure MediaRecorder for optimal speech capture
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus', // Good compression for speech
        audioBitsPerSecond: 32000 // Sufficient quality for speech
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.onDataCallback) {
          // Convert blob to audio data (implementation depends on format)
          this.convertBlobToAudioData(event.data);
        }
      };

      // Start recording with 100ms chunks for low latency
      this.mediaRecorder.start(100);

    } catch (error) {
      throw new Error(`Failed to start MediaRecorder: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  private async convertBlobToAudioData(blob: Blob): Promise<void> {
    // Implementation for converting blob to Float32Array
    // This is a simplified example - actual implementation would handle
    // proper audio decoding
  }

  onAudioData(callback: (audioData: Float32Array) => void): void {
    this.onDataCallback = callback;
  }

  isSupported(): boolean {
    return 'MediaRecorder' in window;
  }
}

/**
 * Factory implementing Factory Pattern
 * Why: Encapsulates complex creation logic and browser detection
 */
export class AudioCaptureFactory implements IAudioCaptureFactory {
  /**
   * Create the best available audio capture implementation
   * Why: Abstracts browser capability detection from client code
   */
  createCapture(): IAudioCapture {
    // Prefer AudioWorklet for better performance
    if (new AudioWorkletCapture().isSupported()) {
      return new AudioWorkletCapture();
    }
    
    // Fall back to MediaRecorder
    if (new MediaRecorderCapture().isSupported()) {
      return new MediaRecorderCapture();
    }

    throw new Error('No supported audio capture method available');
  }

  getSupportedFormats(): AudioFormat[] {
    const formats: AudioFormat[] = [];
    
    if (new AudioWorkletCapture().isSupported()) {
      formats.push({ type: 'pcm', sampleRate: 16000, channels: 1 });
    }
    
    if (new MediaRecorderCapture().isSupported()) {
      formats.push({ type: 'webm', sampleRate: 48000, channels: 1 });
    }

    return formats;
  }
}
```

#### Audio Processing Strategy Pattern
```typescript
/**
 * Strategy interface for different recording modes
 * Why: Allows switching between recording strategies without changing client code
 */
export interface IRecordingStrategy {
  shouldStartRecording(audioData: Float32Array): boolean;
  shouldStopRecording(audioData: Float32Array): boolean;
  configure(options: RecordingOptions): void;
}

/**
 * Continuous recording strategy
 * Why: For use cases requiring constant audio monitoring
 */
export class ContinuousRecordingStrategy implements IRecordingStrategy {
  private isRecording = false;

  shouldStartRecording(audioData: Float32Array): boolean {
    return !this.isRecording;
  }

  shouldStopRecording(audioData: Float32Array): boolean {
    return false; // Never stop in continuous mode
  }

  configure(options: RecordingOptions): void {
    // Configure continuous recording parameters
  }
}

/**
 * Voice-activated recording strategy
 * Why: Saves bandwidth by only recording when voice is detected
 */
export class VoiceActivatedRecordingStrategy implements IRecordingStrategy {
  private voiceDetector: IVoiceActivityDetector;
  private silenceTimer: number = 0;
  private maxSilenceDuration = 2000; // 2 seconds

  constructor(voiceDetector: IVoiceActivityDetector) {
    this.voiceDetector = voiceDetector;
  }

  shouldStartRecording(audioData: Float32Array): boolean {
    return this.voiceDetector.detectVoice(audioData);
  }

  shouldStopRecording(audioData: Float32Array): boolean {
    if (!this.voiceDetector.detectVoice(audioData)) {
      this.silenceTimer += 100; // Assuming 100ms chunks
      return this.silenceTimer > this.maxSilenceDuration;
    }
    
    this.silenceTimer = 0;
    return false;
  }

  configure(options: RecordingOptions): void {
    if (options.maxSilenceDuration) {
      this.maxSilenceDuration = options.maxSilenceDuration;
    }
  }
}
```

### Communication Module

#### WebSocket Client with Observer Pattern
```typescript
/**
 * WebSocket event types for type-safe event handling
 * Why: Prevents runtime errors from incorrect event names
 */
export enum WebSocketEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE_RECEIVED = 'message_received',
  ERROR_OCCURRED = 'error_occurred'
}

/**
 * Observer interface for WebSocket events
 * Why: Enables loose coupling between WebSocket client and event handlers
 */
export interface IWebSocketObserver {
  onEvent(eventType: WebSocketEventType, data: any): void;
}

/**
 * WebSocket client implementing Observer pattern
 * Why: Allows multiple components to react to WebSocket events independently
 */
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private observers: IWebSocketObserver[] = [];
  private reconnectionManager: ReconnectionManager;
  private messageQueue: any[] = [];

  constructor(
    private url: string,
    private reconnectionManager: ReconnectionManager
  ) {}

  /**
   * Add observer for WebSocket events
   * Why: Implements Observer pattern for event distribution
   */
  addObserver(observer: IWebSocketObserver): void {
    this.observers.push(observer);
  }

  removeObserver(observer: IWebSocketObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  /**
   * Notify all observers of an event
   * Why: Decouples event source from event handlers
   */
  private notifyObservers(eventType: WebSocketEventType, data: any): void {
    this.observers.forEach(observer => {
      try {
        observer.onEvent(eventType, data);
      } catch (error) {
        console.error('Error in WebSocket observer:', error);
        // Don't let one observer error affect others
      }
    });
  }

  /**
   * Connect to WebSocket server with automatic reconnection
   * Why: Provides robust connection management with error recovery
   */
  async connect(): Promise<void> {
    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.notifyObservers(WebSocketEventType.CONNECTED, null);
        this.flushMessageQueue(); // Send queued messages
      };

      this.socket.onmessage = (event) => {
        const message = this.parseMessage(event.data);
        this.notifyObservers(WebSocketEventType.MESSAGE_RECEIVED, message);
      };

      this.socket.onclose = () => {
        this.notifyObservers(WebSocketEventType.DISCONNECTED, null);
        this.reconnectionManager.scheduleReconnection(() => this.connect());
      };

      this.socket.onerror = (error) => {
        this.notifyObservers(WebSocketEventType.ERROR_OCCURRED, error);
      };

    } catch (error) {
      throw new Error(`Failed to connect to WebSocket: ${error.message}`);
    }
  }

  /**
   * Send message with queuing for disconnected state
   * Why: Provides reliable message delivery even during connection issues
   */
  sendMessage(message: any): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(this.serializeMessage(message));
    } else {
      // Queue message for later delivery
      this.messageQueue.push(message);
    }
  }

  /**
   * Send queued messages after reconnection
   * Why: Ensures no messages are lost during connection interruptions
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  private parseMessage(data: any): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return { type: 'text', content: data };
      }
    }
    return data; // Binary data
  }

  private serializeMessage(message: any): string | ArrayBuffer {
    if (message instanceof ArrayBuffer) {
      return message;
    }
    return JSON.stringify(message);
  }
}

/**
 * Reconnection manager with exponential backoff
 * Why: Prevents overwhelming the server with connection attempts
 */
export class ReconnectionManager {
  private attempt = 0;
  private maxAttempts = 10;
  private baseDelay = 200;
  private maxDelay = 10000;

  /**
   * Schedule reconnection with exponential backoff
   * Why: Balances quick recovery with server protection
   */
  scheduleReconnection(reconnectFn: () => Promise<void>): void {
    if (this.attempt >= this.maxAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );

    setTimeout(async () => {
      try {
        await reconnectFn();
        this.reset(); // Reset on successful connection
      } catch (error) {
        this.attempt++;
        this.scheduleReconnection(reconnectFn);
      }
    }, delay);
  }

  reset(): void {
    this.attempt = 0;
  }
}
```

## Backend Module Implementation

### Transcription Module with Adapter Pattern

```java
/**
 * Core transcription service interface
 * Why: Abstracts transcription functionality to enable provider switching
 * Benefits: Easy testing with mocks, flexibility to add new providers
 */
public interface ITranscriptionService {
    CompletableFuture<TranscriptionResult> transcribeAudio(AudioChunk audioChunk);
    void startStreamingTranscription(String sessionId, TranscriptionCallback callback);
    void stopStreamingTranscription(String sessionId);
    boolean isLanguageSupported(String languageCode);
}

/**
 * Callback interface for streaming transcription results
 * Why: Enables real-time processing of partial and final transcripts
 */
@FunctionalInterface
public interface TranscriptionCallback {
    void onTranscriptionResult(TranscriptionEvent event);
}

/**
 * Azure Speech Service adapter
 * Why: Adapts Azure SDK to our domain interfaces, isolating Azure-specific code
 */
@Service
@ConditionalOnProperty(name = "transcription.provider", havingValue = "azure")
public class AzureSpeechServiceAdapter implements ITranscriptionService {
    
    private final SpeechConfig speechConfig;
    private final Map<String, SpeechRecognizer> activeRecognizers;
    private final AudioFormat targetFormat;
    
    /**
     * Constructor injection for dependency inversion
     * Why: Enables easy testing and configuration management
     */
    public AzureSpeechServiceAdapter(
        @Value("${azure.speech.key}") String speechKey,
        @Value("${azure.speech.region}") String speechRegion,
        AudioFormat audioFormat
    ) {
        this.speechConfig = SpeechConfig.fromSubscription(speechKey, speechRegion);
        this.activeRecognizers = new ConcurrentHashMap<>();
        this.targetFormat = audioFormat;
        
        // Configure for optimal real-time performance
        this.speechConfig.setProperty(
            PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, "5000");
        this.speechConfig.setProperty(
            PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, "1000");
    }

    /**
     * Start streaming transcription for a session
     * Why: Enables real-time transcription with proper resource management
     */
    @Override
    public void startStreamingTranscription(String sessionId, TranscriptionCallback callback) {
        try {
            // Create audio input stream for the session
            AudioInputStream audioStream = AudioInputStream.createPushStream(
                AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
            );
            
            // Configure audio input
            AudioConfig audioConfig = AudioConfig.fromStreamInput(audioStream);
            
            // Create speech recognizer with session-specific configuration
            SpeechRecognizer recognizer = new SpeechRecognizer(speechConfig, audioConfig);
            
            // Configure event handlers for real-time processing
            this.configureRecognizerEvents(recognizer, sessionId, callback);
            
            // Start continuous recognition
            recognizer.startContinuousRecognitionAsync().get();
            
            // Store recognizer for session management
            activeRecognizers.put(sessionId, recognizer);
            
            log.info("Started streaming transcription for session: {}", sessionId);
            
        } catch (Exception e) {
            throw new TranscriptionException(
                "Failed to start streaming transcription for session: " + sessionId, e);
        }
    }

    /**
     * Configure recognizer event handlers
     * Why: Separates event handling logic for better maintainability
     */
    private void configureRecognizerEvents(
        SpeechRecognizer recognizer, 
        String sessionId, 
        TranscriptionCallback callback
    ) {
        // Handle partial results for real-time feedback
        recognizer.recognizing.addEventListener((s, e) -> {
            if (!e.getResult().getText().isEmpty()) {
                TranscriptionEvent event = TranscriptionEvent.builder()
                    .sessionId(sessionId)
                    .type(TranscriptionEventType.PARTIAL)
                    .text(e.getResult().getText())
                    .confidence(e.getResult().getReason() == ResultReason.RecognizingSpeech ? 0.5 : 0.0)
                    .timestamp(Instant.now())
                    .build();
                
                callback.onTranscriptionResult(event);
            }
        });

        // Handle final results
        recognizer.recognized.addEventListener((s, e) -> {
            if (e.getResult().getReason() == ResultReason.RecognizedSpeech) {
                TranscriptionEvent event = TranscriptionEvent.builder()
                    .sessionId(sessionId)
                    .type(TranscriptionEventType.FINAL)
                    .text(e.getResult().getText())
                    .confidence(calculateConfidence(e.getResult()))
                    .detectedLanguage(e.getResult().getProperties().getProperty(
                        PropertyId.SpeechServiceConnection_AutoDetectSourceLanguageResult))
                    .timestamp(Instant.now())
                    .build();
                
                callback.onTranscriptionResult(event);
            }
        });

        // Handle errors with proper logging and recovery
        recognizer.canceled.addEventListener((s, e) -> {
            log.error("Transcription canceled for session {}: {}", sessionId, e.getErrorDetails());
            
            TranscriptionEvent event = TranscriptionEvent.builder()
                .sessionId(sessionId)
                .type(TranscriptionEventType.ERROR)
                .error(new TranscriptionError(e.getErrorCode().toString(), e.getErrorDetails()))
                .timestamp(Instant.now())
                .build();
            
            callback.onTranscriptionResult(event);
        });
    }

    /**
     * Calculate confidence score from Azure result
     * Why: Provides consistent confidence scoring across different providers
     */
    private double calculateConfidence(SpeechRecognitionResult result) {
        // Implementation depends on Azure SDK capabilities
        // This is a simplified example
        return 0.95; // Azure doesn't provide detailed confidence in current SDK
    }

    @Override
    public void stopStreamingTranscription(String sessionId) {
        SpeechRecognizer recognizer = activeRecognizers.remove(sessionId);
        if (recognizer != null) {
            try {
                recognizer.stopContinuousRecognitionAsync().get();
                recognizer.close();
                log.info("Stopped streaming transcription for session: {}", sessionId);
            } catch (Exception e) {
                log.error("Error stopping transcription for session: {}", sessionId, e);
            }
        }
    }

    @Override
    public CompletableFuture<TranscriptionResult> transcribeAudio(AudioChunk audioChunk) {
        // Implementation for one-time transcription
        return CompletableFuture.supplyAsync(() -> {
            // Transcription logic here
            return TranscriptionResult.builder().build();
        });
    }

    @Override
    public boolean isLanguageSupported(String languageCode) {
        // Check against Azure's supported languages
        Set<String> supportedLanguages = Set.of("en-US", "es-ES", "hi-IN", "fr-FR");
        return supportedLanguages.contains(languageCode);
    }
}

/**
 * Mock implementation for testing
 * Why: Enables testing without external dependencies
 */
@Service
@ConditionalOnProperty(name = "transcription.provider", havingValue = "mock")
public class MockTranscriptionService implements ITranscriptionService {
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    
    @Override
    public void startStreamingTranscription(String sessionId, TranscriptionCallback callback) {
        // Simulate streaming transcription with test data
        scheduler.scheduleAtFixedRate(() -> {
            TranscriptionEvent event = TranscriptionEvent.builder()
                .sessionId(sessionId)
                .type(TranscriptionEventType.PARTIAL)
                .text("Mock partial transcript...")
                .confidence(0.8)
                .timestamp(Instant.now())
                .build();
            
            callback.onTranscriptionResult(event);
        }, 0, 500, TimeUnit.MILLISECONDS);
    }

    @Override
    public void stopStreamingTranscription(String sessionId) {
        // Stop mock transcription
    }

    @Override
    public CompletableFuture<TranscriptionResult> transcribeAudio(AudioChunk audioChunk) {
        return CompletableFuture.completedFuture(
            TranscriptionResult.builder()
                .text("Mock transcription result")
                .confidence(0.9)
                .build()
        );
    }

    @Override
    public boolean isLanguageSupported(String languageCode) {
        return true; // Mock supports all languages
    }
}
```

### AI Service Module with Strategy Pattern

```java
/**
 * AI service interface for response generation
 * Why: Abstracts AI functionality to enable provider switching
 */
public interface IAIService {
    CompletableFuture<AIResponse> generateResponse(AIRequest request);
    Publisher<AIResponseChunk> generateStreamingResponse(AIRequest request);
    boolean isModelAvailable(String modelName);
}

/**
 * Strategy interface for different response delivery methods
 * Why: Allows switching between streaming and batch responses based on context
 */
public interface IResponseDeliveryStrategy {
    Publisher<AIResponseChunk> deliverResponse(AIRequest request, IAIService aiService);
}

/**
 * Streaming response strategy for real-time delivery
 * Why: Provides low-latency response delivery for better user experience
 */
@Component
public class StreamingResponseStrategy implements IResponseDeliveryStrategy {
    
    @Override
    public Publisher<AIResponseChunk> deliverResponse(AIRequest request, IAIService aiService) {
        return aiService.generateStreamingResponse(request)
            .doOnNext(chunk -> log.debug("Streaming chunk: {}", chunk.getText()))
            .doOnError(error -> log.error("Streaming error: {}", error.getMessage()))
            .doOnComplete(() -> log.debug("Streaming completed for request: {}", request.getSessionId()));
    }
}

/**
 * Azure OpenAI service implementation
 * Why: Provides Azure-specific implementation while maintaining interface compatibility
 */
@Service
@ConditionalOnProperty(name = "ai.provider", havingValue = "azure-openai")
public class AzureOpenAIService implements IAIService {
    
    private final WebClient webClient;
    private final String endpoint;
    private final String deploymentName;
    private final ObjectMapper objectMapper;
    
    /**
     * Constructor with dependency injection
     * Why: Enables configuration and testing flexibility
     */
    public AzureOpenAIService(
        @Value("${azure.openai.endpoint}") String endpoint,
        @Value("${azure.openai.deployment}") String deploymentName,
        @Value("${azure.openai.key}") String apiKey,
        ObjectMapper objectMapper
    ) {
        this.endpoint = endpoint;
        this.deploymentName = deploymentName;
        this.objectMapper = objectMapper;
        
        // Configure WebClient for Azure OpenAI API
        this.webClient = WebClient.builder()
            .baseUrl(endpoint)
            .defaultHeader("api-key", apiKey)
            .defaultHeader("Content-Type", "application/json")
            .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
            .build();
    }

    /**
     * Generate streaming response from Azure OpenAI
     * Why: Provides real-time token delivery for better user experience
     */
    @Override
    public Publisher<AIResponseChunk> generateStreamingResponse(AIRequest request) {
        return webClient.post()
            .uri("/openai/deployments/{deploymentName}/chat/completions?api-version=2023-05-15", 
                 deploymentName)
            .bodyValue(buildAzureRequest(request))
            .retrieve()
            .bodyToFlux(String.class)
            .filter(line -> line.startsWith("data: ") && !line.contains("[DONE]"))
            .map(line -> line.substring(6)) // Remove "data: " prefix
            .map(this::parseAzureResponseChunk)
            .filter(Objects::nonNull)
            .doOnError(error -> {
                log.error("Azure OpenAI streaming error: {}", error.getMessage());
                throw new AIServiceException("Failed to stream response from Azure OpenAI", error);
            });
    }

    /**
     * Build Azure-specific request format
     * Why: Adapts our domain request to Azure API requirements
     */
    private Map<String, Object> buildAzureRequest(AIRequest request) {
        Map<String, Object> azureRequest = new HashMap<>();
        azureRequest.put("messages", buildMessageHistory(request));
        azureRequest.put("max_tokens", request.getMaxTokens());
        azureRequest.put("temperature", request.getTemperature());
        azureRequest.put("stream", true);
        azureRequest.put("n", 1);
        
        return azureRequest;
    }

    /**
     * Build conversation history for context
     * Why: Provides AI with conversation context for better responses
     */
    private List<Map<String, String>> buildMessageHistory(AIRequest request) {
        List<Map<String, String>> messages = new ArrayList<>();
        
        // Add system prompt
        messages.add(Map.of(
            "role", "system",
            "content", buildSystemPrompt(request)
        ));
        
        // Add conversation history
        request.getConversationHistory().forEach(message -> {
            messages.add(Map.of(
                "role", message.getRole().toLowerCase(),
                "content", message.getContent()
            ));
        });
        
        // Add current user message
        messages.add(Map.of(
            "role", "user",
            "content", request.getCurrentMessage()
        ));
        
        return messages;
    }

    /**
     * Build system prompt for consistent AI behavior
     * Why: Ensures AI responses are optimized for the interview assistant use case
     */
    private String buildSystemPrompt(AIRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a real-time, low-latency interview assistant. ");
        prompt.append("Answer concisely and correctly based on the latest user utterance and conversation history. ");
        prompt.append("If the user is ambiguous, ask a brief clarifying question. ");
        prompt.append("Always respond in the target language: ").append(request.getTargetLanguage()).append(". ");
        prompt.append("If user mixes languages, interpret intent and answer in target language. ");
        prompt.append("Be robust to partial/incorrect transcripts; wait for final transcript when needed. ");
        prompt.append("Never invent APIs or facts. If unknown, say so briefly.");
        
        return prompt.toString();
    }

    /**
     * Parse Azure response chunk into our domain object
     * Why: Isolates Azure-specific response format from our domain
     */
    private AIResponseChunk parseAzureResponseChunk(String chunkData) {
        try {
            JsonNode jsonNode = objectMapper.readTree(chunkData);
            JsonNode choicesNode = jsonNode.get("choices");
            
            if (choicesNode != null && choicesNode.isArray() && choicesNode.size() > 0) {
                JsonNode deltaNode = choicesNode.get(0).get("delta");
                
                if (deltaNode != null && deltaNode.has("content")) {
                    String content = deltaNode.get("content").asText();
                    
                    return AIResponseChunk.builder()
                        .token(content)
                        .timestamp(Instant.now())
                        .isComplete(false)
                        .build();
                }
            }
            
            return null; // Skip chunks without content
            
        } catch (Exception e) {
            log.error("Failed to parse Azure response chunk: {}", chunkData, e);
            return null;
        }
    }

    @Override
    public CompletableFuture<AIResponse> generateResponse(AIRequest request) {
        // Implementation for non-streaming response
        return generateStreamingResponse(request)
            .collect(StringBuilder::new, (sb, chunk) -> sb.append(chunk.getToken()))
            .map(sb -> AIResponse.builder()
                .text(sb.toString())
                .tokensUsed(calculateTokens(sb.toString()))
                .timestamp(Instant.now())
                .build())
            .toFuture();
    }

    @Override
    public boolean isModelAvailable(String modelName) {
        // Check if the specified model is available in the deployment
        return deploymentName.equals(modelName);
    }

    private int calculateTokens(String text) {
        // Rough estimation - in production, use proper tokenization
        return text.split("\\s+").length;
    }
}
```

### WebSocket Handler with Chain of Responsibility

```java
/**
 * Message handler interface for chain of responsibility
 * Why: Enables flexible message processing pipeline
 */
public interface IMessageHandler {
    boolean canHandle(WebSocketMessage message);
    CompletableFuture<WebSocketMessage> handle(WebSocketMessage message, MessageHandlerContext context);
    IMessageHandler setNext(IMessageHandler nextHandler);
}

/**
 * Abstract base handler implementing chain linking
 * Why: Provides common chain management functionality
 */
public abstract class AbstractMessageHandler implements IMessageHandler {
    protected IMessageHandler nextHandler;

    @Override
    public IMessageHandler setNext(IMessageHandler nextHandler) {
        this.nextHandler = nextHandler;
        return nextHandler;
    }

    /**
     * Handle message or pass to next handler
     * Why: Implements chain of responsibility pattern consistently
     */
    protected CompletableFuture<WebSocketMessage> handleNext(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        if (nextHandler != null) {
            return nextHandler.handle(message, context);
        }
        return CompletableFuture.completedFuture(null);
    }
}

/**
 * Validation handler - first in chain
 * Why: Ensures all messages are properly formatted before processing
 */
@Component
public class ValidationHandler extends AbstractMessageHandler {

    @Override
    public boolean canHandle(WebSocketMessage message) {
        return true; // Validation applies to all messages
    }

    @Override
    public CompletableFuture<WebSocketMessage> handle(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Validate message structure
                validateMessageStructure(message);
                
                // Validate session exists
                validateSession(message.getSessionId(), context);
                
                // Continue to next handler
                return handleNext(message, context).join();
                
            } catch (ValidationException e) {
                log.error("Message validation failed: {}", e.getMessage());
                return WebSocketMessage.error(
                    "VALIDATION_ERROR", 
                    e.getMessage()
                );
            }
        });
    }

    private void validateMessageStructure(WebSocketMessage message) {
        if (message.getType() == null) {
            throw new ValidationException("Message type is required");
        }
        
        if (message.getSessionId() == null || message.getSessionId().trim().isEmpty()) {
            throw new ValidationException("Session ID is required");
        }
    }

    private void validateSession(String sessionId, MessageHandlerContext context) {
        if (!context.getSessionManager().sessionExists(sessionId)) {
            throw new ValidationException("Invalid session ID: " + sessionId);
        }
    }
}

/**
 * Authentication handler
 * Why: Verifies client authentication before processing business logic
 */
@Component
public class AuthenticationHandler extends AbstractMessageHandler {

    private final String apiKey;

    public AuthenticationHandler(@Value("${app.api.key}") String apiKey) {
        this.apiKey = apiKey;
    }

    @Override
    public boolean canHandle(WebSocketMessage message) {
        return true; // Authentication applies to all messages
    }

    @Override
    public CompletableFuture<WebSocketMessage> handle(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Verify API key from WebSocket session attributes
                String clientApiKey = (String) context.getSession()
                    .getAttributes().get("api-key");
                
                if (!apiKey.equals(clientApiKey)) {
                    throw new AuthenticationException("Invalid API key");
                }
                
                // Continue to next handler
                return handleNext(message, context).join();
                
            } catch (AuthenticationException e) {
                log.error("Authentication failed: {}", e.getMessage());
                return WebSocketMessage.error(
                    "AUTHENTICATION_ERROR", 
                    "Authentication failed"
                );
            }
        });
    }
}

/**
 * Rate limiting handler
 * Why: Prevents abuse and ensures fair resource usage
 */
@Component
public class RateLimitingHandler extends AbstractMessageHandler {

    private final IRateLimiter rateLimiter;

    public RateLimitingHandler(IRateLimiter rateLimiter) {
        this.rateLimiter = rateLimiter;
    }

    @Override
    public boolean canHandle(WebSocketMessage message) {
        return true; // Rate limiting applies to all messages
    }

    @Override
    public CompletableFuture<WebSocketMessage> handle(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        return CompletableFuture.supplyAsync(() -> {
            String clientId = context.getSession().getId();
            
            if (!rateLimiter.tryAcquire(clientId)) {
                log.warn("Rate limit exceeded for client: {}", clientId);
                return WebSocketMessage.error(
                    "RATE_LIMIT_EXCEEDED", 
                    "Too many requests. Please slow down."
                );
            }
            
            // Continue to next handler
            return handleNext(message, context).join();
        });
    }
}

/**
 * Business logic handler - processes actual requests
 * Why: Separates business logic from cross-cutting concerns
 */
@Component
public class BusinessLogicHandler extends AbstractMessageHandler {

    private final ITranscriptionService transcriptionService;
    private final IAIService aiService;
    private final IConversationService conversationService;

    public BusinessLogicHandler(
        ITranscriptionService transcriptionService,
        IAIService aiService,
        IConversationService conversationService
    ) {
        this.transcriptionService = transcriptionService;
        this.aiService = aiService;
        this.conversationService = conversationService;
    }

    @Override
    public boolean canHandle(WebSocketMessage message) {
        return message.getType() != null;
    }

    @Override
    public CompletableFuture<WebSocketMessage> handle(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        return switch (message.getType()) {
            case START_SESSION -> handleStartSession(message, context);
            case AUDIO_CHUNK -> handleAudioChunk(message, context);
            case TEXT_MESSAGE -> handleTextMessage(message, context);
            case STOP_SESSION -> handleStopSession(message, context);
            default -> CompletableFuture.completedFuture(
                WebSocketMessage.error("UNKNOWN_MESSAGE_TYPE", "Unknown message type")
            );
        };
    }

    private CompletableFuture<WebSocketMessage> handleStartSession(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // Initialize transcription session
                transcriptionService.startStreamingTranscription(
                    message.getSessionId(),
                    this::onTranscriptionResult
                );
                
                return WebSocketMessage.sessionReady(message.getSessionId());
                
            } catch (Exception e) {
                log.error("Failed to start session: {}", e.getMessage());
                return WebSocketMessage.error("SESSION_START_FAILED", e.getMessage());
            }
        });
    }

    private CompletableFuture<WebSocketMessage> handleAudioChunk(
        WebSocketMessage message, 
        MessageHandlerContext context
    ) {
        // Audio chunks are processed by the transcription service
        // No immediate response needed
        return CompletableFuture.completedFuture(null);
    }

    private void onTranscriptionResult(TranscriptionEvent event) {
        // Handle transcription results and trigger AI responses
        if (event.getType() == TranscriptionEventType.FINAL) {
            // Trigger AI response for final transcripts
            AIRequest aiRequest = buildAIRequest(event);
            aiService.generateStreamingResponse(aiRequest)
                .subscribe(this::sendAIResponseChunk);
        }
    }
}

/**
 * Main WebSocket handler orchestrating the message processing chain
 * Why: Provides centralized WebSocket handling with flexible processing pipeline
 */
@Component
public class StreamingWebSocketHandler extends TextWebSocketHandler {

    private final IMessageHandler messageHandlerChain;
    private final ISessionManager sessionManager;

    /**
     * Constructor builds the handler chain
     * Why: Configures the processing pipeline at startup
     */
    public StreamingWebSocketHandler(
        ValidationHandler validationHandler,
        AuthenticationHandler authenticationHandler,
        RateLimitingHandler rateLimitingHandler,
        BusinessLogicHandler businessLogicHandler,
        ISessionManager sessionManager
    ) {
        // Build chain of responsibility
        this.messageHandlerChain = validationHandler
            .setNext(authenticationHandler)
            .setNext(rateLimitingHandler)
            .setNext(businessLogicHandler);
        
        this.sessionManager = sessionManager;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        log.info("WebSocket connection established: {}", session.getId());
        sessionManager.addSession(session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            WebSocketMessage wsMessage = parseMessage(message.getPayload());
            MessageHandlerContext context = new MessageHandlerContext(session, sessionManager);
            
            // Process through handler chain
            messageHandlerChain.handle(wsMessage, context)
                .thenAccept(response -> {
                    if (response != null) {
                        sendMessage(session, response);
                    }
                })
                .exceptionally(error -> {
                    log.error("Error processing message: {}", error.getMessage());
                    sendErrorMessage(session, error);
                    return null;
                });
                
        } catch (Exception e) {
            log.error("Failed to handle text message: {}", e.getMessage());
            sendErrorMessage(session, e);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("WebSocket transport error for session {}: {}", session.getId(), exception.getMessage());
        sessionManager.removeSession(session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        log.info("WebSocket connection closed: {} - {}", session.getId(), closeStatus);
        sessionManager.removeSession(session.getId());
    }
}
```

## Testing Strategies

### Unit Testing with Mocks

```typescript
// Frontend unit test example
describe('AudioCaptureFactory', () => {
  let factory: AudioCaptureFactory;

  beforeEach(() => {
    factory = new AudioCaptureFactory();
  });

  /**
   * Test factory creation logic
   * Why: Ensures correct implementation is selected based on browser capabilities
   */
  it('should create AudioWorkletCapture when supported', () => {
    // Mock AudioWorklet support
    const mockAudioWorkletCapture = {
      isSupported: jest.fn().mockReturnValue(true)
    };
    
    jest.spyOn(window, 'AudioWorklet', 'get').mockReturnValue({} as any);
    
    const capture = factory.createCapture();
    
    expect(capture).toBeInstanceOf(AudioWorkletCapture);
  });

  it('should fallback to MediaRecorder when AudioWorklet not supported', () => {
    // Mock AudioWorklet not supported
    jest.spyOn(window, 'AudioWorklet', 'get').mockReturnValue(undefined);
    jest.spyOn(window, 'MediaRecorder', 'get').mockReturnValue({} as any);
    
    const capture = factory.createCapture();
    
    expect(capture).toBeInstanceOf(MediaRecorderCapture);
  });
});
```

```java
// Backend unit test example
@ExtendWith(MockitoExtension.class)
class AzureSpeechServiceAdapterTest {

    @Mock
    private SpeechConfig speechConfig;
    
    @Mock
    private TranscriptionCallback callback;
    
    @InjectMocks
    private AzureSpeechServiceAdapter transcriptionService;

    /**
     * Test streaming transcription startup
     * Why: Verifies correct initialization and configuration
     */
    @Test
    void shouldStartStreamingTranscription() {
        // Arrange
        String sessionId = "test-session-123";
        
        // Act
        transcriptionService.startStreamingTranscription(sessionId, callback);
        
        // Assert
        assertTrue(transcriptionService.isSessionActive(sessionId));
        verify(callback, timeout(1000)).onTranscriptionResult(any());
    }

    /**
     * Test error handling
     * Why: Ensures graceful handling of service failures
     */
    @Test
    void shouldHandleTranscriptionErrors() {
        // Arrange
        String sessionId = "test-session-456";
        doThrow(new RuntimeException("Azure service unavailable"))
            .when(speechConfig).fromSubscription(anyString(), anyString());
        
        // Act & Assert
        assertThrows(TranscriptionException.class, () -> {
            transcriptionService.startStreamingTranscription(sessionId, callback);
        });
    }
}
```

### Integration Testing

```java
/**
 * Integration test for WebSocket message processing
 * Why: Verifies complete message flow through handler chain
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "transcription.provider=mock",
    "ai.provider=mock"
})
class WebSocketIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;
    
    @LocalServerPort
    private int port;
    
    private StompSession stompSession;

    @BeforeEach
    void setUp() throws Exception {
        // Set up WebSocket test client
        WebSocketStompClient stompClient = new WebSocketStompClient(new SockJSClient());
        String url = "ws://localhost:" + port + "/ws/stream";
        stompSession = stompClient.connect(url, new DefaultStompSessionHandler()).get();
    }

    /**
     * Test complete conversation flow
     * Why: Verifies end-to-end functionality with mocked external services
     */
    @Test
    void shouldHandleCompleteConversationFlow() throws Exception {
        // Arrange
        CompletableFuture<WebSocketMessage> responseReceived = new CompletableFuture<>();
        
        stompSession.subscribe("/topic/responses", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return WebSocketMessage.class;
            }
            
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                responseReceived.complete((WebSocketMessage) payload);
            }
        });

        // Act - Start session
        WebSocketMessage startMessage = WebSocketMessage.builder()
            .type(MessageType.START_SESSION)
            .sessionId("test-session")
            .build();
        
        stompSession.send("/app/message", startMessage);

        // Assert
        WebSocketMessage response = responseReceived.get(5, TimeUnit.SECONDS);
        assertEquals(MessageType.SESSION_READY, response.getType());
        assertEquals("test-session", response.getSessionId());
    }
}
```

## Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/voice-activity-detection

# 2. Implement interfaces first (following Interface Segregation Principle)
# Create IVoiceActivityDetector interface
# Add to audio module

# 3. Create concrete implementations
# SimpleVoiceActivityDetector - basic RMS threshold
# AdvancedVoiceActivityDetector - ML-based detection

# 4. Write unit tests for each implementation
npm test -- --watch audio/

# 5. Integration testing
npm run test:integration

# 6. Update factory to use new implementations
# Modify AudioProcessorFactory to inject VAD

# 7. End-to-end testing
npm run test:e2e

# 8. Code review and merge
git push origin feature/voice-activity-detection
```

### 2. Adding New Transcription Provider

```java
/**
 * Steps to add a new transcription provider (e.g., Google Speech-to-Text)
 * Why: Demonstrates extensibility through proper abstraction
 */

// 1. Create adapter implementation
@Service
@ConditionalOnProperty(name = "transcription.provider", havingValue = "google")
public class GoogleSpeechServiceAdapter implements ITranscriptionService {
    // Implementation details...
}

// 2. Add configuration properties
@ConfigurationProperties(prefix = "google.speech")
public class GoogleSpeechConfig {
    private String credentialsPath;
    private String projectId;
    // Getters and setters...
}

// 3. Update factory if needed
@Configuration
public class TranscriptionServiceConfig {
    
    @Bean
    @ConditionalOnProperty(name = "transcription.provider", havingValue = "google")
    public ITranscriptionService googleTranscriptionService(GoogleSpeechConfig config) {
        return new GoogleSpeechServiceAdapter(config);
    }
}

// 4. Add tests
@TestPropertySource(properties = "transcription.provider=google")
class GoogleSpeechServiceAdapterTest {
    // Test implementation...
}
```

### 3. Performance Monitoring

```typescript
/**
 * Performance monitoring hooks
 * Why: Tracks system performance and identifies bottlenecks
 */
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});

  useEffect(() => {
    const monitor = new PerformanceMonitor({
      audioLatency: true,
      transcriptionLatency: true,
      aiResponseLatency: true,
      memoryUsage: true
    });

    monitor.onMetricUpdate((metric) => {
      setMetrics(prev => ({ ...prev, [metric.name]: metric.value }));
      
      // Alert on performance issues
      if (metric.value > metric.threshold) {
        console.warn(`Performance threshold exceeded: ${metric.name} = ${metric.value}`);
      }
    });

    return () => monitor.stop();
  }, []);

  return metrics;
};
```

This implementation guide provides concrete examples of how to implement the modular architecture with SOLID principles and design patterns. Each code example includes detailed comments explaining the reasoning behind design decisions, making it easier for developers to understand and maintain the system.
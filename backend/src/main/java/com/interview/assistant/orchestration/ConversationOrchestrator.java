package com.interview.assistant.orchestration;

import com.interview.assistant.model.Message;
import com.interview.assistant.model.Session;
import com.interview.assistant.repository.IMessageRepository;
import com.interview.assistant.repository.ISessionRepository;
import com.interview.assistant.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Core conversation orchestrator that coordinates real-time multimodal conversation
 * <p>
 * Implements the event-driven pipeline:
 * Audio → STT → Transcript Buffers → Pause Detector → Context Manager → AI → Output Stream
 * <p>
 * Why: Central coordinator for natural conversation flow
 * Pattern: Event-driven orchestration with async coordination
 * Rationale: Manages the complex interaction between audio, transcription, AI, and user interruption
 */
@Service
public class ConversationOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(ConversationOrchestrator.class);

    // Core services
    private final VoiceActivityDetector voiceActivityDetector;
    private final TranscriptBufferManager transcriptBufferManager;
    private final ITranscriptionService transcriptionService;
    private final IAIService aiService;
    private final ISessionRepository sessionRepository;
    private final IMessageRepository messageRepository;

    // Session orchestration state
    private final Map<String, SessionOrchestration> sessionOrchestrations = new ConcurrentHashMap<>();

    public ConversationOrchestrator(VoiceActivityDetector voiceActivityDetector,
                                    TranscriptBufferManager transcriptBufferManager,
                                    ITranscriptionService transcriptionService,
                                    IAIService aiService,
                                    ISessionRepository sessionRepository,
                                    IMessageRepository messageRepository) {
        this.voiceActivityDetector = voiceActivityDetector;
        this.transcriptBufferManager = transcriptBufferManager;
        this.transcriptionService = transcriptionService;
        this.aiService = aiService;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * Main orchestration method: Process incoming audio chunk
     * This is the heart of the real-time conversation pipeline
     */
    public CompletableFuture<OrchestrationResult> processAudioChunk(String sessionId, byte[] audioData,
                                                                    Consumer<OrchestrationEvent> eventCallback) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                // 1. VOICE ACTIVITY DETECTION
                VoiceActivityDetector.VoiceActivityResult vadResult = 
                    voiceActivityDetector.processAudioChunk(sessionId, audioData);

                SessionOrchestration orchestration = getOrCreateOrchestration(sessionId, eventCallback);
                
                // 2. HANDLE INTERRUPTIONS
                if (vadResult.shouldInterruptAI()) {
                    handleUserInterruption(sessionId, orchestration);
                }

                // 3. TRANSCRIPTION (always running in parallel)
                processTranscription(sessionId, audioData, orchestration, vadResult);

                // 4. PAUSE DETECTION & AI TRIGGERING
                if (vadResult.shouldTriggerAI()) {
                    triggerAIResponse(sessionId, orchestration);
                }

                // 5. UPDATE ORCHESTRATION STATE
                orchestration.updateState(vadResult);

                return OrchestrationResult.success(vadResult, orchestration.getState());

            } catch (Exception e) {
                logger.error("Orchestration error for session {}", sessionId, e);
                return OrchestrationResult.error("Orchestration failed: " + e.getMessage());
            }
        });
    }

    /**
     * Process transcription (always running in parallel)
     */
    private void processTranscription(String sessionId, byte[] audioData, 
                                     SessionOrchestration orchestration,
                                     VoiceActivityDetector.VoiceActivityResult vadResult) {
        // Send audio to transcription service
        Session session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) return;

        transcriptionService.transcribe(
                audioData,
                ITranscriptionService.AudioFormat.pcm16k(),
                session.getTargetLanguage()
        ).thenAccept(result -> {
            if (result.isSuccess()) {
                Instant now = Instant.now();
                
                if (result.isFinal()) {
                    // Final transcript - confirm buffer
                    TranscriptBufferManager.TranscriptSegment segment = 
                        transcriptBufferManager.confirmBuffer(sessionId, result.getText(), 
                                                            result.getConfidence(), now);
                    
                    orchestration.eventCallback.accept(
                        OrchestrationEvent.transcriptFinal(sessionId, segment)
                    );
                } else {
                    // Partial transcript - update live buffer
                    transcriptBufferManager.updateLiveBuffer(sessionId, result.getText(), 
                                                           result.getConfidence(), now);
                    
                    orchestration.eventCallback.accept(
                        OrchestrationEvent.transcriptPartial(sessionId, result.getText(), result.getConfidence())
                    );
                }
            }
        }).exceptionally(throwable -> {
            logger.error("Transcription failed for session {}", sessionId, throwable);
            orchestration.eventCallback.accept(
                OrchestrationEvent.error(sessionId, "Transcription failed: " + throwable.getMessage())
            );
            return null;
        });
    }

    /**
     * Trigger AI response when meaningful pause is detected
     */
    private void triggerAIResponse(String sessionId, SessionOrchestration orchestration) {
        if (orchestration.isAIProcessing()) {
            logger.debug("AI already processing for session {}, skipping trigger", sessionId);
            return;
        }

        // Get conversation context
        TranscriptBufferManager.ConversationContext context = 
            transcriptBufferManager.getConversationContext(sessionId);

        if (!context.hasContent()) {
            logger.debug("No content for AI processing in session {}", sessionId);
            return;
        }

        orchestration.setAIProcessing(true);
        voiceActivityDetector.onAIResponseStarted(sessionId);

        // Notify that AI is thinking
        orchestration.eventCallback.accept(OrchestrationEvent.aiThinking(sessionId));

        // Generate AI response
        Session session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) return;

        String contextText = context.getFullContextText();
        String language = context.getLiveSegment() != null ? 
                         session.getTargetLanguage() : "en-US";

        aiService.generateResponse(sessionId, contextText, language)
                .thenAccept(aiResponse -> {
                    if (aiResponse.isSuccess()) {
                        // Save conversation to database
                        saveConversationToDatabase(session, context, aiResponse);

                        // Stream AI response
                        orchestration.eventCallback.accept(
                            OrchestrationEvent.aiResponseDelta(sessionId, aiResponse.getContent())
                        );

                        // Complete AI response
                        orchestration.eventCallback.accept(
                            OrchestrationEvent.aiResponseDone(sessionId, aiResponse.getContent())
                        );
                    } else {
                        orchestration.eventCallback.accept(
                            OrchestrationEvent.error(sessionId, "AI response failed: " + aiResponse.getErrorMessage())
                        );
                    }
                })
                .whenComplete((result, throwable) -> {
                    orchestration.setAIProcessing(false);
                    voiceActivityDetector.onAIResponseFinished(sessionId);
                })
                .exceptionally(throwable -> {
                    logger.error("AI response generation failed for session {}", sessionId, throwable);
                    orchestration.eventCallback.accept(
                        OrchestrationEvent.error(sessionId, "AI processing failed: " + throwable.getMessage())
                    );
                    orchestration.setAIProcessing(false);
                    voiceActivityDetector.onAIResponseFinished(sessionId);
                    return null;
                });
    }

    /**
     * Handle user interruption during AI response
     */
    private void handleUserInterruption(String sessionId, SessionOrchestration orchestration) {
        if (orchestration.isAIProcessing()) {
            logger.info("User interrupted AI response for session {}", sessionId);
            
            // Stop AI response
            orchestration.setAIProcessing(false);
            orchestration.interruptAI();
            
            // Notify interruption
            orchestration.eventCallback.accept(OrchestrationEvent.aiInterrupted(sessionId));
            
            voiceActivityDetector.onAIResponseFinished(sessionId);
        }
    }

    /**
     * Save conversation to database
     */
    private void saveConversationToDatabase(Session session, 
                                          TranscriptBufferManager.ConversationContext context,
                                          IAIService.AIResponse aiResponse) {
        try {
            // Save user message
            String userText = context.getFullContextText();
            if (!userText.trim().isEmpty()) {
                Message userMessage = Message.createUserMessage(userText, 0.95, session.getTargetLanguage());
                userMessage.setSession(session);
                messageRepository.save(userMessage);
                session.addMessage(userMessage);
            }

            // Save AI message
            Message aiMessage = Message.createAssistantMessage(
                    aiResponse.getContent(),
                    aiResponse.getModel(),
                    aiResponse.getTokensUsed(),
                    aiResponse.getProcessingTimeMs()
            );
            aiMessage.setSession(session);
            messageRepository.save(aiMessage);
            session.addMessage(aiMessage);

            sessionRepository.save(session);
            
        } catch (Exception e) {
            logger.error("Failed to save conversation to database for session {}", session.getId(), e);
        }
    }

    /**
     * Start session orchestration
     */
    public CompletableFuture<Void> startSession(String sessionId, Consumer<OrchestrationEvent> eventCallback) {
        return CompletableFuture.runAsync(() -> {
            SessionOrchestration orchestration = new SessionOrchestration(sessionId, eventCallback);
            sessionOrchestrations.put(sessionId, orchestration);
            
            logger.info("Started conversation orchestration for session {}", sessionId);
            eventCallback.accept(OrchestrationEvent.sessionStarted(sessionId));
        });
    }

    /**
     * End session orchestration
     */
    public CompletableFuture<Void> endSession(String sessionId) {
        return CompletableFuture.runAsync(() -> {
            SessionOrchestration orchestration = sessionOrchestrations.remove(sessionId);
            if (orchestration != null) {
                orchestration.cleanup();
                
                // Cleanup dependent services
                voiceActivityDetector.cleanupSession(sessionId);
                transcriptBufferManager.cleanupSession(sessionId);
                
                logger.info("Ended conversation orchestration for session {}", sessionId);
                orchestration.eventCallback.accept(OrchestrationEvent.sessionEnded(sessionId));
            }
        });
    }

    private SessionOrchestration getOrCreateOrchestration(String sessionId, Consumer<OrchestrationEvent> eventCallback) {
        return sessionOrchestrations.computeIfAbsent(sessionId, 
                k -> new SessionOrchestration(sessionId, eventCallback));
    }

    /**
     * Session-specific orchestration state
     */
    private static class SessionOrchestration {
        private final String sessionId;
        private final Consumer<OrchestrationEvent> eventCallback;
        private final Instant startTime;
        
        private OrchestrationState currentState = OrchestrationState.LISTENING;
        private volatile boolean aiProcessing = false;
        private CompletableFuture<Void> currentAITask;

        public SessionOrchestration(String sessionId, Consumer<OrchestrationEvent> eventCallback) {
            this.sessionId = sessionId;
            this.eventCallback = eventCallback;
            this.startTime = Instant.now();
        }

        public void updateState(VoiceActivityDetector.VoiceActivityResult vadResult) {
            OrchestrationState newState = mapVADStateToOrchestrationState(vadResult.getEvent());
            if (newState != currentState) {
                currentState = newState;
            }
        }

        private OrchestrationState mapVADStateToOrchestrationState(VoiceActivityDetector.VoiceActivityEvent event) {
            return switch (event) {
                case LISTENING -> OrchestrationState.LISTENING;
                case SPEECH_STARTED, SPEECH_CONTINUING, SPEECH_RESUMED -> OrchestrationState.PROCESSING_SPEECH;
                case PAUSE_STARTED, SHORT_PAUSE -> OrchestrationState.DETECTING_PAUSE;
                case SIGNIFICANT_PAUSE, WAITING -> OrchestrationState.AI_PROCESSING;
                case AI_SPEAKING -> OrchestrationState.AI_RESPONDING;
                case USER_INTERRUPTED, AI_INTERRUPTED -> OrchestrationState.USER_INTERRUPTED;
            };
        }

        public boolean isAIProcessing() { return aiProcessing; }
        
        public void setAIProcessing(boolean processing) { 
            this.aiProcessing = processing; 
        }
        
        public void interruptAI() {
            if (currentAITask != null && !currentAITask.isDone()) {
                currentAITask.cancel(true);
            }
        }

        public OrchestrationState getState() { return currentState; }
        public Instant getStartTime() { return startTime; }
        
        public void cleanup() {
            interruptAI();
        }
    }

    /**
     * Orchestration states
     */
    public enum OrchestrationState {
        LISTENING,          // Waiting for speech
        PROCESSING_SPEECH,  // Transcribing ongoing speech
        DETECTING_PAUSE,    // Monitoring for pause
        AI_PROCESSING,      // AI is thinking/generating response
        AI_RESPONDING,      // AI is delivering response
        USER_INTERRUPTED    // User interrupted AI response
    }

    /**
     * Orchestration result
     */
    public static class OrchestrationResult {
        private final boolean success;
        private final String errorMessage;
        private final VoiceActivityDetector.VoiceActivityResult vadResult;
        private final OrchestrationState state;

        private OrchestrationResult(boolean success, String errorMessage, 
                                  VoiceActivityDetector.VoiceActivityResult vadResult,
                                  OrchestrationState state) {
            this.success = success;
            this.errorMessage = errorMessage;
            this.vadResult = vadResult;
            this.state = state;
        }

        public static OrchestrationResult success(VoiceActivityDetector.VoiceActivityResult vadResult, 
                                                 OrchestrationState state) {
            return new OrchestrationResult(true, null, vadResult, state);
        }

        public static OrchestrationResult error(String errorMessage) {
            return new OrchestrationResult(false, errorMessage, null, null);
        }

        // Getters
        public boolean isSuccess() { return success; }
        public String getErrorMessage() { return errorMessage; }
        public VoiceActivityDetector.VoiceActivityResult getVadResult() { return vadResult; }
        public OrchestrationState getState() { return state; }
    }

    /**
     * Orchestration events sent to WebSocket clients
     */
    public static class OrchestrationEvent {
        private final String sessionId;
        private final EventType type;
        private final Object payload;
        private final Instant timestamp;

        private OrchestrationEvent(String sessionId, EventType type, Object payload) {
            this.sessionId = sessionId;
            this.type = type;
            this.payload = payload;
            this.timestamp = Instant.now();
        }

        // Factory methods
        public static OrchestrationEvent transcriptPartial(String sessionId, String text, double confidence) {
            return new OrchestrationEvent(sessionId, EventType.TRANSCRIPT_PARTIAL, 
                    new TranscriptPayload(text, confidence, false));
        }

        public static OrchestrationEvent transcriptFinal(String sessionId, TranscriptBufferManager.TranscriptSegment segment) {
            return new OrchestrationEvent(sessionId, EventType.TRANSCRIPT_FINAL,
                    new TranscriptPayload(segment.getText(), segment.getConfidence(), true));
        }

        public static OrchestrationEvent aiThinking(String sessionId) {
            return new OrchestrationEvent(sessionId, EventType.AI_THINKING, null);
        }

        public static OrchestrationEvent aiResponseDelta(String sessionId, String text) {
            return new OrchestrationEvent(sessionId, EventType.AI_RESPONSE_DELTA, text);
        }

        public static OrchestrationEvent aiResponseDone(String sessionId, String text) {
            return new OrchestrationEvent(sessionId, EventType.AI_RESPONSE_DONE, text);
        }

        public static OrchestrationEvent aiInterrupted(String sessionId) {
            return new OrchestrationEvent(sessionId, EventType.AI_INTERRUPTED, null);
        }

        public static OrchestrationEvent sessionStarted(String sessionId) {
            return new OrchestrationEvent(sessionId, EventType.SESSION_STARTED, null);
        }

        public static OrchestrationEvent sessionEnded(String sessionId) {
            return new OrchestrationEvent(sessionId, EventType.SESSION_ENDED, null);
        }

        public static OrchestrationEvent error(String sessionId, String errorMessage) {
            return new OrchestrationEvent(sessionId, EventType.ERROR, errorMessage);
        }

        // Getters
        public String getSessionId() { return sessionId; }
        public EventType getType() { return type; }
        public Object getPayload() { return payload; }
        public Instant getTimestamp() { return timestamp; }

        public enum EventType {
            TRANSCRIPT_PARTIAL,
            TRANSCRIPT_FINAL,
            AI_THINKING,
            AI_RESPONSE_DELTA,
            AI_RESPONSE_DONE,
            AI_INTERRUPTED,
            SESSION_STARTED,
            SESSION_ENDED,
            ERROR
        }

        public static class TranscriptPayload {
            private final String text;
            private final double confidence;
            private final boolean isFinal;

            public TranscriptPayload(String text, double confidence, boolean isFinal) {
                this.text = text;
                this.confidence = confidence;
                this.isFinal = isFinal;
            }

            public String getText() { return text; }
            public double getConfidence() { return confidence; }
            public boolean isFinal() { return isFinal; }
        }
    }
}
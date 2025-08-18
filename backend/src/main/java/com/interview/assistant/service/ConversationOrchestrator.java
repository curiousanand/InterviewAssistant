package com.interview.assistant.service;

import com.interview.assistant.event.*;
import com.interview.assistant.model.ConversationContext;
import com.interview.assistant.model.ConversationSession;
import com.interview.assistant.model.SilenceDetectionResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Central conversation orchestrator for real-time multimodal conversation flow
 * <p>
 * Why: Coordinates audio processing, transcription, and AI response generation
 * Pattern: Event-driven orchestration - manages complex conversation pipeline
 * Rationale: Core component that implements the conversation orchestration logic
 */
@Service
public class ConversationOrchestrator {

    private static final Logger logger = LoggerFactory.getLogger(ConversationOrchestrator.class);
    // Configuration
    private static final long CONTEXT_TIMEOUT_MS = 30000; // 30 seconds
    private static final int MAX_CONTEXT_MESSAGES = 10;
    private static final double MIN_CONFIDENCE_THRESHOLD = 0.6;
    // Session state tracking
    private final ConcurrentHashMap<String, ConversationSession> activeSessions = new ConcurrentHashMap<>();
    private final ExecutorService conversationProcessor = Executors.newFixedThreadPool(4);
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    @Autowired
    private ITranscriptionService transcriptionService;
    @Autowired
    private IAIService aiService;
    @Autowired
    private ConversationContextManager contextManager;
    @Autowired
    private ParallelProcessingCoordinator parallelProcessor;

    /**
     * Handle audio session initialization
     */
    @EventListener
    @Async
    public void handleSessionInitialized(AudioSessionInitializedEvent event) {
        logger.info("Initializing conversation session: {}", event.getSessionId());

        ConversationSession session = new ConversationSession(
                event.getSessionId(),
                event.getEventTimestamp()
        );

        activeSessions.put(event.getSessionId(), session);

        // Initialize conversation context
        session.initializeContext();

        logger.info("Conversation session initialized: {}", event.getSessionId());
    }

    /**
     * Handle speech detection events
     */
    @EventListener
    @Async
    public void handleSpeechDetected(SpeechDetectedEvent event) {
        String sessionId = event.getSessionId();
        ConversationSession session = activeSessions.get(sessionId);

        if (session == null) {
            logger.warn("No conversation session found for speech event: {}", sessionId);
            return;
        }

        logger.debug("Speech detected in session: {}", sessionId);

        // Update session state
        session.onSpeechDetected(event.getEventTimestamp());

        // Cancel any pending AI processing if user started speaking
        if (session.hasPendingAIProcessing()) {
            session.cancelPendingAIProcessing();
            logger.debug("Cancelled pending AI processing due to new speech: {}", sessionId);
        }
    }

    /**
     * Handle silence detection events
     */
    @EventListener
    @Async
    public void handleSilenceDetected(SilenceDetectedEvent event) {
        String sessionId = event.getSessionId();
        ConversationSession session = activeSessions.get(sessionId);

        if (session == null) {
            logger.warn("No conversation session found for silence event: {}", sessionId);
            return;
        }

        SilenceDetectionResult silenceResult = event.getSilenceResult();
        logger.debug("Silence detected in session: {} - type: {}, duration: {}ms",
                sessionId, silenceResult.getSilenceType(), silenceResult.getSilenceDuration());

        // Update session state
        session.onSilenceDetected(event.getEventTimestamp(), silenceResult);

        // Determine if we should trigger AI processing
        if (silenceResult.shouldTriggerProcessing() && session.hasConfirmedTranscript()) {
            triggerAIProcessing(session, silenceResult);
        }
    }

    /**
     * Handle partial transcription results
     */
    @EventListener
    @Async
    public void handlePartialTranscription(TranscriptionPartialEvent event) {
        String sessionId = event.getSessionId();
        ConversationSession session = activeSessions.get(sessionId);

        if (session == null) {
            logger.warn("No conversation session found for partial transcription: {}", sessionId);
            return;
        }

        String text = event.getText();
        double confidence = event.getConfidence();

        logger.debug("Partial transcription for session {}: '{}' (confidence: {:.2f})",
                sessionId, text, confidence);

        // Update live transcript buffer
        session.updateLiveTranscript(text, confidence, event.getEventTimestamp());

        // Forward to frontend for live display
        forwardPartialTranscriptToFrontend(sessionId, text, confidence);
    }

    /**
     * Handle final transcription results
     */
    @EventListener
    @Async
    public void handleFinalTranscription(TranscriptionFinalEvent event) {
        String sessionId = event.getSessionId();
        ConversationSession session = activeSessions.get(sessionId);

        if (session == null) {
            logger.warn("No conversation session found for final transcription: {}", sessionId);
            return;
        }

        String text = event.getText();
        double confidence = event.getConfidence();

        logger.info("Final transcription for session {}: '{}' (confidence: {:.2f})",
                sessionId, text, confidence);

        // Only process if confidence meets threshold
        if (confidence >= MIN_CONFIDENCE_THRESHOLD && !text.trim().isEmpty()) {
            // Add to confirmed transcript
            session.addConfirmedTranscript(text, confidence, event.getEventTimestamp());

            // Forward to frontend
            forwardFinalTranscriptToFrontend(sessionId, text, confidence);

            // Check if we should trigger AI processing immediately
            // (if we're not in the middle of active speech)
            if (!session.isCurrentlySpeaking() && session.getCurrentSilenceDuration() > 1000) {
                SilenceDetectionResult syntheticSilence = new SilenceDetectionResult(
                        false, false, session.getCurrentSilenceDuration());
                triggerAIProcessing(session, syntheticSilence);
            }
        } else {
            logger.debug("Ignoring low-confidence transcription: '{}' (confidence: {:.2f})",
                    text, confidence);
        }
    }

    /**
     * Handle session finalization
     */
    @EventListener
    @Async
    public void handleSessionFinalized(AudioSessionFinalizedEvent event) {
        String sessionId = event.getSessionId();
        logger.info("Finalizing conversation session: {}", sessionId);

        ConversationSession session = activeSessions.remove(sessionId);
        if (session != null) {
            // Process any remaining transcript
            if (session.hasUnprocessedTranscript()) {
                processRemainingTranscript(session);
            }

            // Cleanup session resources
            session.cleanup();

            logger.info("Conversation session finalized: {}", sessionId);
        }
    }

    /**
     * Trigger AI processing for conversation
     */
    private void triggerAIProcessing(ConversationSession session, SilenceDetectionResult silenceResult) {
        String sessionId = session.getSessionId();

        logger.info("Triggering AI processing for session: {} (silence type: {})",
                sessionId, silenceResult.getSilenceType());

        // Get enhanced conversation context using context manager
        ConversationContext basicContext = session.buildConversationContext();
        ConversationContext context = contextManager.buildOptimizedContext(
                sessionId,
                basicContext.getMessages(),
                basicContext.getSystemPrompt()
        );

        if (context.isEmpty()) {
            logger.debug("No content to process for session: {}", sessionId);
            return;
        }

        // Mark as processing
        session.markAIProcessingStarted();

        // Enhanced parallel AI processing
        parallelProcessor.executeAIProcessing(sessionId, () -> {
            try {
                // Generate AI response
                processConversationWithAI(session, context, silenceResult);
                return null;

            } catch (Exception e) {
                logger.error("Error in AI processing for session: {}", sessionId, e);
                session.markAIProcessingCompleted();

                // Send error response
                sendErrorResponseToFrontend(sessionId, "AI processing failed: " + e.getMessage());
                throw new RuntimeException(e);
            }
        }).exceptionally(throwable -> {
            logger.error("Parallel AI processing failed for session: {}", sessionId, throwable);
            return null;
        });
    }

    /**
     * Process conversation with AI service
     */
    private void processConversationWithAI(ConversationSession session, ConversationContext context,
                                           SilenceDetectionResult silenceResult) {
        String sessionId = session.getSessionId();

        try {
            // Prepare AI request
            IAIService.ChatRequest chatRequest = new IAIService.ChatRequest(
                    context.getMessages(),
                    context.getSystemPrompt(),
                    true // Enable streaming
            );

            // Set up streaming callback
            IAIService.StreamingCallback callback = new IAIService.StreamingCallback() {
                @Override
                public void onToken(String token) {
                    // Forward streaming response to frontend
                    forwardAIResponseTokenToFrontend(sessionId, token, false);
                }

                @Override
                public void onComplete(IAIService.AIResponse response) {
                    session.markAIProcessingCompleted();
                    session.clearProcessedTranscript();
                    logger.info("AI response completed for session: {}", sessionId);

                    // Add AI response to session
                    if (response != null && response.isSuccess()) {
                        session.addAIResponse(response.getContent(), System.currentTimeMillis());

                        // Update context manager with conversation turn
                        String lastUserMessage = session.getLatestUserMessage();
                        if (lastUserMessage != null) {
                            contextManager.addConversationTurn(sessionId, lastUserMessage, response.getContent());
                        }
                    }
                }

                @Override
                public void onError(String error) {
                    logger.error("AI streaming error for session {}: {}", sessionId, error);
                    session.markAIProcessingCompleted();
                    sendErrorResponseToFrontend(sessionId, "AI response failed: " + error);
                }

                @Override
                public void onTokenReceived(String token, boolean isComplete) {
                    // Forward streaming response to frontend
                    forwardAIResponseTokenToFrontend(sessionId, token, isComplete);

                    if (isComplete) {
                        session.markAIProcessingCompleted();
                        session.clearProcessedTranscript();
                        logger.info("AI response completed for session: {}", sessionId);
                    }
                }
            };

            // Start streaming AI response
            aiService.generateStreamingResponse(chatRequest, callback)
                    .exceptionally(throwable -> {
                        logger.error("AI service error for session: {}", sessionId, throwable);
                        session.markAIProcessingCompleted();
                        sendErrorResponseToFrontend(sessionId, "AI service unavailable");
                        return null;
                    });

        } catch (Exception e) {
            logger.error("Error setting up AI processing for session: {}", sessionId, e);
            session.markAIProcessingCompleted();
            sendErrorResponseToFrontend(sessionId, "Failed to process conversation");
        }
    }

    /**
     * Process remaining transcript on session end
     */
    private void processRemainingTranscript(ConversationSession session) {
        logger.info("Processing remaining transcript for session: {}", session.getSessionId());

        ConversationContext context = session.buildConversationContext();
        if (!context.isEmpty()) {
            // Create synthetic silence for final processing
            SilenceDetectionResult finalSilence = new SilenceDetectionResult(
                    true, false, 10000); // Long silence to indicate session end

            processConversationWithAI(session, context, finalSilence);
        }
    }

    // Frontend communication methods

    private void forwardPartialTranscriptToFrontend(String sessionId, String text, double confidence) {
        // Implementation would send WebSocket message to frontend
        logger.debug("Forwarding partial transcript to frontend: session={}, text='{}'", sessionId, text);
        // TODO: Implement WebSocket forwarding
    }

    private void forwardFinalTranscriptToFrontend(String sessionId, String text, double confidence) {
        // Implementation would send WebSocket message to frontend
        logger.debug("Forwarding final transcript to frontend: session={}, text='{}'", sessionId, text);
        // TODO: Implement WebSocket forwarding
    }

    private void forwardAIResponseTokenToFrontend(String sessionId, String token, boolean isComplete) {
        // Implementation would send streaming WebSocket message to frontend
        logger.debug("Forwarding AI token to frontend: session={}, token='{}', complete={}",
                sessionId, token, isComplete);
        // TODO: Implement WebSocket streaming
    }

    private void sendErrorResponseToFrontend(String sessionId, String error) {
        // Implementation would send error WebSocket message to frontend
        logger.debug("Sending error to frontend: session={}, error='{}'", sessionId, error);
        // TODO: Implement WebSocket error handling
    }

    /**
     * Get conversation statistics
     */
    public ConversationStatistics getStatistics() {
        return new ConversationStatistics(
                activeSessions.size(),
                activeSessions.values().stream()
                        .mapToLong(ConversationSession::getTotalProcessingTime)
                        .sum(),
                activeSessions.values().stream()
                        .mapToInt(ConversationSession::getMessageCount)
                        .sum()
        );
    }

    /**
     * Get session information
     */
    public ConversationSession getSession(String sessionId) {
        return activeSessions.get(sessionId);
    }

    /**
     * Cleanup all resources
     */
    public void shutdown() {
        logger.info("Shutting down ConversationOrchestrator...");

        // Finalize all active sessions
        activeSessions.values().forEach(ConversationSession::cleanup);
        activeSessions.clear();

        conversationProcessor.shutdown();
        logger.info("ConversationOrchestrator shutdown complete");
    }

    /**
     * Statistics container
     */
    public static class ConversationStatistics {
        private final int activeSessions;
        private final long totalProcessingTime;
        private final int totalMessages;

        public ConversationStatistics(int activeSessions, long totalProcessingTime, int totalMessages) {
            this.activeSessions = activeSessions;
            this.totalProcessingTime = totalProcessingTime;
            this.totalMessages = totalMessages;
        }

        public int getActiveSessions() {
            return activeSessions;
        }

        public long getTotalProcessingTime() {
            return totalProcessingTime;
        }

        public int getTotalMessages() {
            return totalMessages;
        }
    }
}
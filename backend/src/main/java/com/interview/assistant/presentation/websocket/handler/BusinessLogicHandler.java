package com.interview.assistant.presentation.websocket.handler;

import com.interview.assistant.domain.entity.Message;
import com.interview.assistant.domain.entity.Session;
import com.interview.assistant.domain.repository.ISessionRepository;
import com.interview.assistant.domain.repository.IMessageRepository;
import com.interview.assistant.domain.service.IAIService;
import com.interview.assistant.domain.service.ITranscriptionService;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

/**
 * Business logic handler for WebSocket message processing
 * 
 * Why: Coordinates domain services to process WebSocket messages
 * Pattern: Facade - simplifies interaction with complex domain services
 * Rationale: Separates WebSocket concerns from business logic
 */
@Component
@Profile("!test")
public class BusinessLogicHandler {
    
    private final ISessionRepository sessionRepository;
    private final IMessageRepository messageRepository;
    private final ITranscriptionService transcriptionService;
    private final IAIService aiService;
    
    public BusinessLogicHandler(ISessionRepository sessionRepository,
                               IMessageRepository messageRepository,
                               ITranscriptionService transcriptionService,
                               IAIService aiService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.transcriptionService = transcriptionService;
        this.aiService = aiService;
    }
    
    /**
     * Process audio data message
     * Why: Convert audio to text and generate AI response
     * 
     * @param message WebSocket message containing audio data
     * @return Future containing processing result
     */
    public CompletableFuture<MessageProcessingResult> processAudioMessage(WebSocketMessage message) {
        String sessionId = message.getSessionId();
        byte[] audioData = (byte[]) message.getPayload();
        
        return sessionRepository.findById(sessionId)
            .map(session -> {
                // Start transcription
                return transcriptionService.transcribe(
                    audioData, 
                    ITranscriptionService.AudioFormat.pcm16k(), 
                    session.getTargetLanguage()
                ).thenCompose(transcriptionResult -> {
                    if (!transcriptionResult.isSuccess()) {
                        return CompletableFuture.completedFuture(
                            MessageProcessingResult.error("Transcription failed: " + transcriptionResult.getErrorMessage())
                        );
                    }
                    
                    // Create user message
                    Message userMessage = Message.createUserMessage(
                        transcriptionResult.getText(),
                        transcriptionResult.getConfidence(),
                        transcriptionResult.getDetectedLanguage()
                    );
                    
                    // Save user message
                    userMessage.setSession(session);
                    messageRepository.save(userMessage);
                    session.addMessage(userMessage);
                    sessionRepository.save(session);
                    
                    // Generate AI response
                    return aiService.generateResponse(
                        sessionId,
                        transcriptionResult.getText(),
                        transcriptionResult.getDetectedLanguage()
                    ).thenApply(aiResponse -> {
                        if (!aiResponse.isSuccess()) {
                            return MessageProcessingResult.error("AI response failed: " + aiResponse.getErrorMessage());
                        }
                        
                        // Create assistant message
                        Message assistantMessage = Message.createAssistantMessage(
                            aiResponse.getContent(),
                            aiResponse.getModel(),
                            aiResponse.getTokensUsed(),
                            aiResponse.getProcessingTimeMs()
                        );
                        
                        // Save assistant message
                        assistantMessage.setSession(session);
                        messageRepository.save(assistantMessage);
                        session.addMessage(assistantMessage);
                        sessionRepository.save(session);
                        
                        return MessageProcessingResult.success(
                            transcriptionResult,
                            aiResponse,
                            userMessage,
                            assistantMessage
                        );
                    });
                });
            })
            .orElse(CompletableFuture.completedFuture(
                MessageProcessingResult.error("Session not found: " + sessionId)
            ));
    }
    
    /**
     * Process session start message
     * Why: Initialize or retrieve conversation session
     */
    public CompletableFuture<MessageProcessingResult> processSessionStart(WebSocketMessage message) {
        String sessionId = message.getSessionId();
        
        return sessionRepository.findByIdAsync(sessionId)
            .thenApply(existingSession -> {
                if (existingSession.isPresent()) {
                    // Update existing session
                    Session session = existingSession.get();
                    session.setLastAccessedAt(java.time.Instant.now());
                    sessionRepository.save(session);
                    
                    return MessageProcessingResult.sessionReady(session);
                } else {
                    // Create new session
                    Session newSession = Session.create("en-US", true);
                    newSession.setId(sessionId);
                    sessionRepository.save(newSession);
                    
                    return MessageProcessingResult.sessionCreated(newSession);
                }
            });
    }
    
    /**
     * Process session end message
     * Why: Clean session termination and resource cleanup
     */
    public CompletableFuture<MessageProcessingResult> processSessionEnd(WebSocketMessage message) {
        String sessionId = message.getSessionId();
        
        return sessionRepository.findByIdAsync(sessionId)
            .thenApply(existingSession -> {
                if (existingSession.isPresent()) {
                    Session session = existingSession.get();
                    session.close();
                    sessionRepository.save(session);
                    
                    return MessageProcessingResult.sessionClosed(session);
                } else {
                    return MessageProcessingResult.error("Session not found for closure: " + sessionId);
                }
            });
    }
    
    /**
     * Process heartbeat message
     * Why: Keep session alive and update activity timestamp
     */
    public CompletableFuture<MessageProcessingResult> processHeartbeat(WebSocketMessage message) {
        String sessionId = message.getSessionId();
        
        return sessionRepository.updateLastAccessedTime(sessionId, java.time.Instant.now()) > 0
            ? CompletableFuture.completedFuture(MessageProcessingResult.heartbeatAck())
            : CompletableFuture.completedFuture(MessageProcessingResult.error("Session not found for heartbeat: " + sessionId));
    }
    
    /**
     * Get session statistics
     * Why: Provide session information for monitoring
     */
    public CompletableFuture<SessionStats> getSessionStats(String sessionId) {
        return sessionRepository.findByIdAsync(sessionId)
            .thenApply(session -> {
                if (session.isPresent()) {
                    Session s = session.get();
                    long messageCount = messageRepository.countBySessionId(sessionId);
                    double avgConfidence = messageRepository.getAverageConfidenceBySessionId(sessionId);
                    long totalTokens = messageRepository.getTotalTokensBySessionId(sessionId);
                    
                    return new SessionStats(
                        sessionId,
                        s.getStatus().toString(),
                        messageCount,
                        avgConfidence,
                        totalTokens,
                        s.getCreatedAt(),
                        s.getLastAccessedAt()
                    );
                }
                return null;
            });
    }
    
    /**
     * Message processing result value object
     */
    public static class MessageProcessingResult {
        private final boolean success;
        private final String errorMessage;
        private final ProcessingType type;
        private final Object data;
        
        private MessageProcessingResult(boolean success, String errorMessage, ProcessingType type, Object data) {
            this.success = success;
            this.errorMessage = errorMessage;
            this.type = type;
            this.data = data;
        }
        
        public static MessageProcessingResult success(ITranscriptionService.TranscriptionResult transcription,
                                                    IAIService.AIResponse aiResponse,
                                                    Message userMessage,
                                                    Message assistantMessage) {
            ConversationResult result = new ConversationResult(transcription, aiResponse, userMessage, assistantMessage);
            return new MessageProcessingResult(true, null, ProcessingType.CONVERSATION, result);
        }
        
        public static MessageProcessingResult sessionReady(Session session) {
            return new MessageProcessingResult(true, null, ProcessingType.SESSION_READY, session);
        }
        
        public static MessageProcessingResult sessionCreated(Session session) {
            return new MessageProcessingResult(true, null, ProcessingType.SESSION_CREATED, session);
        }
        
        public static MessageProcessingResult sessionClosed(Session session) {
            return new MessageProcessingResult(true, null, ProcessingType.SESSION_CLOSED, session);
        }
        
        public static MessageProcessingResult heartbeatAck() {
            return new MessageProcessingResult(true, null, ProcessingType.HEARTBEAT_ACK, null);
        }
        
        public static MessageProcessingResult error(String errorMessage) {
            return new MessageProcessingResult(false, errorMessage, ProcessingType.ERROR, null);
        }
        
        // Getters
        public boolean isSuccess() { return success; }
        public String getErrorMessage() { return errorMessage; }
        public ProcessingType getType() { return type; }
        public Object getData() { return data; }
        
        public enum ProcessingType {
            CONVERSATION,
            SESSION_READY,
            SESSION_CREATED,
            SESSION_CLOSED,
            HEARTBEAT_ACK,
            ERROR
        }
    }
    
    /**
     * Conversation processing result
     */
    public static class ConversationResult {
        private final ITranscriptionService.TranscriptionResult transcription;
        private final IAIService.AIResponse aiResponse;
        private final Message userMessage;
        private final Message assistantMessage;
        
        public ConversationResult(ITranscriptionService.TranscriptionResult transcription,
                                IAIService.AIResponse aiResponse,
                                Message userMessage,
                                Message assistantMessage) {
            this.transcription = transcription;
            this.aiResponse = aiResponse;
            this.userMessage = userMessage;
            this.assistantMessage = assistantMessage;
        }
        
        // Getters
        public ITranscriptionService.TranscriptionResult getTranscription() { return transcription; }
        public IAIService.AIResponse getAiResponse() { return aiResponse; }
        public Message getUserMessage() { return userMessage; }
        public Message getAssistantMessage() { return assistantMessage; }
    }
    
    /**
     * Session statistics value object
     */
    public static class SessionStats {
        private final String sessionId;
        private final String status;
        private final long messageCount;
        private final double averageConfidence;
        private final long totalTokens;
        private final java.time.Instant createdAt;
        private final java.time.Instant lastAccessedAt;
        
        public SessionStats(String sessionId, String status, long messageCount, 
                          double averageConfidence, long totalTokens,
                          java.time.Instant createdAt, java.time.Instant lastAccessedAt) {
            this.sessionId = sessionId;
            this.status = status;
            this.messageCount = messageCount;
            this.averageConfidence = averageConfidence;
            this.totalTokens = totalTokens;
            this.createdAt = createdAt;
            this.lastAccessedAt = lastAccessedAt;
        }
        
        // Getters
        public String getSessionId() { return sessionId; }
        public String getStatus() { return status; }
        public long getMessageCount() { return messageCount; }
        public double getAverageConfidence() { return averageConfidence; }
        public long getTotalTokens() { return totalTokens; }
        public java.time.Instant getCreatedAt() { return createdAt; }
        public java.time.Instant getLastAccessedAt() { return lastAccessedAt; }
    }
}
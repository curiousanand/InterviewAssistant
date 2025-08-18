package com.interview.assistant.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.assistant.orchestration.ConversationOrchestrator;
import com.interview.assistant.service.StreamingAIService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Real-time WebSocket handler with complete conversation orchestration
 * <p>
 * Integrates all components for full real-time multimodal conversation:
 * - Voice Activity Detection
 * - Dual-buffer transcript management  
 * - Smart pause detection
 * - AI response interruption
 * - Streaming AI token delivery
 * <p>
 * Why: Complete orchestration layer for natural conversation flow
 * Pattern: Facade coordinating all orchestration services
 * Rationale: Provides seamless real-time conversation experience
 */
@Component
@Profile("!test")
public class RealTimeWebSocketHandler implements WebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(RealTimeWebSocketHandler.class);

    private final ConversationOrchestrator conversationOrchestrator;
    private final WebSocketSessionManager sessionManager;
    private final ValidationHandler validationHandler;
    private final AuthenticationHandler authenticationHandler;
    private final ObjectMapper objectMapper;

    // Session state tracking
    private final Map<String, String> webSocketToAppSessionMap = new ConcurrentHashMap<>();
    private final Map<String, SessionState> sessionStates = new ConcurrentHashMap<>();

    public RealTimeWebSocketHandler(ConversationOrchestrator conversationOrchestrator,
                                   WebSocketSessionManager sessionManager,
                                   ValidationHandler validationHandler,
                                   AuthenticationHandler authenticationHandler,
                                   ObjectMapper objectMapper) {
        this.conversationOrchestrator = conversationOrchestrator;
        this.sessionManager = sessionManager;
        this.validationHandler = validationHandler;
        this.authenticationHandler = authenticationHandler;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessionManager.registerSession(session);

        // Send session ready message
        WebSocketMessage readyMessage = WebSocketMessage.create(
                WebSocketMessage.MessageType.SESSION_READY,
                session.getId(),
                null
        );

        sendMessage(session, readyMessage);
        logger.info("Real-time WebSocket connection established: {}", session.getId());
    }

    @Override
    public void handleMessage(WebSocketSession session, org.springframework.web.socket.WebSocketMessage<?> message) throws Exception {
        try {
            if (message instanceof TextMessage) {
                handleTextMessage(session, (TextMessage) message);
            } else if (message instanceof BinaryMessage) {
                handleBinaryMessage(session, (BinaryMessage) message);
            }
        } catch (Exception e) {
            logger.error("Error handling WebSocket message for session: {}", session.getId(), e);
            sendErrorMessage(session, "Error processing message: " + e.getMessage());
        }
    }

    /**
     * Handle text messages (control messages)
     */
    private void handleTextMessage(WebSocketSession session, TextMessage textMessage) throws Exception {
        String payload = textMessage.getPayload();
        logger.debug("Received text message: {}", payload);

        try {
            WebSocketMessage wsMessage = objectMapper.readValue(payload, WebSocketMessage.class);
            
            switch (wsMessage.getType()) {
                case SESSION_START -> handleSessionStart(session, wsMessage);
                case SESSION_END -> handleSessionEnd(session, wsMessage);
                case HEARTBEAT -> handleHeartbeat(session, wsMessage);
                default -> sendErrorMessage(session, "Unsupported message type: " + wsMessage.getType());
            }
        } catch (Exception e) {
            logger.warn("Failed to parse text message: {}", payload, e);
            sendErrorMessage(session, "Invalid message format");
        }
    }

    /**
     * Handle binary messages (audio data) - The core of real-time processing
     */
    private void handleBinaryMessage(WebSocketSession session, BinaryMessage binaryMessage) throws Exception {
        byte[] audioData = binaryMessage.getPayload().array();
        logger.debug("Received audio data: {} bytes", audioData.length);

        String webSocketSessionId = session.getId();
        String appSessionId = webSocketToAppSessionMap.get(webSocketSessionId);

        if (appSessionId == null) {
            logger.error("No application session mapped for WebSocket session: {}", webSocketSessionId);
            sendErrorMessage(session, "Session not initialized. Please send SESSION_START message first.");
            return;
        }

        // Get session state
        SessionState sessionState = sessionStates.get(appSessionId);
        if (sessionState == null || !sessionState.isActive()) {
            logger.error("Session not active: {}", appSessionId);
            sendErrorMessage(session, "Session not active");
            return;
        }

        // Process audio through conversation orchestrator
        conversationOrchestrator.processAudioChunk(appSessionId, audioData, orchestrationEvent -> {
            try {
                handleOrchestrationEvent(session, orchestrationEvent);
            } catch (Exception e) {
                logger.error("Error handling orchestration event for session: {}", appSessionId, e);
            }
        }).exceptionally(throwable -> {
            logger.error("Orchestration failed for session: {}", appSessionId, throwable);
            try {
                sendErrorMessage(session, "Audio processing failed: " + throwable.getMessage());
            } catch (Exception e) {
                logger.error("Error sending error message", e);
            }
            return null;
        });
    }

    /**
     * Handle orchestration events and send appropriate WebSocket messages
     */
    private void handleOrchestrationEvent(WebSocketSession session, ConversationOrchestrator.OrchestrationEvent event) throws Exception {
        logger.debug("Handling orchestration event: {} for session: {}", event.getType(), event.getSessionId());

        switch (event.getType()) {
            case TRANSCRIPT_PARTIAL -> {
                ConversationOrchestrator.OrchestrationEvent.TranscriptPayload payload = 
                    (ConversationOrchestrator.OrchestrationEvent.TranscriptPayload) event.getPayload();
                
                sendWebSocketMessage(session, "transcript.partial", Map.of(
                    "text", payload.getText(),
                    "confidence", payload.getConfidence(),
                    "isFinal", false
                ));
            }
            
            case TRANSCRIPT_FINAL -> {
                ConversationOrchestrator.OrchestrationEvent.TranscriptPayload payload = 
                    (ConversationOrchestrator.OrchestrationEvent.TranscriptPayload) event.getPayload();
                
                sendWebSocketMessage(session, "transcript.final", Map.of(
                    "text", payload.getText(),
                    "confidence", payload.getConfidence(),
                    "isFinal", true
                ));
            }
            
            case AI_THINKING -> {
                sendWebSocketMessage(session, "assistant.thinking", null);
            }
            
            case AI_RESPONSE_DELTA -> {
                String text = (String) event.getPayload();
                sendWebSocketMessage(session, "assistant.delta", Map.of("text", text));
            }
            
            case AI_RESPONSE_DONE -> {
                String text = (String) event.getPayload();
                sendWebSocketMessage(session, "assistant.done", Map.of("text", text));
            }
            
            case AI_INTERRUPTED -> {
                sendWebSocketMessage(session, "assistant.interrupted", null);
            }
            
            case SESSION_STARTED -> {
                sendWebSocketMessage(session, "session.started", null);
            }
            
            case SESSION_ENDED -> {
                sendWebSocketMessage(session, "session.ended", null);
            }
            
            case ERROR -> {
                String error = (String) event.getPayload();
                sendErrorMessage(session, error);
            }
        }
    }

    /**
     * Handle session start
     */
    private void handleSessionStart(WebSocketSession session, WebSocketMessage message) {
        String webSocketSessionId = session.getId();
        String appSessionId = message.getSessionId();
        
        // Map WebSocket session to application session
        webSocketToAppSessionMap.put(webSocketSessionId, appSessionId);
        
        // Create session state
        SessionState sessionState = new SessionState(appSessionId, true);
        sessionStates.put(appSessionId, sessionState);
        
        // Start conversation orchestration
        conversationOrchestrator.startSession(appSessionId, orchestrationEvent -> {
            try {
                handleOrchestrationEvent(session, orchestrationEvent);
            } catch (Exception e) {
                logger.error("Error handling orchestration event during session start", e);
            }
        }).thenRun(() -> {
            logger.info("Started real-time conversation orchestration for session: {} (WebSocket: {})", 
                       appSessionId, webSocketSessionId);
            
            try {
                sendWebSocketMessage(session, "session.ready", Map.of("sessionId", appSessionId));
            } catch (Exception e) {
                logger.error("Error sending session ready message", e);
            }
        }).exceptionally(throwable -> {
            logger.error("Failed to start orchestration for session: {}", appSessionId, throwable);
            try {
                sendErrorMessage(session, "Failed to start session orchestration");
            } catch (Exception e) {
                logger.error("Error sending error message", e);
            }
            return null;
        });
    }

    /**
     * Handle session end
     */
    private void handleSessionEnd(WebSocketSession session, WebSocketMessage message) {
        String webSocketSessionId = session.getId();
        String appSessionId = message.getSessionId();
        
        // Clean up orchestration
        conversationOrchestrator.endSession(appSessionId).thenRun(() -> {
            logger.info("Ended conversation orchestration for session: {}", appSessionId);
        });
        
        // Clean up session state
        sessionStates.remove(appSessionId);
        webSocketToAppSessionMap.remove(webSocketSessionId);
        
        try {
            sendWebSocketMessage(session, "session.ended", null);
        } catch (Exception e) {
            logger.error("Error sending session ended message", e);
        }
    }

    /**
     * Handle heartbeat
     */
    private void handleHeartbeat(WebSocketSession session, WebSocketMessage message) {
        WebSocketMessage pong = WebSocketMessage.create(
                WebSocketMessage.MessageType.PONG,
                message.getSessionId(),
                null
        );
        sendMessage(session, pong);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        logger.error("WebSocket transport error for session: {}", session.getId(), exception);
        cleanup(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        logger.info("WebSocket connection closed: {} with status: {}", session.getId(), closeStatus);
        cleanup(session);
    }

    @Override
    public boolean supportsPartialMessages() {
        return true; // Support partial audio messages
    }

    /**
     * Cleanup session resources
     */
    private void cleanup(WebSocketSession session) {
        String webSocketSessionId = session.getId();
        String appSessionId = webSocketToAppSessionMap.remove(webSocketSessionId);
        
        if (appSessionId != null) {
            // End orchestration
            conversationOrchestrator.endSession(appSessionId);
            
            // Clean up session state
            sessionStates.remove(appSessionId);
            
            logger.info("Cleaned up session resources: {} (WebSocket: {})", appSessionId, webSocketSessionId);
        }
        
        // Cleanup WebSocket session
        sessionManager.unregisterSession(session);
        authenticationHandler.cleanupSession(session);
    }

    /**
     * Send WebSocket message with consistent format
     */
    private void sendWebSocketMessage(WebSocketSession session, String type, Object payload) throws Exception {
        if (!session.isOpen()) return;
        
        Map<String, Object> message = Map.of(
            "type", type,
            "sessionId", session.getId(),
            "payload", payload != null ? payload : Map.of(),
            "timestamp", System.currentTimeMillis()
        );
        
        String jsonMessage = objectMapper.writeValueAsString(message);
        session.sendMessage(new TextMessage(jsonMessage));
    }

    /**
     * Send error message to client
     */
    private void sendErrorMessage(WebSocketSession session, String errorMessage) {
        try {
            sendWebSocketMessage(session, "error", Map.of("message", errorMessage));
        } catch (Exception e) {
            logger.error("Failed to send error message to session: {}", session.getId(), e);
        }
    }

    /**
     * Send WebSocket message using message object
     */
    private void sendMessage(WebSocketSession session, WebSocketMessage message) {
        try {
            if (session.isOpen()) {
                String jsonMessage = objectMapper.writeValueAsString(message);
                session.sendMessage(new TextMessage(jsonMessage));
            }
        } catch (Exception e) {
            logger.error("Failed to send message to session: {}", session.getId(), e);
        }
    }

    /**
     * Session state tracking
     */
    private static class SessionState {
        private final String sessionId;
        private final AtomicBoolean active;
        private final long startTime;

        public SessionState(String sessionId, boolean active) {
            this.sessionId = sessionId;
            this.active = new AtomicBoolean(active);
            this.startTime = System.currentTimeMillis();
        }

        public boolean isActive() { return active.get(); }
        public void setActive(boolean active) { this.active.set(active); }
        public String getSessionId() { return sessionId; }
        public long getStartTime() { return startTime; }
    }
}
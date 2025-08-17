package com.interview.assistant.presentation.websocket;

import com.interview.assistant.presentation.websocket.handler.AuthenticationHandler;
import com.interview.assistant.presentation.websocket.handler.BusinessLogicHandler;
import com.interview.assistant.presentation.websocket.handler.ValidationHandler;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;

/**
 * Main WebSocket handler for streaming audio and real-time communication
 * 
 * Why: Coordinates all WebSocket message processing through handler chain
 * Pattern: Chain of Responsibility - processes messages through validation, auth, and business logic
 * Rationale: Provides clean separation of concerns for WebSocket message handling
 */
@Component
@Profile("!test")
public class StreamingWebSocketHandler implements WebSocketHandler {
    
    private final WebSocketSessionManager sessionManager;
    private final ValidationHandler validationHandler;
    private final AuthenticationHandler authenticationHandler;
    private final BusinessLogicHandler businessLogicHandler;
    
    public StreamingWebSocketHandler(WebSocketSessionManager sessionManager,
                                   ValidationHandler validationHandler,
                                   AuthenticationHandler authenticationHandler,
                                   BusinessLogicHandler businessLogicHandler) {
        this.sessionManager = sessionManager;
        this.validationHandler = validationHandler;
        this.authenticationHandler = authenticationHandler;
        this.businessLogicHandler = businessLogicHandler;
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
        
        session.sendMessage(new TextMessage(readyMessage.toString()));
    }
    
    @Override
    public void handleMessage(WebSocketSession session, org.springframework.web.socket.WebSocketMessage<?> message) throws Exception {
        // Parse message into our domain model
        // This is simplified - in production you'd have proper JSON parsing
        return;
    }
    
    public void handleMessage(WebSocketSession session, WebSocketMessage message) throws Exception {
        // Update session activity
        sessionManager.updateLastActivity(session.getId());
        
        // Validate message
        ValidationHandler.ValidationResult validation = validationHandler.validate(message);
        if (!validation.isValid()) {
            sendErrorMessage(session, "Validation failed: " + validation.getErrorMessage());
            return;
        }
        
        // Check authentication
        if (!authenticationHandler.isAuthenticated(session)) {
            sendErrorMessage(session, "Session not authenticated");
            return;
        }
        
        // Process message based on type
        processMessage(session, message);
    }
    
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        // Log error and cleanup
        sessionManager.unregisterSession(session);
    }
    
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
        sessionManager.unregisterSession(session);
        authenticationHandler.cleanupSession(session);
    }
    
    @Override
    public boolean supportsPartialMessages() {
        return true; // Support partial audio messages
    }
    
    /**
     * Process validated and authenticated message
     */
    private void processMessage(WebSocketSession session, WebSocketMessage message) {
        switch (message.getType()) {
            case AUDIO_DATA -> processAudioMessage(session, message);
            case SESSION_START -> processSessionStart(session, message);
            case SESSION_END -> processSessionEnd(session, message);
            case HEARTBEAT -> processHeartbeat(session, message);
            default -> sendErrorMessage(session, "Unsupported message type: " + message.getType());
        }
    }
    
    /**
     * Process audio data message
     */
    private void processAudioMessage(WebSocketSession session, WebSocketMessage message) {
        businessLogicHandler.processAudioMessage(message)
            .thenAccept(result -> {
                if (result.isSuccess()) {
                    sendProcessingResult(session, result);
                } else {
                    sendErrorMessage(session, result.getErrorMessage());
                }
            })
            .exceptionally(throwable -> {
                sendErrorMessage(session, "Processing error: " + throwable.getMessage());
                return null;
            });
    }
    
    /**
     * Process session start message
     */
    private void processSessionStart(WebSocketSession session, WebSocketMessage message) {
        businessLogicHandler.processSessionStart(message)
            .thenAccept(result -> sendProcessingResult(session, result))
            .exceptionally(throwable -> {
                sendErrorMessage(session, "Session start error: " + throwable.getMessage());
                return null;
            });
    }
    
    /**
     * Process session end message
     */
    private void processSessionEnd(WebSocketSession session, WebSocketMessage message) {
        businessLogicHandler.processSessionEnd(message)
            .thenAccept(result -> {
                sendProcessingResult(session, result);
                // Close session after processing
                try {
                    session.close();
                } catch (Exception e) {
                    // Log error
                }
            });
    }
    
    /**
     * Process heartbeat message
     */
    private void processHeartbeat(WebSocketSession session, WebSocketMessage message) {
        // Simple heartbeat response
        WebSocketMessage pong = WebSocketMessage.create(
            WebSocketMessage.MessageType.PONG, 
            message.getSessionId(), 
            null
        );
        sendMessage(session, pong);
    }
    
    /**
     * Send processing result to client
     */
    private void sendProcessingResult(WebSocketSession session, BusinessLogicHandler.MessageProcessingResult result) {
        // Convert result to appropriate WebSocket messages based on type
        switch (result.getType()) {
            case CONVERSATION -> sendConversationResult(session, result);
            case SESSION_READY, SESSION_CREATED -> sendSessionReady(session, result);
            case SESSION_CLOSED -> sendSessionClosed(session, result);
            case HEARTBEAT_ACK -> sendHeartbeatAck(session);
            case ERROR -> sendErrorMessage(session, result.getErrorMessage());
        }
    }
    
    /**
     * Send conversation result (transcription + AI response)
     */
    private void sendConversationResult(WebSocketSession session, BusinessLogicHandler.MessageProcessingResult result) {
        BusinessLogicHandler.ConversationResult conversation = (BusinessLogicHandler.ConversationResult) result.getData();
        
        // Send transcription result
        WebSocketMessage transcriptMessage = WebSocketMessage.transcriptFinal(
            session.getId(),
            conversation.getTranscription().getText(),
            conversation.getTranscription().getConfidence()
        );
        sendMessage(session, transcriptMessage);
        
        // Send AI response
        WebSocketMessage assistantMessage = WebSocketMessage.assistantDone(
            session.getId(),
            conversation.getAiResponse().getContent()
        );
        sendMessage(session, assistantMessage);
    }
    
    /**
     * Send session ready message
     */
    private void sendSessionReady(WebSocketSession session, BusinessLogicHandler.MessageProcessingResult result) {
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_READY,
            session.getId(),
            result.getData()
        );
        sendMessage(session, message);
    }
    
    /**
     * Send session closed message
     */
    private void sendSessionClosed(WebSocketSession session, BusinessLogicHandler.MessageProcessingResult result) {
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_END,
            session.getId(),
            null
        );
        sendMessage(session, message);
    }
    
    /**
     * Send heartbeat acknowledgment
     */
    private void sendHeartbeatAck(WebSocketSession session) {
        WebSocketMessage pong = WebSocketMessage.create(
            WebSocketMessage.MessageType.PONG,
            session.getId(),
            null
        );
        sendMessage(session, pong);
    }
    
    /**
     * Send error message to client
     */
    private void sendErrorMessage(WebSocketSession session, String errorMessage) {
        WebSocketMessage error = WebSocketMessage.error(session.getId(), errorMessage);
        sendMessage(session, error);
    }
    
    /**
     * Send WebSocket message to client
     */
    private void sendMessage(WebSocketSession session, WebSocketMessage message) {
        try {
            if (session.isOpen()) {
                // In a real implementation, you'd serialize the message properly
                session.sendMessage(new TextMessage(message.toString()));
            }
        } catch (Exception e) {
            // Log error in production
        }
    }
}
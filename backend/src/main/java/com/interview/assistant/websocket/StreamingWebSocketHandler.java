package com.interview.assistant.websocket;

import com.interview.assistant.websocket.AuthenticationHandler;
import com.interview.assistant.websocket.BusinessLogicHandler;
import com.interview.assistant.websocket.ValidationHandler;
import com.interview.assistant.websocket.WebSocketMessage;
import com.interview.assistant.websocket.MessageProcessingResult;
import com.interview.assistant.websocket.MessageType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
    
    private static final Logger logger = LoggerFactory.getLogger(StreamingWebSocketHandler.class);
    
    private final WebSocketSessionManager sessionManager;
    private final ValidationHandler validationHandler;
    private final AuthenticationHandler authenticationHandler;
    private final BusinessLogicHandler businessLogicHandler;
    private final ObjectMapper objectMapper;
    
    // Map WebSocket session ID to application session ID
    private final java.util.Map<String, String> webSocketToAppSessionMap = new java.util.concurrent.ConcurrentHashMap<>();
    
    public StreamingWebSocketHandler(WebSocketSessionManager sessionManager,
                                   ValidationHandler validationHandler,
                                   AuthenticationHandler authenticationHandler,
                                   BusinessLogicHandler businessLogicHandler,
                                   ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.validationHandler = validationHandler;
        this.authenticationHandler = authenticationHandler;
        this.businessLogicHandler = businessLogicHandler;
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
        
        String jsonMessage = objectMapper.writeValueAsString(readyMessage);
        if (jsonMessage != null) {
            try {
                session.sendMessage(new TextMessage(jsonMessage));
            } catch (Exception e) {
                // Log error but don't fail connection establishment
                logger.warn("Failed to send session ready message to {}: {}", session.getId(), e.getMessage());
            }
        }
    }
    
    @Override
    public void handleMessage(WebSocketSession session, org.springframework.web.socket.WebSocketMessage<?> message) throws Exception {
        try {
            if (message instanceof TextMessage) {
                // Handle JSON text messages
                String payload = ((TextMessage) message).getPayload();
                logger.info("Received text message: {}", payload);
                
                // Parse the message to extract session information
                try {
                    WebSocketMessage wsMessage = objectMapper.readValue(payload, WebSocketMessage.class);
                    if (wsMessage.getType() == WebSocketMessage.MessageType.SESSION_START) {
                        // Store mapping between WebSocket session ID and application session ID
                        String webSocketSessionId = session.getId();
                        String appSessionId = wsMessage.getSessionId();
                        webSocketToAppSessionMap.put(webSocketSessionId, appSessionId);
                        logger.info("Mapped WebSocket session {} to application session {}", webSocketSessionId, appSessionId);
                    }
                } catch (Exception e) {
                    logger.warn("Failed to parse text message: {}", payload, e);
                }
                
            } else if (message instanceof BinaryMessage) {
                // Handle audio binary messages with Azure Speech Service
                byte[] audioData = ((BinaryMessage) message).getPayload().array();
                logger.info("Received audio data: {} bytes", audioData.length);
                
                // Get the correct application session ID
                String webSocketSessionId = session.getId();
                String appSessionId = webSocketToAppSessionMap.get(webSocketSessionId);
                
                if (appSessionId == null) {
                    logger.error("No application session mapped for WebSocket session: {}", webSocketSessionId);
                    sendErrorMessage(session, "Session not initialized. Please send SESSION_START message first.");
                    return;
                }
                
                // Create WebSocket message for audio processing using application session ID
                WebSocketMessage audioMessage = WebSocketMessage.create(WebSocketMessage.MessageType.AUDIO_DATA, appSessionId, audioData);
                
                // Process audio through BusinessLogicHandler (which uses Azure Speech Service)
                logger.info("Processing audio message through BusinessLogicHandler for app session: {} (WebSocket session: {})", appSessionId, webSocketSessionId);
                businessLogicHandler.processAudioMessage(audioMessage)
                    .thenAccept(result -> {
                        logger.info("BusinessLogicHandler completed for session: {}, success: {}", session.getId(), result.isSuccess());
                        try {
                            sendAzureProcessingResult(session, result);
                        } catch (Exception e) {
                            logger.error("Error sending Azure processing result for session: {}", session.getId(), e);
                        }
                    })
                    .exceptionally(throwable -> {
                        logger.error("Error processing audio through Azure Speech Service for session: {}", session.getId(), throwable);
                        try {
                            sendErrorMessage(session, "Azure Speech processing error: " + throwable.getMessage());
                        } catch (Exception e) {
                            logger.error("Error sending error message for session: {}", session.getId(), e);
                        }
                        return null;
                    });
            }
        } catch (Exception e) {
            logger.error("Error processing WebSocket message for session: {}", session.getId(), e);
            sendErrorMessage(session, "Error processing message: " + e.getMessage());
        }
    }
    
    /**
     * Send Azure Speech Service processing result to client
     */
    private void sendAzureProcessingResult(WebSocketSession session, Object result) throws Exception {
        String sessionId = session.getId();
        
        // Handle the actual result from BusinessLogicHandler
        if (result instanceof BusinessLogicHandler.MessageProcessingResult) {
            BusinessLogicHandler.MessageProcessingResult processingResult = (BusinessLogicHandler.MessageProcessingResult) result;
            
            if (processingResult.isSuccess() && processingResult.getType() == BusinessLogicHandler.MessageProcessingResult.ProcessingType.CONVERSATION) {
                // Extract actual transcription and AI response from Azure services
                BusinessLogicHandler.ConversationResult conversation = (BusinessLogicHandler.ConversationResult) processingResult.getData();
                
                String transcriptionText = conversation.getTranscription().getText();
                double confidence = conversation.getTranscription().getConfidence();
                String aiResponseText = conversation.getAiResponse().getContent();
                
                // Send partial transcript
                String partialMessage = String.format(
                    "{\"type\":\"transcript.partial\",\"sessionId\":\"%s\",\"payload\":{\"text\":\"%s\",\"confidence\":%.2f}}",
                    sessionId,
                    escapeJson(transcriptionText),
                    confidence
                );
                session.sendMessage(new TextMessage(partialMessage));
                
                // Send final transcript
                String finalMessage = String.format(
                    "{\"type\":\"transcript.final\",\"sessionId\":\"%s\",\"payload\":{\"text\":\"%s\",\"confidence\":%.2f}}",
                    sessionId,
                    escapeJson(transcriptionText),
                    confidence
                );
                session.sendMessage(new TextMessage(finalMessage));
                
                // Send AI response
                String aiResponse = String.format(
                    "{\"type\":\"assistant.delta\",\"sessionId\":\"%s\",\"payload\":{\"text\":\"%s\"}}",
                    sessionId,
                    escapeJson(aiResponseText)
                );
                session.sendMessage(new TextMessage(aiResponse));
                
                // Send completion signal
                String completeMessage = String.format(
                    "{\"type\":\"assistant.done\",\"sessionId\":\"%s\",\"payload\":{\"text\":\"\"}}",
                    sessionId
                );
                session.sendMessage(new TextMessage(completeMessage));
                
            } else {
                // Handle error case
                String errorMessage = processingResult.isSuccess() ? "Unexpected processing result type" : processingResult.getErrorMessage();
                sendErrorMessage(session, errorMessage);
            }
        } else {
            // Fallback for unexpected result type
            sendErrorMessage(session, "Invalid processing result format");
        }
    }
    
    private void sendMockTranscription(WebSocketSession session, String input) throws Exception {
        // Escape JSON strings properly
        String safeInput = escapeJson(input);
        String sessionId = session.getId();
        
        // Send partial transcript
        String partialResponse = "{\"type\":\"transcript.partial\",\"sessionId\":\"" + sessionId + "\",\"payload\":{\"text\":\"" + safeInput + "\",\"confidence\":0.95}}";
        session.sendMessage(new TextMessage(partialResponse));
        
        // Send final transcript after a short delay
        Thread.sleep(500);
        String finalResponse = "{\"type\":\"transcript.final\",\"sessionId\":\"" + sessionId + "\",\"payload\":{\"text\":\"" + safeInput + "\",\"confidence\":0.98}}";
        session.sendMessage(new TextMessage(finalResponse));
        
        // Send mock AI response
        String aiResponse = "{\"type\":\"assistant.delta\",\"sessionId\":\"" + sessionId + "\",\"payload\":{\"text\":\"This is a mock AI response to: " + safeInput + "\"}}";
        session.sendMessage(new TextMessage(aiResponse));
        
        // Send completion signal
        Thread.sleep(500);
        String completeResponse = "{\"type\":\"assistant.done\",\"sessionId\":\"" + sessionId + "\",\"payload\":{\"text\":\"\"}}";
        session.sendMessage(new TextMessage(completeResponse));
    }
    
    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                   .replace("\"", "\\\"")
                   .replace("\n", "\\n")
                   .replace("\r", "\\r")
                   .replace("\t", "\\t");
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
        // Clean up session mapping
        webSocketToAppSessionMap.remove(session.getId());
        logger.info("Cleaned up session mapping for WebSocket session: {}", session.getId());
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
                // Properly serialize the message to JSON
                String jsonMessage = objectMapper.writeValueAsString(message);
                session.sendMessage(new TextMessage(jsonMessage));
            }
        } catch (Exception e) {
            // Log error appropriately in production
            // Consider using proper logging framework
        }
    }
}
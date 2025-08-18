package com.interview.assistant.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

/**
 * Service for publishing orchestration events to WebSocket clients
 * 
 * Why: Centralized event publishing with consistent message format
 * Pattern: Publisher service with type-safe event methods
 * Rationale: Ensures consistent WebSocket message structure across all orchestration events
 */
@Service
public class WebSocketEventPublisher {
    
    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventPublisher.class);
    
    private final ObjectMapper objectMapper;
    
    public WebSocketEventPublisher(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }
    
    /**
     * Publish session ready event
     */
    public void publishSessionReady(WebSocketSession session, String sessionId) {
        publishEvent(session, "session.ready", Map.of(
            "sessionId", sessionId,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish partial transcript event
     */
    public void publishPartialTranscript(WebSocketSession session, String text, double confidence) {
        publishEvent(session, "transcript.partial", Map.of(
            "text", text,
            "confidence", confidence,
            "isFinal", false,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish final transcript event
     */
    public void publishFinalTranscript(WebSocketSession session, String text, double confidence) {
        publishEvent(session, "transcript.final", Map.of(
            "text", text,
            "confidence", confidence,
            "isFinal", true,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish AI thinking started event
     */
    public void publishAIThinkingStarted(WebSocketSession session) {
        publishEvent(session, "assistant.thinking", Map.of(
            "status", "started",
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish AI speaking started event
     */
    public void publishAISpeakingStarted(WebSocketSession session) {
        publishEvent(session, "assistant.speaking", Map.of(
            "status", "started",
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish AI response token (streaming)
     */
    public void publishAIResponseToken(WebSocketSession session, String token) {
        publishEvent(session, "assistant.delta", Map.of(
            "text", token,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish AI response complete event
     */
    public void publishAIResponseComplete(WebSocketSession session, String fullResponse) {
        publishEvent(session, "assistant.done", Map.of(
            "text", fullResponse,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish AI interrupted event
     */
    public void publishAIInterrupted(WebSocketSession session) {
        publishEvent(session, "assistant.interrupted", Map.of(
            "reason", "user_interruption",
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish listening state changed event
     */
    public void publishListeningStateChanged(WebSocketSession session, boolean isListening) {
        publishEvent(session, "audio.listening", Map.of(
            "isListening", isListening,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish conversation cleared event
     */
    public void publishConversationCleared(WebSocketSession session) {
        publishEvent(session, "conversation.cleared", Map.of(
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish voice activity detection event
     */
    public void publishVoiceActivity(WebSocketSession session, boolean hasVoice, String event, long pauseDuration) {
        publishEvent(session, "audio.vad", Map.of(
            "hasVoice", hasVoice,
            "event", event,
            "pauseDuration", pauseDuration,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish processing status update
     */
    public void publishProcessingStatus(WebSocketSession session, String status, Map<String, Object> details) {
        Map<String, Object> payload = Map.of(
            "status", status,
            "details", details != null ? details : Map.of(),
            "timestamp", System.currentTimeMillis()
        );
        publishEvent(session, "processing.status", payload);
    }
    
    /**
     * Publish error event
     */
    public void publishError(WebSocketSession session, String errorMessage) {
        publishEvent(session, "error", Map.of(
            "message", errorMessage,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish error with details
     */
    public void publishError(WebSocketSession session, String errorMessage, String errorCode, Map<String, Object> details) {
        publishEvent(session, "error", Map.of(
            "message", errorMessage,
            "code", errorCode,
            "details", details != null ? details : Map.of(),
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish performance metrics event
     */
    public void publishPerformanceMetrics(WebSocketSession session, Map<String, Object> metrics) {
        publishEvent(session, "system.metrics", Map.of(
            "metrics", metrics,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish debug information
     */
    public void publishDebugInfo(WebSocketSession session, String component, Map<String, Object> debugData) {
        publishEvent(session, "debug.info", Map.of(
            "component", component,
            "data", debugData,
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Core event publishing method
     */
    private void publishEvent(WebSocketSession session, String type, Object payload) {
        if (session == null || !session.isOpen()) {
            logger.debug("Cannot publish event '{}': session is null or closed", type);
            return;
        }
        
        try {
            Map<String, Object> message = Map.of(
                "type", type,
                "sessionId", session.getId(),
                "payload", payload != null ? payload : Map.of()
            );
            
            String jsonMessage = objectMapper.writeValueAsString(message);
            session.sendMessage(new TextMessage(jsonMessage));
            
            logger.debug("Published event '{}' to session: {}", type, session.getId());
            
        } catch (Exception e) {
            logger.error("Failed to publish event '{}' to session: {}", type, session.getId(), e);
        }
    }
    
    /**
     * Publish custom event with arbitrary payload
     */
    public void publishCustomEvent(WebSocketSession session, String eventType, Object payload) {
        publishEvent(session, eventType, payload);
    }
    
    /**
     * Batch publish multiple events (for performance optimization)
     */
    public void publishBatch(WebSocketSession session, Map<String, Object> events) {
        if (session == null || !session.isOpen()) {
            logger.debug("Cannot publish batch events: session is null or closed");
            return;
        }
        
        try {
            Map<String, Object> batchMessage = Map.of(
                "type", "batch",
                "sessionId", session.getId(),
                "payload", Map.of(
                    "events", events,
                    "count", events.size(),
                    "timestamp", System.currentTimeMillis()
                )
            );
            
            String jsonMessage = objectMapper.writeValueAsString(batchMessage);
            session.sendMessage(new TextMessage(jsonMessage));
            
            logger.debug("Published {} batch events to session: {}", events.size(), session.getId());
            
        } catch (Exception e) {
            logger.error("Failed to publish batch events to session: {}", session.getId(), e);
        }
    }
    
    /**
     * Publish heartbeat/ping event
     */
    public void publishPing(WebSocketSession session) {
        publishEvent(session, "ping", Map.of(
            "timestamp", System.currentTimeMillis()
        ));
    }
    
    /**
     * Publish pong response
     */
    public void publishPong(WebSocketSession session) {
        publishEvent(session, "pong", Map.of(
            "timestamp", System.currentTimeMillis()
        ));
    }
}
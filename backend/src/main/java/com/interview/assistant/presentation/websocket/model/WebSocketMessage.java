package com.interview.assistant.presentation.websocket.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;

/**
 * WebSocket message model for client-server communication
 * 
 * Why: Standardized message format for WebSocket communication
 * Pattern: Data Transfer Object - carries data between processes
 * Rationale: Type-safe WebSocket message handling with validation
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WebSocketMessage {
    
    @JsonProperty("type")
    private MessageType type;
    
    @JsonProperty("sessionId")
    private String sessionId;
    
    @JsonProperty("payload")
    private Object payload;
    
    @JsonProperty("timestamp")
    private Instant timestamp;
    
    @JsonProperty("messageId")
    private String messageId;
    
    @JsonProperty("metadata")
    private Map<String, Object> metadata;
    
    public WebSocketMessage() {
        this.timestamp = Instant.now();
    }
    
    public WebSocketMessage(MessageType type, String sessionId, Object payload) {
        this();
        this.type = type;
        this.sessionId = sessionId;
        this.payload = payload;
    }
    
    public static WebSocketMessage create(MessageType type, String sessionId, Object payload) {
        return new WebSocketMessage(type, sessionId, payload);
    }
    
    public static WebSocketMessage audioData(String sessionId, byte[] audioData) {
        return new WebSocketMessage(MessageType.AUDIO_DATA, sessionId, audioData);
    }
    
    public static WebSocketMessage transcriptPartial(String sessionId, String text, double confidence) {
        TranscriptPayload payload = new TranscriptPayload(text, confidence, false);
        return new WebSocketMessage(MessageType.TRANSCRIPT_PARTIAL, sessionId, payload);
    }
    
    public static WebSocketMessage transcriptFinal(String sessionId, String text, double confidence) {
        TranscriptPayload payload = new TranscriptPayload(text, confidence, true);
        return new WebSocketMessage(MessageType.TRANSCRIPT_FINAL, sessionId, payload);
    }
    
    public static WebSocketMessage assistantDelta(String sessionId, String token) {
        return new WebSocketMessage(MessageType.ASSISTANT_DELTA, sessionId, token);
    }
    
    public static WebSocketMessage assistantDone(String sessionId, String fullResponse) {
        return new WebSocketMessage(MessageType.ASSISTANT_DONE, sessionId, fullResponse);
    }
    
    public static WebSocketMessage error(String sessionId, String errorMessage) {
        ErrorPayload payload = new ErrorPayload(errorMessage, "PROCESSING_ERROR");
        return new WebSocketMessage(MessageType.ERROR, sessionId, payload);
    }
    
    public static WebSocketMessage sessionStart(String sessionId) {
        return new WebSocketMessage(MessageType.SESSION_START, sessionId, null);
    }
    
    public static WebSocketMessage sessionEnd(String sessionId) {
        return new WebSocketMessage(MessageType.SESSION_END, sessionId, null);
    }
    
    // Getters and setters
    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }
    
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }
    
    public Object getPayload() { return payload; }
    public void setPayload(Object payload) { this.payload = payload; }
    
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    
    /**
     * WebSocket message types
     */
    public enum MessageType {
        // Client to server
        AUDIO_DATA,
        SESSION_START,
        SESSION_END,
        HEARTBEAT,
        
        // Server to client
        TRANSCRIPT_PARTIAL,
        TRANSCRIPT_FINAL,
        ASSISTANT_DELTA,
        ASSISTANT_DONE,
        ERROR,
        SESSION_READY,
        
        // Bidirectional
        PING,
        PONG
    }
    
    /**
     * Transcript payload for transcription messages
     */
    public static class TranscriptPayload {
        private String text;
        private double confidence;
        private boolean isFinal;
        private String language;
        
        public TranscriptPayload() {}
        
        public TranscriptPayload(String text, double confidence, boolean isFinal) {
            this.text = text;
            this.confidence = confidence;
            this.isFinal = isFinal;
        }
        
        // Getters and setters
        public String getText() { return text; }
        public void setText(String text) { this.text = text; }
        
        public double getConfidence() { return confidence; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
        
        public boolean isFinal() { return isFinal; }
        public void setFinal(boolean isFinal) { this.isFinal = isFinal; }
        
        public String getLanguage() { return language; }
        public void setLanguage(String language) { this.language = language; }
    }
    
    /**
     * Error payload for error messages
     */
    public static class ErrorPayload {
        private String message;
        private String code;
        private String details;
        
        public ErrorPayload() {}
        
        public ErrorPayload(String message, String code) {
            this.message = message;
            this.code = code;
        }
        
        // Getters and setters
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        
        public String getDetails() { return details; }
        public void setDetails(String details) { this.details = details; }
    }
}
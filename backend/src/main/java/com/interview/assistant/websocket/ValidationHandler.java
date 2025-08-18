package com.interview.assistant.websocket;

import com.interview.assistant.websocket.WebSocketMessage;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Validation handler for WebSocket messages
 * 
 * Why: Ensures message integrity and security before processing
 * Pattern: Chain of Responsibility - validates messages in sequence
 * Rationale: Prevents invalid data from reaching business logic
 */
@Component
public class ValidationHandler {
    
    private static final int MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
    private static final int MAX_SESSION_ID_LENGTH = 36;
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[a-fA-F0-9-]{36}$");
    private static final int MAX_AUDIO_CHUNK_SIZE = 64 * 1024; // 64KB
    
    /**
     * Validate WebSocket message
     * Why: Comprehensive message validation before processing
     * 
     * @param message WebSocket message to validate
     * @return Validation result
     */
    public ValidationResult validate(WebSocketMessage message) {
        if (message == null) {
            return ValidationResult.invalid("Message cannot be null");
        }
        
        // Validate message type
        if (message.getType() == null) {
            return ValidationResult.invalid("Message type is required");
        }
        
        // Validate session ID
        ValidationResult sessionValidation = validateSessionId(message.getSessionId());
        if (!sessionValidation.isValid()) {
            return sessionValidation;
        }
        
        // Validate payload based on message type
        return validatePayload(message);
    }
    
    /**
     * Validate session ID format
     * Why: Ensures session IDs meet security and format requirements
     */
    private ValidationResult validateSessionId(String sessionId) {
        if (sessionId == null || sessionId.trim().isEmpty()) {
            return ValidationResult.invalid("Session ID is required");
        }
        
        if (sessionId.length() > MAX_SESSION_ID_LENGTH) {
            return ValidationResult.invalid("Session ID exceeds maximum length");
        }
        
        if (!SESSION_ID_PATTERN.matcher(sessionId).matches()) {
            return ValidationResult.invalid("Session ID format is invalid");
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Validate message payload based on type
     * Why: Type-specific validation ensures data integrity
     */
    private ValidationResult validatePayload(WebSocketMessage message) {
        switch (message.getType()) {
            case AUDIO_DATA:
                return validateAudioPayload(message.getPayload());
            case SESSION_START:
            case SESSION_END:
                return ValidationResult.valid(); // No payload validation needed
            case TRANSCRIPT_PARTIAL:
            case TRANSCRIPT_FINAL:
                return validateTranscriptPayload(message.getPayload());
            case ASSISTANT_DELTA:
            case ASSISTANT_DONE:
                return validateAssistantPayload(message.getPayload());
            case ERROR:
                return validateErrorPayload(message.getPayload());
            case HEARTBEAT:
            case PING:
            case PONG:
                return ValidationResult.valid();
            default:
                return ValidationResult.invalid("Unknown message type: " + message.getType());
        }
    }
    
    /**
     * Validate audio data payload
     */
    private ValidationResult validateAudioPayload(Object payload) {
        if (payload == null) {
            return ValidationResult.invalid("Audio data payload is required");
        }
        
        if (!(payload instanceof byte[])) {
            return ValidationResult.invalid("Audio data must be byte array");
        }
        
        byte[] audioData = (byte[]) payload;
        if (audioData.length == 0) {
            return ValidationResult.invalid("Audio data cannot be empty");
        }
        
        if (audioData.length > MAX_AUDIO_CHUNK_SIZE) {
            return ValidationResult.invalid("Audio chunk exceeds maximum size");
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Validate transcript payload
     */
    private ValidationResult validateTranscriptPayload(Object payload) {
        if (payload == null) {
            return ValidationResult.invalid("Transcript payload is required");
        }
        
        if (!(payload instanceof WebSocketMessage.TranscriptPayload)) {
            return ValidationResult.invalid("Invalid transcript payload type");
        }
        
        WebSocketMessage.TranscriptPayload transcript = (WebSocketMessage.TranscriptPayload) payload;
        
        if (transcript.getText() == null || transcript.getText().trim().isEmpty()) {
            return ValidationResult.invalid("Transcript text cannot be empty");
        }
        
        if (transcript.getConfidence() < 0.0 || transcript.getConfidence() > 1.0) {
            return ValidationResult.invalid("Confidence must be between 0.0 and 1.0");
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Validate assistant response payload
     */
    private ValidationResult validateAssistantPayload(Object payload) {
        if (payload == null) {
            return ValidationResult.invalid("Assistant payload is required");
        }
        
        if (!(payload instanceof String)) {
            return ValidationResult.invalid("Assistant payload must be string");
        }
        
        String text = (String) payload;
        if (text.length() > 10000) { // Reasonable limit for response chunks
            return ValidationResult.invalid("Assistant response chunk too large");
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Validate error payload
     */
    private ValidationResult validateErrorPayload(Object payload) {
        if (payload == null) {
            return ValidationResult.invalid("Error payload is required");
        }
        
        if (!(payload instanceof WebSocketMessage.ErrorPayload)) {
            return ValidationResult.invalid("Invalid error payload type");
        }
        
        WebSocketMessage.ErrorPayload error = (WebSocketMessage.ErrorPayload) payload;
        
        if (error.getMessage() == null || error.getMessage().trim().isEmpty()) {
            return ValidationResult.invalid("Error message cannot be empty");
        }
        
        if (error.getCode() == null || error.getCode().trim().isEmpty()) {
            return ValidationResult.invalid("Error code cannot be empty");
        }
        
        return ValidationResult.valid();
    }
    
    /**
     * Validate batch of messages
     * Why: Efficient validation of multiple messages
     */
    public BatchValidationResult validateBatch(List<WebSocketMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return new BatchValidationResult(true, List.of());
        }
        
        if (messages.size() > 100) { // Reasonable batch size limit
            return new BatchValidationResult(false, 
                List.of(ValidationResult.invalid("Batch size exceeds maximum limit")));
        }
        
        List<ValidationResult> results = messages.stream()
                .map(this::validate)
                .toList();
        
        boolean allValid = results.stream().allMatch(ValidationResult::isValid);
        
        return new BatchValidationResult(allValid, results);
    }
    
    /**
     * Validation result value object
     */
    public static class ValidationResult {
        private final boolean valid;
        private final String errorMessage;
        
        private ValidationResult(boolean valid, String errorMessage) {
            this.valid = valid;
            this.errorMessage = errorMessage;
        }
        
        public static ValidationResult valid() {
            return new ValidationResult(true, null);
        }
        
        public static ValidationResult invalid(String errorMessage) {
            return new ValidationResult(false, errorMessage);
        }
        
        public boolean isValid() { return valid; }
        public String getErrorMessage() { return errorMessage; }
    }
    
    /**
     * Batch validation result
     */
    public static class BatchValidationResult {
        private final boolean allValid;
        private final List<ValidationResult> results;
        
        public BatchValidationResult(boolean allValid, List<ValidationResult> results) {
            this.allValid = allValid;
            this.results = results;
        }
        
        public boolean isAllValid() { return allValid; }
        public List<ValidationResult> getResults() { return results; }
        
        public List<ValidationResult> getFailures() {
            return results.stream()
                    .filter(result -> !result.isValid())
                    .toList();
        }
    }
}
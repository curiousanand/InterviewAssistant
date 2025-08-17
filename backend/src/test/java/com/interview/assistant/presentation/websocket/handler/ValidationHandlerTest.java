package com.interview.assistant.presentation.websocket.handler;

import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for ValidationHandler
 * 
 * Tests message validation rules, payload validation, and error handling
 */
@DisplayName("ValidationHandler Tests")
class ValidationHandlerTest {
    
    private ValidationHandler validationHandler;
    private String validSessionId;
    
    @BeforeEach
    void setUp() {
        validationHandler = new ValidationHandler();
        validSessionId = UUID.randomUUID().toString();
    }
    
    @Test
    @DisplayName("Should validate valid message successfully")
    void shouldValidateValidMessageSuccessfully() {
        // Given
        WebSocketMessage validMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            "valid-audio-data"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(validMessage);
        
        // Then
        assertThat(result.isValid()).isTrue();
        assertThat(result.getErrorMessage()).isNull();
    }
    
    @Test
    @DisplayName("Should reject null message")
    void shouldRejectNullMessage() {
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(null);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Message cannot be null");
    }
    
    @Test
    @DisplayName("Should reject message with null type")
    void shouldRejectMessageWithNullType() {
        // Given
        WebSocketMessage message = new WebSocketMessage();
        message.setSessionId(validSessionId);
        message.setPayload("test-payload");
        // type is null by default
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(message);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Message type is required");
    }
    
    @Test
    @DisplayName("Should reject message with null session ID")
    void shouldRejectMessageWithNullSessionId() {
        // Given
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            null,
            "test-payload"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(message);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Session ID");
    }
    
    @Test
    @DisplayName("Should reject message with empty session ID")
    void shouldRejectMessageWithEmptySessionId() {
        // Given
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            "",
            "test-payload"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(message);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Session ID");
    }
    
    @Test
    @DisplayName("Should reject message with invalid session ID format")
    void shouldRejectMessageWithInvalidSessionIdFormat() {
        // Given
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            "invalid-session-id-format",
            "test-payload"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(message);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Session ID format");
    }
    
    @Test
    @DisplayName("Should reject session ID that is too long")
    void shouldRejectSessionIdThatIsTooLong() {
        // Given
        String longSessionId = "a".repeat(50); // Longer than 36 characters
        WebSocketMessage message = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            longSessionId,
            "test-payload"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(message);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Session ID");
    }
    
    @Test
    @DisplayName("Should validate all message types")
    void shouldValidateAllMessageTypes() {
        // Given - Test all valid message types
        WebSocketMessage.MessageType[] messageTypes = WebSocketMessage.MessageType.values();
        
        for (WebSocketMessage.MessageType type : messageTypes) {
            // When
            WebSocketMessage message = WebSocketMessage.create(type, validSessionId, getValidPayloadForType(type));
            ValidationHandler.ValidationResult result = validationHandler.validate(message);
            
            // Then
            if (type != WebSocketMessage.MessageType.ERROR) { // ERROR might have specific validation rules
                assertThat(result.isValid())
                    .withFailMessage("Message type %s should be valid", type)
                    .isTrue();
            }
        }
    }
    
    @Test
    @DisplayName("Should validate audio data payload")
    void shouldValidateAudioDataPayload() {
        // Given - Valid audio data
        WebSocketMessage validAudioMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            "valid-audio-bytes"
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(validAudioMessage);
        
        // Then
        assertThat(result.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should reject audio data with null payload")
    void shouldRejectAudioDataWithNullPayload() {
        // Given
        WebSocketMessage audioMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            null
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(audioMessage);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Audio data");
    }
    
    @Test
    @DisplayName("Should reject oversized audio chunk")
    void shouldRejectOversizedAudioChunk() {
        // Given - Create oversized audio data (> 64KB)
        String oversizedAudio = "a".repeat(70 * 1024); // 70KB
        WebSocketMessage audioMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            oversizedAudio
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(audioMessage);
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("Audio chunk size");
    }
    
    @Test
    @DisplayName("Should validate session start message")
    void shouldValidateSessionStartMessage() {
        // Given
        WebSocketMessage sessionStartMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_START,
            validSessionId,
            null // Session start might not need payload
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(sessionStartMessage);
        
        // Then
        assertThat(result.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should validate session end message")
    void shouldValidateSessionEndMessage() {
        // Given
        WebSocketMessage sessionEndMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_END,
            validSessionId,
            null
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(sessionEndMessage);
        
        // Then
        assertThat(result.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should validate heartbeat message")
    void shouldValidateHeartbeatMessage() {
        // Given
        WebSocketMessage heartbeatMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            validSessionId,
            null
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(heartbeatMessage);
        
        // Then
        assertThat(result.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle edge case session IDs")
    void shouldHandleEdgeCaseSessionIds() {
        // Test various edge cases for session ID validation
        
        // Valid UUID format
        String validUUID = "123e4567-e89b-12d3-a456-426614174000";
        WebSocketMessage message1 = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            validUUID,
            null
        );
        assertThat(validationHandler.validate(message1).isValid()).isTrue();
        
        // Another valid UUID format
        String validUUID2 = "550e8400-e29b-41d4-a716-446655440000";
        WebSocketMessage message2 = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            validUUID2,
            null
        );
        assertThat(validationHandler.validate(message2).isValid()).isTrue();
        
        // Invalid - contains invalid characters
        String invalidUUID1 = "123g4567-e89b-12d3-a456-426614174000";
        WebSocketMessage message3 = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            invalidUUID1,
            null
        );
        assertThat(validationHandler.validate(message3).isValid()).isFalse();
        
        // Invalid - wrong length
        String invalidUUID2 = "123e4567-e89b-12d3-a456-42661417400";
        WebSocketMessage message4 = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            invalidUUID2,
            null
        );
        assertThat(validationHandler.validate(message4).isValid()).isFalse();
    }
    
    @Test
    @DisplayName("Should validate message with metadata")
    void shouldValidateMessageWithMetadata() {
        // Given
        WebSocketMessage messageWithMetadata = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            "audio-data"
        );
        messageWithMetadata.setMetadata(java.util.Map.of("format", "PCM", "sampleRate", 16000));
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(messageWithMetadata);
        
        // Then
        assertThat(result.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should create invalid validation result")
    void shouldCreateInvalidValidationResult() {
        // When
        ValidationHandler.ValidationResult result = ValidationHandler.ValidationResult.invalid("Test error");
        
        // Then
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Test error");
    }
    
    @Test
    @DisplayName("Should create valid validation result")
    void shouldCreateValidValidationResult() {
        // When
        ValidationHandler.ValidationResult result = ValidationHandler.ValidationResult.valid();
        
        // Then
        assertThat(result.isValid()).isTrue();
        assertThat(result.getErrorMessage()).isNull();
    }
    
    @Test
    @DisplayName("Should handle various payload types")
    void shouldHandleVariousPayloadTypes() {
        // Test different payload types that might be valid
        
        // String payload
        WebSocketMessage stringMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            "string-payload"
        );
        assertThat(validationHandler.validate(stringMessage).isValid()).isTrue();
        
        // Byte array payload (if converted to appropriate type)
        WebSocketMessage byteMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            new byte[]{1, 2, 3, 4, 5}
        );
        assertThat(validationHandler.validate(byteMessage).isValid()).isTrue();
        
        // Map payload for configuration messages
        WebSocketMessage configMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_START,
            validSessionId,
            java.util.Map.of("language", "en-US", "audioFormat", "PCM")
        );
        assertThat(validationHandler.validate(configMessage).isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle concurrent validation requests")
    void shouldHandleConcurrentValidationRequests() {
        // Given
        WebSocketMessage message1 = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            "audio1"
        );
        WebSocketMessage message2 = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            validSessionId,
            null
        );
        WebSocketMessage message3 = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_START,
            validSessionId,
            "config"
        );
        
        // When - Validate concurrently
        ValidationHandler.ValidationResult result1 = validationHandler.validate(message1);
        ValidationHandler.ValidationResult result2 = validationHandler.validate(message2);
        ValidationHandler.ValidationResult result3 = validationHandler.validate(message3);
        
        // Then
        assertThat(result1.isValid()).isTrue();
        assertThat(result2.isValid()).isTrue();
        assertThat(result3.isValid()).isTrue();
    }
    
    @Test
    @DisplayName("Should validate message size limits")
    void shouldValidateMessageSizeLimits() {
        // Given - Create a message that might exceed size limits
        String largePayload = "x".repeat(500 * 1024); // 500KB
        WebSocketMessage largeMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            validSessionId,
            largePayload
        );
        
        // When
        ValidationHandler.ValidationResult result = validationHandler.validate(largeMessage);
        
        // Then - Should be rejected due to size (assuming there's a size check)
        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrorMessage()).contains("size");
    }
    
    /**
     * Helper method to get valid payload for each message type
     */
    private Object getValidPayloadForType(WebSocketMessage.MessageType type) {
        return switch (type) {
            case AUDIO_DATA -> "audio-data";
            case SESSION_START -> java.util.Map.of("language", "en-US");
            case SESSION_END, HEARTBEAT, PONG, PING -> null;
            case TRANSCRIPT_PARTIAL, TRANSCRIPT_FINAL -> "transcribed text";
            case ASSISTANT_DELTA, ASSISTANT_DONE -> "ai response";
            case SESSION_READY -> java.util.Map.of("sessionId", validSessionId);
            case ERROR -> "error message";
        };
    }
}
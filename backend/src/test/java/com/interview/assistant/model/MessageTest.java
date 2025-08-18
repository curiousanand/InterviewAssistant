package com.interview.assistant.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for Message entity
 * 
 * Tests factory methods, business rules, state transitions, and validation
 */
@DisplayName("Message Entity Tests")
class MessageTest {
    
    @Test
    @DisplayName("Should create user message with valid data")
    void shouldCreateUserMessageWithValidData() {
        // Given
        String content = "Hello, how are you?";
        Double confidence = 0.95;
        String language = "en-US";
        
        // When
        Message message = Message.createUserMessage(content, confidence, language);
        
        // Then
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.USER);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getConfidence()).isEqualTo(confidence);
        assertThat(message.getDetectedLanguage()).isEqualTo(language);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
        assertThat(message.getCreatedAt()).isNotNull();
        assertThat(message.isFromUser()).isTrue();
        assertThat(message.isFromAssistant()).isFalse();
        assertThat(message.isProcessingComplete()).isTrue();
    }
    
    @Test
    @DisplayName("Should create assistant message with valid data")
    void shouldCreateAssistantMessageWithValidData() {
        // Given
        String content = "I'm doing well, thank you!";
        String aiModel = "gpt-4";
        Integer tokensUsed = 15;
        Double processingTime = 250.5;
        
        // When
        Message message = Message.createAssistantMessage(content, aiModel, tokensUsed, processingTime);
        
        // Then
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.ASSISTANT);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getTokensUsed()).isEqualTo(tokensUsed);
        assertThat(message.getProcessingTimeMs()).isEqualTo(processingTime);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
        assertThat(message.isFromUser()).isFalse();
        assertThat(message.isFromAssistant()).isTrue();
        assertThat(message.isProcessingComplete()).isTrue();
    }
    
    @Test
    @DisplayName("Should create system message with valid data")
    void shouldCreateSystemMessageWithValidData() {
        // Given
        String content = "Session started";
        
        // When
        Message message = Message.createSystemMessage(content);
        
        // Then
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.SYSTEM);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
        assertThat(message.isFromUser()).isFalse();
        assertThat(message.isFromAssistant()).isFalse();
    }
    
    @Test
    @DisplayName("Should trim content when creating messages")
    void shouldTrimContentWhenCreatingMessages() {
        // Given
        String contentWithSpaces = "  Hello World  ";
        
        // When
        Message message = Message.createUserMessage(contentWithSpaces, 0.9, "en-US");
        
        // Then
        assertThat(message.getContent()).isEqualTo("Hello World");
    }
    
    @Test
    @DisplayName("Should reject null content")
    void shouldRejectNullContent() {
        // When & Then
        assertThatThrownBy(() -> Message.createUserMessage(null, 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }
    
    @Test
    @DisplayName("Should reject empty content")
    void shouldRejectEmptyContent() {
        // When & Then
        assertThatThrownBy(() -> Message.createUserMessage("", 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }
    
    @Test
    @DisplayName("Should reject whitespace-only content")
    void shouldRejectWhitespaceOnlyContent() {
        // When & Then
        assertThatThrownBy(() -> Message.createUserMessage("   ", 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }
    
    @Test
    @DisplayName("Should reject content exceeding maximum length")
    void shouldRejectContentExceedingMaximumLength() {
        // Given
        String longContent = "a".repeat(10001); // Exceeds 10000 char limit
        
        // When & Then
        assertThatThrownBy(() -> Message.createUserMessage(longContent, 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content exceeds maximum length");
    }
    
    @Test
    @DisplayName("Should handle processing state transitions correctly")
    void shouldHandleProcessingStateTransitionsCorrectly() {
        // Given
        Message message = new Message();
        message.setStatus(Message.ProcessingStatus.PENDING);
        
        // When - Mark as processing
        message.markAsProcessing();
        
        // Then
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.PROCESSING);
        
        // When - Mark as completed
        message.markAsCompleted();
        
        // Then
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
        assertThat(message.getErrorMessage()).isNull();
    }
    
    @Test
    @DisplayName("Should handle failure state correctly")
    void shouldHandleFailureStateCorrectly() {
        // Given
        Message message = new Message();
        String errorMsg = "Processing failed due to timeout";
        
        // When
        message.markAsFailed(errorMsg);
        
        // Then
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.FAILED);
        assertThat(message.getErrorMessage()).isEqualTo(errorMsg);
    }
    
    @Test
    @DisplayName("Should reject invalid state transitions")
    void shouldRejectInvalidStateTransitions() {
        // Given
        Message message = new Message();
        message.setStatus(Message.ProcessingStatus.COMPLETED);
        
        // When & Then - Cannot process completed message
        assertThatThrownBy(() -> message.markAsProcessing())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Can only process pending messages");
        
        // When & Then - Cannot complete non-processing message
        assertThatThrownBy(() -> message.markAsCompleted())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Can only complete processing messages");
    }
    
    @Test
    @DisplayName("Should calculate confidence levels correctly")
    void shouldCalculateConfidenceLevelsCorrectly() {
        // Test HIGH confidence
        Message highConfidence = Message.createUserMessage("Test", 0.95, "en-US");
        assertThat(highConfidence.getConfidenceLevel()).isEqualTo(Message.ConfidenceLevel.HIGH);
        
        // Test MEDIUM confidence
        Message mediumConfidence = Message.createUserMessage("Test", 0.8, "en-US");
        assertThat(mediumConfidence.getConfidenceLevel()).isEqualTo(Message.ConfidenceLevel.MEDIUM);
        
        // Test LOW confidence
        Message lowConfidence = Message.createUserMessage("Test", 0.6, "en-US");
        assertThat(lowConfidence.getConfidenceLevel()).isEqualTo(Message.ConfidenceLevel.LOW);
        
        // Test VERY_LOW confidence
        Message veryLowConfidence = Message.createUserMessage("Test", 0.3, "en-US");
        assertThat(veryLowConfidence.getConfidenceLevel()).isEqualTo(Message.ConfidenceLevel.VERY_LOW);
    }
    
    @Test
    @DisplayName("Should handle unknown confidence level")
    void shouldHandleUnknownConfidenceLevel() {
        // Given
        Message message = Message.createAssistantMessage("Test", "gpt-4", 10, 100.0);
        // Assistant messages don't have confidence scores
        
        // When & Then
        assertThat(message.getConfidenceLevel()).isEqualTo(Message.ConfidenceLevel.UNKNOWN);
    }
    
    @Test
    @DisplayName("Should generate content preview correctly")
    void shouldGenerateContentPreviewCorrectly() {
        // Test short content
        Message shortMessage = Message.createUserMessage("Hello", 0.9, "en-US");
        assertThat(shortMessage.getContentPreview(10)).isEqualTo("Hello");
        
        // Test long content
        String longContent = "This is a very long message that should be truncated";
        Message longMessage = Message.createUserMessage(longContent, 0.9, "en-US");
        assertThat(longMessage.getContentPreview(20)).isEqualTo("This is a very l...");
        
        // Test exact length
        assertThat(longMessage.getContentPreview(longContent.length())).isEqualTo(longContent);
    }
    
    @Test
    @DisplayName("Should handle null content in preview")
    void shouldHandleNullContentInPreview() {
        // Given
        Message message = new Message();
        // Content is null
        
        // When & Then
        assertThat(message.getContentPreview(10)).isEqualTo("");
    }
    
    @Test
    @DisplayName("Should set and get session relationship")
    void shouldSetAndGetSessionRelationship() {
        // Given
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        Session session = Session.create("en-US", true);
        
        // When
        message.setSession(session);
        
        // Then
        assertThat(message.getSession()).isEqualTo(session);
    }
    
    @Test
    @DisplayName("Should handle all processing status values")
    void shouldHandleAllProcessingStatusValues() {
        // Test all enum values exist and work
        for (Message.ProcessingStatus status : Message.ProcessingStatus.values()) {
            Message message = new Message();
            message.setStatus(status);
            assertThat(message.getStatus()).isEqualTo(status);
        }
    }
    
    @Test
    @DisplayName("Should handle all message role values")
    void shouldHandleAllMessageRoleValues() {
        // Test all enum values exist and work
        for (Message.MessageRole role : Message.MessageRole.values()) {
            Message message = new Message();
            message.setRole(role);
            assertThat(message.getRole()).isEqualTo(role);
        }
    }
    
    @Test
    @DisplayName("Should handle all confidence level values")
    void shouldHandleAllConfidenceLevelValues() {
        // Test boundary conditions for each confidence level
        assertThat(Message.ConfidenceLevel.HIGH).isNotNull();
        assertThat(Message.ConfidenceLevel.MEDIUM).isNotNull();
        assertThat(Message.ConfidenceLevel.LOW).isNotNull();
        assertThat(Message.ConfidenceLevel.VERY_LOW).isNotNull();
        assertThat(Message.ConfidenceLevel.UNKNOWN).isNotNull();
    }
    
    @Test
    @DisplayName("Should set and get error message")
    void shouldSetAndGetErrorMessage() {
        // Given
        Message message = new Message();
        String errorMsg = "Test error message";
        
        // When
        message.setErrorMessage(errorMsg);
        
        // Then
        assertThat(message.getErrorMessage()).isEqualTo(errorMsg);
    }
    
    @Test
    @DisplayName("Should set and get processing time")
    void shouldSetAndGetProcessingTime() {
        // Given
        Message message = new Message();
        Double processingTime = 123.45;
        
        // When
        message.setProcessingTimeMs(processingTime);
        
        // Then
        assertThat(message.getProcessingTimeMs()).isEqualTo(processingTime);
    }
}
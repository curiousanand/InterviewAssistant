package com.interview.assistant.domain.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.assertj.core.api.Assertions.*;

class MessageTest {

    @Test
    void shouldCreateUserMessageWithValidContent() {
        String content = "Hello, this is a test message";
        Double confidence = 0.95;
        String language = "en-US";
        
        Message message = Message.createUserMessage(content, confidence, language);
        
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.USER);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getConfidence()).isEqualTo(confidence);
        assertThat(message.getDetectedLanguage()).isEqualTo(language);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldCreateAssistantMessageWithValidContent() {
        String content = "Hello! How can I help you today?";
        String aiModel = "gpt-4";
        Integer tokensUsed = 150;
        Double processingTime = 1200.5;
        
        Message message = Message.createAssistantMessage(content, aiModel, tokensUsed, processingTime);
        
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.ASSISTANT);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getAiModel()).isEqualTo(aiModel);
        assertThat(message.getTokensUsed()).isEqualTo(tokensUsed);
        assertThat(message.getProcessingTimeMs()).isEqualTo(processingTime);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldCreateSystemMessageWithValidContent() {
        String content = "Conversation started";
        
        Message message = Message.createSystemMessage(content);
        
        assertThat(message.getId()).isNotNull();
        assertThat(message.getRole()).isEqualTo(Message.MessageRole.SYSTEM);
        assertThat(message.getContent()).isEqualTo(content);
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldThrowExceptionForNullContent() {
        assertThatThrownBy(() -> Message.createUserMessage(null, 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForEmptyContent() {
        assertThatThrownBy(() -> Message.createUserMessage("", 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForContentTooLong() {
        String longContent = "a".repeat(10001);
        
        assertThatThrownBy(() -> Message.createUserMessage(longContent, 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content exceeds maximum length");
    }

    @Test
    void shouldTrimContentWhitespace() {
        String content = "  Hello World  ";
        
        Message message = Message.createUserMessage(content, 0.9, "en-US");
        
        assertThat(message.getContent()).isEqualTo("Hello World");
    }

    @Test
    void shouldMarkMessageAsProcessing() {
        Message message = Message.builder()
            .id("test-id")
            .role(Message.MessageRole.USER)
            .content("test")
            .status(Message.ProcessingStatus.PENDING)
            .build();
        
        message.markAsProcessing();
        
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.PROCESSING);
    }

    @Test
    void shouldThrowExceptionWhenMarkingNonPendingAsProcessing() {
        Message message = Message.builder()
            .id("test-id")
            .role(Message.MessageRole.USER)
            .content("test")
            .status(Message.ProcessingStatus.COMPLETED)
            .build();
        
        assertThatThrownBy(() -> message.markAsProcessing())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Can only process pending messages");
    }

    @Test
    void shouldMarkMessageAsCompleted() {
        Message message = Message.builder()
            .id("test-id")
            .role(Message.MessageRole.USER)
            .content("test")
            .status(Message.ProcessingStatus.PROCESSING)
            .build();
        
        message.markAsCompleted();
        
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.COMPLETED);
        assertThat(message.getErrorMessage()).isNull();
    }

    @Test
    void shouldMarkMessageAsFailed() {
        Message message = Message.builder()
            .id("test-id")
            .role(Message.MessageRole.USER)
            .content("test")
            .status(Message.ProcessingStatus.PROCESSING)
            .build();
        
        String errorMessage = "Processing failed";
        message.markAsFailed(errorMessage);
        
        assertThat(message.getStatus()).isEqualTo(Message.ProcessingStatus.FAILED);
        assertThat(message.getErrorMessage()).isEqualTo(errorMessage);
    }

    @Test
    void shouldReturnTrueForUserMessage() {
        Message message = Message.createUserMessage("test", 0.9, "en-US");
        
        assertThat(message.isFromUser()).isTrue();
        assertThat(message.isFromAssistant()).isFalse();
    }

    @Test
    void shouldReturnTrueForAssistantMessage() {
        Message message = Message.createAssistantMessage("test", "gpt-4", 100, 1000.0);
        
        assertThat(message.isFromUser()).isFalse();
        assertThat(message.isFromAssistant()).isTrue();
    }

    @Test
    void shouldGetContentPreview() {
        String longContent = "This is a very long message that should be truncated for preview purposes";
        Message message = Message.createUserMessage(longContent, 0.9, "en-US");
        
        String preview = message.getContentPreview(20);
        
        assertThat(preview).hasSize(20);
        assertThat(preview).endsWith("...");
    }

    @Test
    void shouldReturnFullContentForShortPreview() {
        String shortContent = "Short message";
        Message message = Message.createUserMessage(shortContent, 0.9, "en-US");
        
        String preview = message.getContentPreview(50);
        
        assertThat(preview).isEqualTo(shortContent);
    }

    @Test
    void shouldGetCorrectConfidenceLevel() {
        assertThat(Message.createUserMessage("test", 0.95, "en-US").getConfidenceLevel())
            .isEqualTo(Message.ConfidenceLevel.HIGH);
        
        assertThat(Message.createUserMessage("test", 0.8, "en-US").getConfidenceLevel())
            .isEqualTo(Message.ConfidenceLevel.MEDIUM);
        
        assertThat(Message.createUserMessage("test", 0.6, "en-US").getConfidenceLevel())
            .isEqualTo(Message.ConfidenceLevel.LOW);
        
        assertThat(Message.createUserMessage("test", 0.3, "en-US").getConfidenceLevel())
            .isEqualTo(Message.ConfidenceLevel.VERY_LOW);
        
        assertThat(Message.createUserMessage("test", null, "en-US").getConfidenceLevel())
            .isEqualTo(Message.ConfidenceLevel.UNKNOWN);
    }
}
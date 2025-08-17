package com.interview.assistant.domain.aggregate;

import com.interview.assistant.domain.entity.Session;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.assertj.core.api.Assertions.*;

class ConversationTest {

    private Conversation conversation;

    @BeforeEach
    void setUp() {
        conversation = Conversation.create("en-US", true);
    }

    @Test
    void shouldCreateNewConversation() {
        Conversation newConversation = Conversation.create("en-US", true);
        
        assertThat(newConversation.getSession()).isNotNull();
        assertThat(newConversation.getMessages()).isEmpty();
        assertThat(newConversation.getContext()).isNotNull();
        assertThat(newConversation.getSession().getStatus()).isEqualTo(Session.SessionStatus.ACTIVE);
    }

    @Test
    void shouldRestoreConversationFromSession() {
        Session existingSession = Session.create("fr-FR", false);
        
        Conversation restoredConversation = Conversation.restore(existingSession);
        
        assertThat(restoredConversation.getSession()).isEqualTo(existingSession);
        assertThat(restoredConversation.getMessages()).isNotNull();
        assertThat(restoredConversation.getContext()).isNotNull();
    }

    @Test
    void shouldAddUserMessage() {
        String content = "Hello, how are you?";
        Double confidence = 0.95;
        String language = "en-US";
        
        conversation.addUserMessage(content, confidence, language);
        
        assertThat(conversation.getMessages()).hasSize(1);
        assertThat(conversation.getMessages().get(0).getContent()).isEqualTo(content);
        assertThat(conversation.getMessages().get(0).getConfidence()).isEqualTo(confidence);
        assertThat(conversation.getMessages().get(0).isFromUser()).isTrue();
    }

    @Test
    void shouldAddAssistantResponse() {
        String content = "I'm doing well, thank you!";
        String aiModel = "gpt-4";
        Integer tokensUsed = 120;
        Double processingTime = 1500.0;
        
        conversation.addAssistantResponse(content, aiModel, tokensUsed, processingTime);
        
        assertThat(conversation.getMessages()).hasSize(1);
        assertThat(conversation.getMessages().get(0).getContent()).isEqualTo(content);
        assertThat(conversation.getMessages().get(0).getAiModel()).isEqualTo(aiModel);
        assertThat(conversation.getMessages().get(0).isFromAssistant()).isTrue();
    }

    @Test
    void shouldThrowExceptionForNullUserMessage() {
        assertThatThrownBy(() -> conversation.addUserMessage(null, 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForEmptyUserMessage() {
        assertThatThrownBy(() -> conversation.addUserMessage("", 0.9, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Message content cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForInvalidConfidence() {
        assertThatThrownBy(() -> conversation.addUserMessage("test", 1.5, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence must be between 0.0 and 1.0");
        
        assertThatThrownBy(() -> conversation.addUserMessage("test", -0.1, "en-US"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Confidence must be between 0.0 and 1.0");
    }

    @Test
    void shouldGetFormattedContext() {
        conversation.addUserMessage("Hello", 0.9, "en-US");
        conversation.addAssistantResponse("Hi there!", "gpt-4", 50, 800.0);
        
        String context = conversation.getFormattedContext();
        
        assertThat(context).isNotEmpty();
        assertThat(context).contains("Hello");
        assertThat(context).contains("Hi there!");
    }

    @Test
    void shouldDetectNeedForSummarization() {
        // Add many messages to trigger summarization need
        for (int i = 0; i < 35; i++) {
            conversation.addUserMessage("Message " + i, 0.9, "en-US");
            conversation.addAssistantResponse("Response " + i, "gpt-4", 100, 1000.0);
        }
        
        assertThat(conversation.needsSummarization()).isTrue();
    }

    @Test
    void shouldNotNeedSummarizationForFewMessages() {
        conversation.addUserMessage("Hello", 0.9, "en-US");
        conversation.addAssistantResponse("Hi", "gpt-4", 50, 800.0);
        
        assertThat(conversation.needsSummarization()).isFalse();
    }

    @Test
    void shouldApplySummary() {
        // Add some messages first
        for (int i = 0; i < 5; i++) {
            conversation.addUserMessage("Message " + i, 0.9, "en-US");
            conversation.addAssistantResponse("Response " + i, "gpt-4", 100, 1000.0);
        }
        
        String summary = "The user and assistant discussed various topics.";
        conversation.applySummary(summary);
        
        assertThat(conversation.getContext().getSummary()).isEqualTo(summary);
        assertThat(conversation.getContext().getLastSummarizedAt()).isNotNull();
    }

    @Test
    void shouldThrowExceptionForNullSummary() {
        assertThatThrownBy(() -> conversation.applySummary(null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Summary cannot be null or empty");
    }

    @Test
    void shouldCloseConversation() {
        conversation.close();
        
        assertThat(conversation.getSession().getStatus()).isEqualTo(Session.SessionStatus.CLOSED);
        assertThat(conversation.getContext().isClosed()).isTrue();
    }

    @Test
    void shouldGenerateConversationStatistics() {
        conversation.addUserMessage("Hello", 0.9, "en-US");
        conversation.addUserMessage("How are you?", 0.85, "en-US");
        conversation.addAssistantResponse("I'm good!", "gpt-4", 80, 1200.0);
        conversation.addAssistantResponse("Thanks for asking!", "gpt-4", 90, 1100.0);
        
        Conversation.ConversationStatistics stats = conversation.getStatistics();
        
        assertThat(stats.getTotalMessages()).isEqualTo(4);
        assertThat(stats.getUserMessages()).isEqualTo(2);
        assertThat(stats.getAssistantMessages()).isEqualTo(2);
        assertThat(stats.getAverageConfidence()).isEqualTo(0.875); // (0.9 + 0.85) / 2
        assertThat(stats.getAverageProcessingTime()).isEqualTo(1150.0); // (1200 + 1100) / 2
    }

    @Test
    void shouldIdentifyLowConfidenceMessages() {
        conversation.addUserMessage("Hello", 0.9, "en-US");
        conversation.addUserMessage("Unclear speech", 0.2, "en-US"); // Low confidence
        conversation.addAssistantResponse("I'm good!", "gpt-4", 80, 1200.0);
        
        var lowConfidenceMessages = conversation.getLowConfidenceMessages();
        
        assertThat(lowConfidenceMessages).hasSize(1);
        assertThat(lowConfidenceMessages.get(0).getContent()).isEqualTo("Unclear speech");
    }

    @Test
    void shouldReturnTrueForActiveConversation() {
        assertThat(conversation.isActive()).isTrue();
    }

    @Test
    void shouldReturnFalseForClosedConversation() {
        conversation.close();
        
        assertThat(conversation.isActive()).isFalse();
    }

    @Test
    void shouldHandleNullConfidenceGracefully() {
        conversation.addUserMessage("Test message", null, "en-US");
        
        assertThat(conversation.getMessages()).hasSize(1);
        assertThat(conversation.getMessages().get(0).getConfidence()).isNull();
    }

    @Test
    void shouldMaintainMessageOrder() {
        conversation.addUserMessage("First message", 0.9, "en-US");
        conversation.addAssistantResponse("First response", "gpt-4", 80, 1000.0);
        conversation.addUserMessage("Second message", 0.85, "en-US");
        conversation.addAssistantResponse("Second response", "gpt-4", 90, 1100.0);
        
        var messages = conversation.getMessages();
        assertThat(messages).hasSize(4);
        assertThat(messages.get(0).getContent()).isEqualTo("First message");
        assertThat(messages.get(1).getContent()).isEqualTo("First response");
        assertThat(messages.get(2).getContent()).isEqualTo("Second message");
        assertThat(messages.get(3).getContent()).isEqualTo("Second response");
    }
}
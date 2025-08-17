package com.interview.assistant.domain.valueobject;

import com.interview.assistant.domain.entity.Message;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

/**
 * Test suite for ConversationContext value object
 * 
 * Tests conversation context management, summarization, and analysis
 * Rationale: Ensures conversation state is properly maintained for AI processing
 */
class ConversationContextTest {

    @Test
    void shouldCreateEmptyContext() {
        ConversationContext context = ConversationContext.create();
        
        assertThat(context.getSummary()).isEmpty();
        assertThat(context.getTotalTokens()).isZero();
        assertThat(context.getMessageCount()).isZero();
        assertThat(context.getPrimaryLanguage()).isEqualTo("en-US");
        assertThat(context.getLanguageFrequency()).isEmpty();
        assertThat(context.getTopics()).isEmpty();
        assertThat(context.isClosed()).isFalse();
    }

    @Test
    void shouldCreateContextFromMessages() {
        List<Message> messages = new ArrayList<>();
        
        // Create test messages
        Message userMessage = Message.createUserMessage("Hello, I need help with programming", 0.9, "en-US");
        Message assistantMessage = Message.createAssistantMessage("I'd be happy to help you with programming!", "gpt-4", 150, 1200.0);
        
        messages.add(userMessage);
        messages.add(assistantMessage);
        
        ConversationContext context = ConversationContext.fromMessages(messages);
        
        assertThat(context.getMessageCount()).isEqualTo(2);
        assertThat(context.getTotalTokens()).isEqualTo(150);
        assertThat(context.getPrimaryLanguage()).isEqualTo("en-us");
        assertThat(context.getTopics()).contains("technology");
    }

    @Test
    void shouldAddUserInputCorrectly() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("I'm looking for a good restaurant", "en-US");
        
        assertThat(context.getMessageCount()).isEqualTo(1);
        assertThat(context.getPrimaryLanguage()).isEqualTo("en-us");
        assertThat(context.getLanguageFrequency()).containsEntry("en-us", 1);
        assertThat(context.getTopics()).contains("food");
    }

    @Test
    void shouldAddAssistantResponseCorrectly() {
        ConversationContext context = ConversationContext.create();
        
        context.addAssistantResponse("Here are some great business opportunities", 200);
        
        assertThat(context.getMessageCount()).isEqualTo(1);
        assertThat(context.getTotalTokens()).isEqualTo(200);
        assertThat(context.getTopics()).contains("business");
    }

    @Test
    void shouldUpdateLanguageFrequencyAndPrimaryLanguage() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("Hello", "en-US");
        context.addUserInput("Bonjour", "fr-FR");
        context.addUserInput("Hi again", "en-US");
        
        assertThat(context.getLanguageFrequency()).containsEntry("en-us", 2);
        assertThat(context.getLanguageFrequency()).containsEntry("fr-fr", 1);
        assertThat(context.getPrimaryLanguage()).isEqualTo("en-us");
    }

    @Test
    void shouldExtractTopicsFromContent() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("I'm learning machine learning and AI programming", "en-US");
        context.addUserInput("I need help with my business marketing strategy", "en-US");
        context.addUserInput("What's the best university for computer science education?", "en-US");
        
        assertThat(context.getTopics()).contains("technology", "business", "education");
    }

    @Test
    void shouldLimitTopicsToMaximum() {
        ConversationContext context = ConversationContext.create();
        
        // Add content that would generate many topics
        context.addUserInput("technology software programming business education health travel sports entertainment food", "en-US");
        context.addUserInput("more topics to test the limit of topic extraction", "en-US");
        
        assertThat(context.getTopics()).hasSizeLessThanOrEqualTo(10);
    }

    @Test
    void shouldApplySummaryCorrectly() {
        ConversationContext context = ConversationContext.create();
        context.addAssistantResponse("Previous content", 1000);
        
        String summary = "User discussed programming help and received assistance";
        context.applySummary(summary);
        
        assertThat(context.getSummary()).isEqualTo(summary);
        assertThat(context.getLastSummarizedAt()).isNotNull();
        assertThat(context.getTotalTokens()).isEqualTo(summary.length() / 4); // Rough token estimation
    }

    @Test
    void shouldDetectNeedForSummarization() {
        ConversationContext context = ConversationContext.create();
        
        // Test token-based summarization trigger
        ConversationContext tokenContext = ConversationContext.create();
        tokenContext.addAssistantResponse("content", 9000);
        assertThat(tokenContext.needsSummarization()).isTrue();
        
        // Test message count-based summarization trigger
        ConversationContext messageContext = ConversationContext.create();
        for (int i = 0; i < 35; i++) {
            messageContext.addUserInput("message " + i, "en-US");
        }
        assertThat(messageContext.needsSummarization()).isTrue();
        
        // Test normal context doesn't need summarization
        assertThat(context.needsSummarization()).isFalse();
    }

    @Test
    void shouldGenerateFormattedContext() {
        ConversationContext context = ConversationContext.create();
        context.addUserInput("Technology discussion", "en-US");
        context.applySummary("User asked about programming");
        
        String formatted = context.getFormattedContext();
        
        assertThat(formatted).contains("Conversation Summary: User asked about programming");
        assertThat(formatted).contains("Primary Language: en-us");
        assertThat(formatted).contains("Message Count: 1");
        assertThat(formatted).contains("Topics Discussed: technology");
    }

    @Test
    void shouldGenerateFormattedContextWithoutSummary() {
        ConversationContext context = ConversationContext.create();
        context.addUserInput("Simple message", "en-US");
        
        String formatted = context.getFormattedContext();
        
        assertThat(formatted).doesNotContain("Conversation Summary:");
        assertThat(formatted).contains("Context Information:");
        assertThat(formatted).contains("Primary Language: en-us");
    }

    @Test
    void shouldMarkAsClosedCorrectly() {
        ConversationContext context = ConversationContext.create();
        
        assertThat(context.isClosed()).isFalse();
        
        context.markAsClosed();
        
        assertThat(context.isClosed()).isTrue();
    }

    @Test
    void shouldCalculateQualityScore() {
        ConversationContext context = ConversationContext.create();
        
        // Add multiple messages for better score
        for (int i = 0; i < 10; i++) {
            context.addUserInput("message " + i, "en-US");
        }
        
        // Add topics
        context.addUserInput("technology business education", "en-US");
        
        // Add summary
        context.applySummary("Good conversation summary");
        
        double score = context.getQualityScore();
        
        assertThat(score).isBetween(0.0, 1.0);
        assertThat(score).isGreaterThan(0.5); // Should be decent with multiple factors
    }

    @Test
    void shouldCalculateQualityScoreForEmptyContext() {
        ConversationContext context = ConversationContext.create();
        
        double score = context.getQualityScore();
        
        assertThat(score).isEqualTo(0.0);
    }

    @Test
    void shouldEstimateContextLength() {
        ConversationContext context = ConversationContext.create();
        context.applySummary("This is a summary of the conversation");
        
        int estimatedLength = context.getEstimatedLength();
        
        assertThat(estimatedLength).isGreaterThan(200); // Summary + metadata overhead
        assertThat(estimatedLength).isLessThan(1000); // Reasonable upper bound
    }

    @Test
    void shouldEstimateContextLengthWithoutSummary() {
        ConversationContext context = ConversationContext.create();
        
        int estimatedLength = context.getEstimatedLength();
        
        assertThat(estimatedLength).isEqualTo(200); // Just metadata overhead
    }

    @Test
    void shouldHandleNullLanguageGracefully() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("Hello", null);
        
        assertThat(context.getMessageCount()).isEqualTo(1);
        assertThat(context.getLanguageFrequency()).isEmpty();
        assertThat(context.getPrimaryLanguage()).isEqualTo("en-US"); // Should remain default
    }

    @Test
    void shouldHandleNullTokensGracefully() {
        ConversationContext context = ConversationContext.create();
        
        context.addAssistantResponse("Response", null);
        
        assertThat(context.getMessageCount()).isEqualTo(1);
        assertThat(context.getTotalTokens()).isZero();
    }

    @Test
    void shouldExtractMultipleTopicsFromSingleMessage() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("I'm studying computer programming at university for my business degree", "en-US");
        
        assertThat(context.getTopics()).containsAnyOf("technology", "education", "business");
    }

    @Test
    void shouldNotDuplicateTopics() {
        ConversationContext context = ConversationContext.create();
        
        context.addUserInput("technology and programming", "en-US");
        context.addUserInput("more technology discussion", "en-US");
        
        long technologyCount = context.getTopics().stream()
            .filter(topic -> topic.equals("technology"))
            .count();
        
        assertThat(technologyCount).isEqualTo(1);
    }

    @Test
    void shouldUpdateBuilderProperties() {
        ConversationContext context = ConversationContext.builder()
            .summary("Custom summary")
            .totalTokens(500)
            .messageCount(5)
            .primaryLanguage("fr-FR")
            .build();
        
        assertThat(context.getSummary()).isEqualTo("Custom summary");
        assertThat(context.getTotalTokens()).isEqualTo(500);
        assertThat(context.getMessageCount()).isEqualTo(5);
        assertThat(context.getPrimaryLanguage()).isEqualTo("fr-FR");
    }
}
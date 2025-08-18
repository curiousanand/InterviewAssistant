package com.interview.assistant.repository;

import com.interview.assistant.model.Message;
import com.interview.assistant.model.Session;
import com.interview.assistant.repository.IMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for MessageRepositoryImpl
 * 
 * Tests all repository operations, filtering, aggregation, and business logic
 */
@DisplayName("MessageRepository Implementation Tests")
class MessageRepositoryImplTest {
    
    private IMessageRepository repository;
    private Session testSession;
    
    @BeforeEach
    void setUp() {
        repository = new MessageRepositoryImpl();
        testSession = Session.create("en-US", true);
        testSession.setId("test-session-id");
    }
    
    @Test
    @DisplayName("Should save and retrieve message")
    void shouldSaveAndRetrieveMessage() {
        // Given
        Message message = Message.createUserMessage("Hello", 0.9, "en-US");
        message.setSession(testSession);
        
        // When
        Message savedMessage = repository.save(message);
        
        // Then
        assertThat(savedMessage.getId()).isNotNull();
        
        // Verify retrieval
        Optional<Message> retrieved = repository.findById(savedMessage.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getId()).isEqualTo(savedMessage.getId());
        assertThat(retrieved.get().getContent()).isEqualTo("Hello");
    }
    
    @Test
    @DisplayName("Should generate ID for new message")
    void shouldGenerateIdForNewMessage() {
        // Given
        Message message = Message.createUserMessage("Test", 0.8, "en-US");
        message.setSession(testSession);
        String originalId = message.getId();
        message.setId(null); // Remove ID to test generation
        
        // When
        Message savedMessage = repository.save(message);
        
        // Then
        assertThat(savedMessage.getId()).isNotNull();
        assertThat(savedMessage.getId()).isNotEqualTo(originalId);
    }
    
    @Test
    @DisplayName("Should save message asynchronously")
    void shouldSaveMessageAsynchronously() {
        // Given
        Message message = Message.createUserMessage("Async test", 0.95, "es-ES");
        message.setSession(testSession);
        
        // When
        CompletableFuture<Message> future = repository.saveAsync(message);
        
        // Then
        assertThat(future).succeedsWithin(java.time.Duration.ofSeconds(1));
        Message savedMessage = future.join();
        assertThat(savedMessage.getId()).isNotNull();
        assertThat(savedMessage.getContent()).isEqualTo("Async test");
    }
    
    @Test
    @DisplayName("Should return empty optional for non-existent message")
    void shouldReturnEmptyOptionalForNonExistentMessage() {
        // When
        Optional<Message> result = repository.findById("non-existent-id");
        
        // Then
        assertThat(result).isEmpty();
    }
    
    @Test
    @DisplayName("Should find messages by session ID")
    void shouldFindMessagesBySessionId() {
        // Given
        Message message1 = Message.createUserMessage("Hello", 0.9, "en-US");
        Message message2 = Message.createAssistantMessage("Hi there", "gpt-4", 10, 100.0);
        Message message3 = Message.createSystemMessage("Session started");
        
        message1.setSession(testSession);
        message2.setSession(testSession);
        message3.setSession(testSession);
        
        // Create another session with a message
        Session otherSession = Session.create("fr-FR", false);
        otherSession.setId("other-session-id");
        Message otherMessage = Message.createUserMessage("Bonjour", 0.8, "fr-FR");
        otherMessage.setSession(otherSession);
        
        repository.save(message1);
        repository.save(message2);
        repository.save(message3);
        repository.save(otherMessage);
        
        // When
        List<Message> sessionMessages = repository.findBySessionId(testSession.getId());
        
        // Then
        assertThat(sessionMessages).hasSize(3);
        assertThat(sessionMessages).extracting(Message::getContent)
            .containsExactly("Hello", "Hi there", "Session started");
    }
    
    @Test
    @DisplayName("Should find messages by session ID with pagination")
    void shouldFindMessagesBySessionIdWithPagination() {
        // Given
        for (int i = 0; i < 5; i++) {
            Message message = Message.createUserMessage("Message " + i, 0.9, "en-US");
            message.setSession(testSession);
            repository.save(message);
        }
        
        Pageable pageable = PageRequest.of(0, 3);
        
        // When
        Page<Message> page = repository.findBySessionId(testSession.getId(), pageable);
        
        // Then
        assertThat(page.getContent()).hasSize(3);
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(2);
    }
    
    @Test
    @DisplayName("Should find recent messages by session ID")
    void shouldFindRecentMessagesBySessionId() {
        // Given
        for (int i = 0; i < 5; i++) {
            Message message = Message.createUserMessage("Message " + i, 0.9, "en-US");
            message.setSession(testSession);
            message.setCreatedAt(Instant.now().minusSeconds(i * 10)); // Different times
            repository.save(message);
        }
        
        // When
        List<Message> recentMessages = repository.findRecentMessagesBySessionId(testSession.getId(), 3);
        
        // Then
        assertThat(recentMessages).hasSize(3);
        // Should be in reverse chronological order (most recent first)
        assertThat(recentMessages.get(0).getContent()).isEqualTo("Message 0");
        assertThat(recentMessages.get(1).getContent()).isEqualTo("Message 1");
        assertThat(recentMessages.get(2).getContent()).isEqualTo("Message 2");
    }
    
    @Test
    @DisplayName("Should find messages by session ID and role")
    void shouldFindMessagesBySessionIdAndRole() {
        // Given
        Message userMessage1 = Message.createUserMessage("User 1", 0.9, "en-US");
        Message userMessage2 = Message.createUserMessage("User 2", 0.8, "en-US");
        Message assistantMessage = Message.createAssistantMessage("Assistant", "gpt-4", 15, 200.0);
        Message systemMessage = Message.createSystemMessage("System");
        
        userMessage1.setSession(testSession);
        userMessage2.setSession(testSession);
        assistantMessage.setSession(testSession);
        systemMessage.setSession(testSession);
        
        repository.save(userMessage1);
        repository.save(userMessage2);
        repository.save(assistantMessage);
        repository.save(systemMessage);
        
        // When
        List<Message> userMessages = repository.findBySessionIdAndRole(testSession.getId(), Message.MessageRole.USER);
        List<Message> assistantMessages = repository.findBySessionIdAndRole(testSession.getId(), Message.MessageRole.ASSISTANT);
        
        // Then
        assertThat(userMessages).hasSize(2);
        assertThat(assistantMessages).hasSize(1);
        assertThat(userMessages).allMatch(msg -> msg.getRole() == Message.MessageRole.USER);
        assertThat(assistantMessages).allMatch(msg -> msg.getRole() == Message.MessageRole.ASSISTANT);
    }
    
    @Test
    @DisplayName("Should find messages by session ID and status")
    void shouldFindMessagesBySessionIdAndStatus() {
        // Given
        Message completedMessage1 = Message.createUserMessage("Completed 1", 0.9, "en-US");
        Message completedMessage2 = Message.createUserMessage("Completed 2", 0.8, "en-US");
        Message pendingMessage = new Message();
        pendingMessage.setContent("Pending");
        pendingMessage.setStatus(Message.ProcessingStatus.PENDING);
        pendingMessage.setSession(testSession);
        
        completedMessage1.setSession(testSession);
        completedMessage2.setSession(testSession);
        
        repository.save(completedMessage1);
        repository.save(completedMessage2);
        repository.save(pendingMessage);
        
        // When
        List<Message> completedMessages = repository.findBySessionIdAndStatus(testSession.getId(), Message.ProcessingStatus.COMPLETED);
        List<Message> pendingMessages = repository.findBySessionIdAndStatus(testSession.getId(), Message.ProcessingStatus.PENDING);
        
        // Then
        assertThat(completedMessages).hasSize(2);
        assertThat(pendingMessages).hasSize(1);
        assertThat(completedMessages).allMatch(msg -> msg.getStatus() == Message.ProcessingStatus.COMPLETED);
        assertThat(pendingMessages).allMatch(msg -> msg.getStatus() == Message.ProcessingStatus.PENDING);
    }
    
    @Test
    @DisplayName("Should find low confidence user messages")
    void shouldFindLowConfidenceUserMessages() {
        // Given
        Message highConfidence = Message.createUserMessage("High", 0.9, "en-US");
        Message mediumConfidence = Message.createUserMessage("Medium", 0.7, "en-US");
        Message lowConfidence = Message.createUserMessage("Low", 0.4, "en-US");
        Message assistantMessage = Message.createAssistantMessage("Assistant", "gpt-4", 10, 100.0);
        
        highConfidence.setSession(testSession);
        mediumConfidence.setSession(testSession);
        lowConfidence.setSession(testSession);
        assistantMessage.setSession(testSession);
        
        repository.save(highConfidence);
        repository.save(mediumConfidence);
        repository.save(lowConfidence);
        repository.save(assistantMessage);
        
        // When
        List<Message> lowConfidenceMessages = repository.findLowConfidenceUserMessages(testSession.getId(), 0.6);
        
        // Then
        assertThat(lowConfidenceMessages).hasSize(1);
        assertThat(lowConfidenceMessages.get(0).getContent()).isEqualTo("Low");
        assertThat(lowConfidenceMessages.get(0).getConfidence()).isEqualTo(0.4);
    }
    
    @Test
    @DisplayName("Should find messages by session ID and time range")
    void shouldFindMessagesBySessionIdAndTimeRange() {
        // Given
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);
        Instant twoHoursAgo = now.minusSeconds(7200);
        
        Message oldMessage = Message.createUserMessage("Old", 0.9, "en-US");
        oldMessage.setCreatedAt(twoHoursAgo.minusSeconds(100)); // Before range
        oldMessage.setSession(testSession);
        
        Message inRangeMessage = Message.createUserMessage("In range", 0.8, "en-US");
        inRangeMessage.setCreatedAt(oneHourAgo.plusSeconds(100)); // In range
        inRangeMessage.setSession(testSession);
        
        Message futureMessage = Message.createUserMessage("Future", 0.7, "en-US");
        futureMessage.setCreatedAt(now.plusSeconds(100)); // After range
        futureMessage.setSession(testSession);
        
        repository.save(oldMessage);
        repository.save(inRangeMessage);
        repository.save(futureMessage);
        
        // When
        List<Message> messagesInRange = repository.findBySessionIdAndCreatedAtBetween(testSession.getId(), oneHourAgo, now);
        
        // Then
        assertThat(messagesInRange).hasSize(1);
        assertThat(messagesInRange.get(0).getContent()).isEqualTo("In range");
    }
    
    @Test
    @DisplayName("Should find messages by session ID and detected language")
    void shouldFindMessagesBySessionIdAndDetectedLanguage() {
        // Given
        Message englishMessage = Message.createUserMessage("Hello", 0.9, "en-US");
        Message spanishMessage = Message.createUserMessage("Hola", 0.8, "es-ES");
        Message frenchMessage = Message.createUserMessage("Bonjour", 0.7, "fr-FR");
        
        englishMessage.setSession(testSession);
        spanishMessage.setSession(testSession);
        frenchMessage.setSession(testSession);
        
        repository.save(englishMessage);
        repository.save(spanishMessage);
        repository.save(frenchMessage);
        
        // When
        List<Message> englishMessages = repository.findBySessionIdAndDetectedLanguage(testSession.getId(), "en-US");
        List<Message> spanishMessages = repository.findBySessionIdAndDetectedLanguage(testSession.getId(), "es-ES");
        
        // Then
        assertThat(englishMessages).hasSize(1);
        assertThat(spanishMessages).hasSize(1);
        assertThat(englishMessages.get(0).getContent()).isEqualTo("Hello");
        assertThat(spanishMessages.get(0).getContent()).isEqualTo("Hola");
    }
    
    @Test
    @DisplayName("Should find failed messages by session ID")
    void shouldFindFailedMessagesBySessionId() {
        // Given
        Message completedMessage = Message.createUserMessage("Completed", 0.9, "en-US");
        Message failedMessage = new Message();
        failedMessage.setContent("Failed");
        failedMessage.setStatus(Message.ProcessingStatus.FAILED);
        failedMessage.setSession(testSession);
        
        completedMessage.setSession(testSession);
        
        repository.save(completedMessage);
        repository.save(failedMessage);
        
        // When
        List<Message> failedMessages = repository.findFailedMessagesBySessionId(testSession.getId());
        
        // Then
        assertThat(failedMessages).hasSize(1);
        assertThat(failedMessages.get(0).getContent()).isEqualTo("Failed");
        assertThat(failedMessages.get(0).getStatus()).isEqualTo(Message.ProcessingStatus.FAILED);
    }
    
    @Test
    @DisplayName("Should count messages by session ID")
    void shouldCountMessagesBySessionId() {
        // Given
        for (int i = 0; i < 3; i++) {
            Message message = Message.createUserMessage("Message " + i, 0.9, "en-US");
            message.setSession(testSession);
            repository.save(message);
        }
        
        // When
        long count = repository.countBySessionId(testSession.getId());
        
        // Then
        assertThat(count).isEqualTo(3);
    }
    
    @Test
    @DisplayName("Should count messages by session ID and role")
    void shouldCountMessagesBySessionIdAndRole() {
        // Given
        Message userMessage1 = Message.createUserMessage("User 1", 0.9, "en-US");
        Message userMessage2 = Message.createUserMessage("User 2", 0.8, "en-US");
        Message assistantMessage = Message.createAssistantMessage("Assistant", "gpt-4", 10, 100.0);
        
        userMessage1.setSession(testSession);
        userMessage2.setSession(testSession);
        assistantMessage.setSession(testSession);
        
        repository.save(userMessage1);
        repository.save(userMessage2);
        repository.save(assistantMessage);
        
        // When
        long userCount = repository.countBySessionIdAndRole(testSession.getId(), Message.MessageRole.USER);
        long assistantCount = repository.countBySessionIdAndRole(testSession.getId(), Message.MessageRole.ASSISTANT);
        
        // Then
        assertThat(userCount).isEqualTo(2);
        assertThat(assistantCount).isEqualTo(1);
    }
    
    @Test
    @DisplayName("Should count messages by session ID and status")
    void shouldCountMessagesBySessionIdAndStatus() {
        // Given
        Message completedMessage1 = Message.createUserMessage("Completed 1", 0.9, "en-US");
        Message completedMessage2 = Message.createUserMessage("Completed 2", 0.8, "en-US");
        Message failedMessage = new Message();
        failedMessage.setContent("Failed");
        failedMessage.setStatus(Message.ProcessingStatus.FAILED);
        failedMessage.setSession(testSession);
        
        completedMessage1.setSession(testSession);
        completedMessage2.setSession(testSession);
        
        repository.save(completedMessage1);
        repository.save(completedMessage2);
        repository.save(failedMessage);
        
        // When
        long completedCount = repository.countBySessionIdAndStatus(testSession.getId(), Message.ProcessingStatus.COMPLETED);
        long failedCount = repository.countBySessionIdAndStatus(testSession.getId(), Message.ProcessingStatus.FAILED);
        
        // Then
        assertThat(completedCount).isEqualTo(2);
        assertThat(failedCount).isEqualTo(1);
    }
    
    @Test
    @DisplayName("Should calculate total tokens by session ID")
    void shouldCalculateTotalTokensBySessionId() {
        // Given
        Message assistantMessage1 = Message.createAssistantMessage("Response 1", "gpt-4", 10, 100.0);
        Message assistantMessage2 = Message.createAssistantMessage("Response 2", "gpt-4", 15, 150.0);
        Message userMessage = Message.createUserMessage("Question", 0.9, "en-US"); // No tokens
        
        assistantMessage1.setSession(testSession);
        assistantMessage2.setSession(testSession);
        userMessage.setSession(testSession);
        
        repository.save(assistantMessage1);
        repository.save(assistantMessage2);
        repository.save(userMessage);
        
        // When
        long totalTokens = repository.getTotalTokensBySessionId(testSession.getId());
        
        // Then
        assertThat(totalTokens).isEqualTo(25); // 10 + 15
    }
    
    @Test
    @DisplayName("Should calculate average confidence by session ID")
    void shouldCalculateAverageConfidenceBySessionId() {
        // Given
        Message userMessage1 = Message.createUserMessage("High", 0.9, "en-US");
        Message userMessage2 = Message.createUserMessage("Medium", 0.7, "en-US");
        Message assistantMessage = Message.createAssistantMessage("Assistant", "gpt-4", 10, 100.0); // No confidence
        
        userMessage1.setSession(testSession);
        userMessage2.setSession(testSession);
        assistantMessage.setSession(testSession);
        
        repository.save(userMessage1);
        repository.save(userMessage2);
        repository.save(assistantMessage);
        
        // When
        double averageConfidence = repository.getAverageConfidenceBySessionId(testSession.getId());
        
        // Then
        assertThat(averageConfidence).isEqualTo(0.8); // (0.9 + 0.7) / 2
    }
    
    @Test
    @DisplayName("Should calculate average processing time by session ID")
    void shouldCalculateAverageProcessingTimeBySessionId() {
        // Given
        Message assistantMessage1 = Message.createAssistantMessage("Response 1", "gpt-4", 10, 100.0);
        Message assistantMessage2 = Message.createAssistantMessage("Response 2", "gpt-4", 15, 200.0);
        Message userMessage = Message.createUserMessage("Question", 0.9, "en-US"); // No processing time
        
        assistantMessage1.setSession(testSession);
        assistantMessage2.setSession(testSession);
        userMessage.setSession(testSession);
        
        repository.save(assistantMessage1);
        repository.save(assistantMessage2);
        repository.save(userMessage);
        
        // When
        double averageProcessingTime = repository.getAverageProcessingTimeBySessionId(testSession.getId());
        
        // Then
        assertThat(averageProcessingTime).isEqualTo(150.0); // (100.0 + 200.0) / 2
    }
    
    @Test
    @DisplayName("Should update message status")
    void shouldUpdateMessageStatus() {
        // Given
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        message.setSession(testSession);
        Message savedMessage = repository.save(message);
        
        // When
        int updated = repository.updateMessageStatus(savedMessage.getId(), Message.ProcessingStatus.PROCESSING);
        
        // Then
        assertThat(updated).isEqualTo(1);
        
        Optional<Message> retrieved = repository.findById(savedMessage.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getStatus()).isEqualTo(Message.ProcessingStatus.PROCESSING);
    }
    
    @Test
    @DisplayName("Should update message error")
    void shouldUpdateMessageError() {
        // Given
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        message.setSession(testSession);
        Message savedMessage = repository.save(message);
        String errorMessage = "Processing failed";
        
        // When
        int updated = repository.updateMessageError(savedMessage.getId(), Message.ProcessingStatus.FAILED, errorMessage);
        
        // Then
        assertThat(updated).isEqualTo(1);
        
        Optional<Message> retrieved = repository.findById(savedMessage.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getStatus()).isEqualTo(Message.ProcessingStatus.FAILED);
        assertThat(retrieved.get().getErrorMessage()).isEqualTo(errorMessage);
    }
    
    @Test
    @DisplayName("Should bulk update message statuses")
    void shouldBulkUpdateMessageStatuses() {
        // Given
        Message message1 = Message.createUserMessage("Test 1", 0.9, "en-US");
        Message message2 = Message.createUserMessage("Test 2", 0.8, "en-US");
        message1.setSession(testSession);
        message2.setSession(testSession);
        
        Message savedMessage1 = repository.save(message1);
        Message savedMessage2 = repository.save(message2);
        
        List<String> messageIds = List.of(savedMessage1.getId(), savedMessage2.getId());
        
        // When
        int updated = repository.bulkUpdateMessageStatus(messageIds, Message.ProcessingStatus.PROCESSING);
        
        // Then
        assertThat(updated).isEqualTo(2);
        
        // Verify both messages were updated
        Optional<Message> retrieved1 = repository.findById(savedMessage1.getId());
        Optional<Message> retrieved2 = repository.findById(savedMessage2.getId());
        
        assertThat(retrieved1.get().getStatus()).isEqualTo(Message.ProcessingStatus.PROCESSING);
        assertThat(retrieved2.get().getStatus()).isEqualTo(Message.ProcessingStatus.PROCESSING);
    }
    
    @Test
    @DisplayName("Should delete message by ID")
    void shouldDeleteMessageById() {
        // Given
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        message.setSession(testSession);
        Message savedMessage = repository.save(message);
        
        // When
        boolean deleted = repository.deleteById(savedMessage.getId());
        
        // Then
        assertThat(deleted).isTrue();
        assertThat(repository.findById(savedMessage.getId())).isEmpty();
    }
    
    @Test
    @DisplayName("Should return false when deleting non-existent message")
    void shouldReturnFalseWhenDeletingNonExistentMessage() {
        // When
        boolean deleted = repository.deleteById("non-existent-id");
        
        // Then
        assertThat(deleted).isFalse();
    }
    
    @Test
    @DisplayName("Should delete messages by session ID")
    void shouldDeleteMessagesBySessionId() {
        // Given
        Message message1 = Message.createUserMessage("Test 1", 0.9, "en-US");
        Message message2 = Message.createUserMessage("Test 2", 0.8, "en-US");
        message1.setSession(testSession);
        message2.setSession(testSession);
        
        // Create message in different session
        Session otherSession = Session.create("fr-FR", false);
        otherSession.setId("other-session");
        Message otherMessage = Message.createUserMessage("Other", 0.7, "fr-FR");
        otherMessage.setSession(otherSession);
        
        repository.save(message1);
        repository.save(message2);
        repository.save(otherMessage);
        
        // When
        int deletedCount = repository.deleteBySessionId(testSession.getId());
        
        // Then
        assertThat(deletedCount).isEqualTo(2);
        assertThat(repository.countBySessionId(testSession.getId())).isEqualTo(0);
        assertThat(repository.countBySessionId(otherSession.getId())).isEqualTo(1);
    }
    
    @Test
    @DisplayName("Should delete old messages by session ID")
    void shouldDeleteOldMessagesBySessionId() {
        // Given
        Instant cutoffTime = Instant.now().minusSeconds(3600); // 1 hour ago
        
        Message recentMessage = Message.createUserMessage("Recent", 0.9, "en-US");
        recentMessage.setCreatedAt(Instant.now());
        recentMessage.setSession(testSession);
        
        Message oldMessage = Message.createUserMessage("Old", 0.8, "en-US");
        oldMessage.setCreatedAt(cutoffTime.minusSeconds(100)); // Before cutoff
        oldMessage.setSession(testSession);
        
        repository.save(recentMessage);
        repository.save(oldMessage);
        
        // When
        int deletedCount = repository.deleteOldMessagesBySessionId(testSession.getId(), cutoffTime);
        
        // Then
        assertThat(deletedCount).isEqualTo(1);
        assertThat(repository.countBySessionId(testSession.getId())).isEqualTo(1);
        
        List<Message> remainingMessages = repository.findBySessionId(testSession.getId());
        assertThat(remainingMessages.get(0).getContent()).isEqualTo("Recent");
    }
    
    @Test
    @DisplayName("Should delete failed messages by session ID")
    void shouldDeleteFailedMessagesBySessionId() {
        // Given
        Message completedMessage = Message.createUserMessage("Completed", 0.9, "en-US");
        completedMessage.setSession(testSession);
        
        Message failedMessage = new Message();
        failedMessage.setContent("Failed");
        failedMessage.setStatus(Message.ProcessingStatus.FAILED);
        failedMessage.setSession(testSession);
        
        repository.save(completedMessage);
        repository.save(failedMessage);
        
        // When
        int deletedCount = repository.deleteFailedMessagesBySessionId(testSession.getId());
        
        // Then
        assertThat(deletedCount).isEqualTo(1);
        assertThat(repository.countBySessionId(testSession.getId())).isEqualTo(1);
        
        List<Message> remainingMessages = repository.findBySessionId(testSession.getId());
        assertThat(remainingMessages.get(0).getContent()).isEqualTo("Completed");
    }
    
    @Test
    @DisplayName("Should check if message exists")
    void shouldCheckIfMessageExists() {
        // Given
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        message.setSession(testSession);
        Message savedMessage = repository.save(message);
        
        // When & Then
        assertThat(repository.existsById(savedMessage.getId())).isTrue();
        assertThat(repository.existsById("non-existent-id")).isFalse();
    }
    
    @Test
    @DisplayName("Should get conversation for export")
    void shouldGetConversationForExport() {
        // Given
        Message message1 = Message.createUserMessage("Question", 0.9, "en-US");
        Message message2 = Message.createAssistantMessage("Answer", "gpt-4", 10, 100.0);
        message1.setSession(testSession);
        message2.setSession(testSession);
        
        repository.save(message1);
        repository.save(message2);
        
        // When
        List<Message> conversation = repository.getConversationForExport(testSession.getId());
        
        // Then
        assertThat(conversation).hasSize(2);
        assertThat(conversation).extracting(Message::getContent)
            .containsExactly("Question", "Answer");
    }
    
    @Test
    @DisplayName("Should get message statistics")
    void shouldGetMessageStatistics() {
        // Given
        Message userMessage = Message.createUserMessage("Question", 0.8, "en-US");
        Message assistantMessage = Message.createAssistantMessage("Answer", "gpt-4", 20, 150.0);
        Message systemMessage = Message.createSystemMessage("System");
        Message failedMessage = new Message();
        failedMessage.setContent("Failed");
        failedMessage.setStatus(Message.ProcessingStatus.FAILED);
        failedMessage.setSession(testSession);
        
        userMessage.setSession(testSession);
        assistantMessage.setSession(testSession);
        systemMessage.setSession(testSession);
        
        repository.save(userMessage);
        repository.save(assistantMessage);
        repository.save(systemMessage);
        repository.save(failedMessage);
        
        // When
        IMessageRepository.MessageRepositoryStats stats = repository.getMessageStats(testSession.getId());
        
        // Then
        assertThat(stats.getTotalMessages()).isEqualTo(4);
        assertThat(stats.getUserMessages()).isEqualTo(1);
        assertThat(stats.getAssistantMessages()).isEqualTo(1);
        assertThat(stats.getSystemMessages()).isEqualTo(1);
        assertThat(stats.getCompletedMessages()).isEqualTo(3);
        assertThat(stats.getFailedMessages()).isEqualTo(1);
        assertThat(stats.getAverageConfidence()).isEqualTo(0.8);
        assertThat(stats.getAverageProcessingTime()).isEqualTo(150.0);
        assertThat(stats.getTotalTokensUsed()).isEqualTo(20);
        assertThat(stats.getPrimaryLanguage()).isEqualTo("en-US");
    }
    
    @Test
    @DisplayName("Should get primary language from statistics")
    void shouldGetPrimaryLanguageFromStatistics() {
        // Given
        Message englishMessage1 = Message.createUserMessage("Hello", 0.9, "en-US");
        Message englishMessage2 = Message.createUserMessage("Hi", 0.8, "en-US");
        Message spanishMessage = Message.createUserMessage("Hola", 0.7, "es-ES");
        
        englishMessage1.setSession(testSession);
        englishMessage2.setSession(testSession);
        spanishMessage.setSession(testSession);
        
        repository.save(englishMessage1);
        repository.save(englishMessage2);
        repository.save(spanishMessage);
        
        // When
        IMessageRepository.MessageRepositoryStats stats = repository.getMessageStats(testSession.getId());
        
        // Then
        assertThat(stats.getPrimaryLanguage()).isEqualTo("en-US"); // Most frequent language
    }
    
    @Test
    @DisplayName("Should handle empty session for statistics")
    void shouldHandleEmptySessionForStatistics() {
        // Given - no messages in session
        
        // When
        IMessageRepository.MessageRepositoryStats stats = repository.getMessageStats(testSession.getId());
        
        // Then
        assertThat(stats.getTotalMessages()).isEqualTo(0);
        assertThat(stats.getUserMessages()).isEqualTo(0);
        assertThat(stats.getAssistantMessages()).isEqualTo(0);
        assertThat(stats.getSystemMessages()).isEqualTo(0);
        assertThat(stats.getAverageConfidence()).isEqualTo(0.0);
        assertThat(stats.getAverageProcessingTime()).isEqualTo(0.0);
        assertThat(stats.getTotalTokensUsed()).isEqualTo(0);
        assertThat(stats.getPrimaryLanguage()).isEqualTo("unknown");
    }
    
    @Test
    @DisplayName("Should save all messages in batch")
    void shouldSaveAllMessagesInBatch() {
        // Given
        Message message1 = Message.createUserMessage("Test 1", 0.9, "en-US");
        Message message2 = Message.createUserMessage("Test 2", 0.8, "en-US");
        Message message3 = Message.createAssistantMessage("Response", "gpt-4", 15, 120.0);
        
        message1.setSession(testSession);
        message2.setSession(testSession);
        message3.setSession(testSession);
        
        List<Message> messages = List.of(message1, message2, message3);
        
        // When
        List<Message> savedMessages = repository.saveAll(messages);
        
        // Then
        assertThat(savedMessages).hasSize(3);
        assertThat(savedMessages).allMatch(message -> message.getId() != null);
        
        // Verify all messages can be retrieved
        for (Message savedMessage : savedMessages) {
            assertThat(repository.findById(savedMessage.getId())).isPresent();
        }
    }
    
    @Test
    @DisplayName("Should handle non-existent message ID in updates")
    void shouldHandleNonExistentMessageIdInUpdates() {
        // When & Then
        assertThat(repository.updateMessageStatus("non-existent", Message.ProcessingStatus.FAILED)).isEqualTo(0);
        assertThat(repository.updateMessageError("non-existent", Message.ProcessingStatus.FAILED, "Error")).isEqualTo(0);
    }
    
    @Test
    @DisplayName("Should handle empty lists in bulk operations")
    void shouldHandleEmptyListsInBulkOperations() {
        // When & Then
        assertThat(repository.bulkUpdateMessageStatus(List.of(), Message.ProcessingStatus.FAILED)).isEqualTo(0);
        assertThat(repository.saveAll(List.of())).isEmpty();
    }
    
    @Test
    @DisplayName("Should return zero for statistics on non-existent session")
    void shouldReturnZeroForStatisticsOnNonExistentSession() {
        // When
        IMessageRepository.MessageRepositoryStats stats = repository.getMessageStats("non-existent-session");
        
        // Then
        assertThat(stats.getTotalMessages()).isEqualTo(0);
        assertThat(stats.getUserMessages()).isEqualTo(0);
        assertThat(stats.getAssistantMessages()).isEqualTo(0);
        assertThat(stats.getPrimaryLanguage()).isEqualTo("unknown");
    }
}
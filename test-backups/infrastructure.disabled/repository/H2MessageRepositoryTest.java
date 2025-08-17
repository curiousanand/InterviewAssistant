package com.interview.assistant.infrastructure.repository;

import com.interview.assistant.domain.entity.Message;
import com.interview.assistant.domain.entity.Session;
import com.interview.assistant.domain.repository.IMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for H2MessageRepository
 * 
 * Tests message repository operations, queries, and statistics
 * Rationale: Ensures message persistence layer works correctly with proper data integrity
 */
@ExtendWith(MockitoExtension.class)
class H2MessageRepositoryTest {

    @Mock
    private H2MessageRepository.MessageJpaRepository jpaRepository;

    private H2MessageRepository messageRepository;
    private Message testMessage;
    private Session testSession;

    @BeforeEach
    void setUp() {
        messageRepository = new H2MessageRepository(jpaRepository);
        
        testSession = Session.builder()
            .id("test-session-id")
            .status(Session.SessionStatus.ACTIVE)
            .build();
        
        testMessage = Message.builder()
            .id("test-message-id")
            .session(testSession)
            .role(Message.MessageRole.USER)
            .content("Test message content")
            .confidence(0.95)
            .detectedLanguage("en-US")
            .status(Message.ProcessingStatus.COMPLETED)
            .createdAt(Instant.now())
            .build();
    }

    @Test
    void shouldSaveMessageSuccessfully() {
        when(jpaRepository.save(testMessage)).thenReturn(testMessage);

        Message savedMessage = messageRepository.save(testMessage);

        assertThat(savedMessage).isEqualTo(testMessage);
        verify(jpaRepository).save(testMessage);
    }

    @Test
    void shouldSaveMessageAsynchronously() throws Exception {
        when(jpaRepository.save(testMessage)).thenReturn(testMessage);

        CompletableFuture<Message> future = messageRepository.saveAsync(testMessage);
        Message savedMessage = future.get();

        assertThat(savedMessage).isEqualTo(testMessage);
        verify(jpaRepository).save(testMessage);
    }

    @Test
    void shouldFindMessageById() {
        when(jpaRepository.findById("test-message-id")).thenReturn(Optional.of(testMessage));

        Optional<Message> foundMessage = messageRepository.findById("test-message-id");

        assertThat(foundMessage).isPresent();
        assertThat(foundMessage.get()).isEqualTo(testMessage);
        verify(jpaRepository).findById("test-message-id");
    }

    @Test
    void shouldReturnEmptyWhenMessageNotFound() {
        when(jpaRepository.findById("non-existent")).thenReturn(Optional.empty());

        Optional<Message> foundMessage = messageRepository.findById("non-existent");

        assertThat(foundMessage).isEmpty();
        verify(jpaRepository).findById("non-existent");
    }

    @Test
    void shouldFindMessagesBySessionId() {
        List<Message> messages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdOrderByCreatedAtAsc("test-session-id")).thenReturn(messages);

        List<Message> result = messageRepository.findBySessionId("test-session-id");

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdOrderByCreatedAtAsc("test-session-id");
    }

    @Test
    void shouldFindMessagesBySessionIdWithPagination() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Message> messagePage = new PageImpl<>(Arrays.asList(testMessage));
        when(jpaRepository.findBySession_Id("test-session-id", pageable)).thenReturn(messagePage);

        Page<Message> result = messageRepository.findBySessionId("test-session-id", pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_Id("test-session-id", pageable);
    }

    @Test
    void shouldFindRecentMessagesBySessionId() {
        List<Message> recentMessages = Arrays.asList(testMessage);
        when(jpaRepository.findRecentMessagesBySessionId(eq("test-session-id"), any(Pageable.class)))
            .thenReturn(recentMessages);

        List<Message> result = messageRepository.findRecentMessagesBySessionId("test-session-id", 5);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findRecentMessagesBySessionId(eq("test-session-id"), any(Pageable.class));
    }

    @Test
    void shouldFindMessagesBySessionIdAndRole() {
        List<Message> userMessages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndRoleOrderByCreatedAtAsc("test-session-id", Message.MessageRole.USER))
            .thenReturn(userMessages);

        List<Message> result = messageRepository.findBySessionIdAndRole("test-session-id", Message.MessageRole.USER);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndRoleOrderByCreatedAtAsc("test-session-id", Message.MessageRole.USER);
    }

    @Test
    void shouldFindMessagesBySessionIdAndStatus() {
        List<Message> completedMessages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndStatusOrderByCreatedAtAsc("test-session-id", Message.ProcessingStatus.COMPLETED))
            .thenReturn(completedMessages);

        List<Message> result = messageRepository.findBySessionIdAndStatus("test-session-id", Message.ProcessingStatus.COMPLETED);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndStatusOrderByCreatedAtAsc("test-session-id", Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldFindLowConfidenceUserMessages() {
        List<Message> lowConfidenceMessages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndRoleAndConfidenceLessThan("test-session-id", Message.MessageRole.USER, 0.5))
            .thenReturn(lowConfidenceMessages);

        List<Message> result = messageRepository.findLowConfidenceUserMessages("test-session-id", 0.5);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndRoleAndConfidenceLessThan("test-session-id", Message.MessageRole.USER, 0.5);
    }

    @Test
    void shouldFindMessagesBySessionIdAndCreatedAtBetween() {
        Instant startTime = Instant.now().minusSeconds(3600);
        Instant endTime = Instant.now();
        List<Message> messages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndCreatedAtBetweenOrderByCreatedAtAsc("test-session-id", startTime, endTime))
            .thenReturn(messages);

        List<Message> result = messageRepository.findBySessionIdAndCreatedAtBetween("test-session-id", startTime, endTime);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndCreatedAtBetweenOrderByCreatedAtAsc("test-session-id", startTime, endTime);
    }

    @Test
    void shouldFindMessagesBySessionIdAndDetectedLanguage() {
        List<Message> languageMessages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndDetectedLanguageOrderByCreatedAtAsc("test-session-id", "en-US"))
            .thenReturn(languageMessages);

        List<Message> result = messageRepository.findBySessionIdAndDetectedLanguage("test-session-id", "en-US");

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndDetectedLanguageOrderByCreatedAtAsc("test-session-id", "en-US");
    }

    @Test
    void shouldFindFailedMessagesBySessionId() {
        List<Message> failedMessages = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdAndStatusOrderByCreatedAtAsc("test-session-id", Message.ProcessingStatus.FAILED))
            .thenReturn(failedMessages);

        List<Message> result = messageRepository.findFailedMessagesBySessionId("test-session-id");

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdAndStatusOrderByCreatedAtAsc("test-session-id", Message.ProcessingStatus.FAILED);
    }

    @Test
    void shouldCountMessagesBySessionId() {
        when(jpaRepository.countBySession_Id("test-session-id")).thenReturn(5L);

        long count = messageRepository.countBySessionId("test-session-id");

        assertThat(count).isEqualTo(5L);
        verify(jpaRepository).countBySession_Id("test-session-id");
    }

    @Test
    void shouldCountMessagesBySessionIdAndRole() {
        when(jpaRepository.countBySession_IdAndRole("test-session-id", Message.MessageRole.USER)).thenReturn(3L);

        long count = messageRepository.countBySessionIdAndRole("test-session-id", Message.MessageRole.USER);

        assertThat(count).isEqualTo(3L);
        verify(jpaRepository).countBySession_IdAndRole("test-session-id", Message.MessageRole.USER);
    }

    @Test
    void shouldCountMessagesBySessionIdAndStatus() {
        when(jpaRepository.countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.COMPLETED)).thenReturn(4L);

        long count = messageRepository.countBySessionIdAndStatus("test-session-id", Message.ProcessingStatus.COMPLETED);

        assertThat(count).isEqualTo(4L);
        verify(jpaRepository).countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldGetTotalTokensBySessionId() {
        when(jpaRepository.getTotalTokensBySessionId("test-session-id")).thenReturn(1500L);

        long totalTokens = messageRepository.getTotalTokensBySessionId("test-session-id");

        assertThat(totalTokens).isEqualTo(1500L);
        verify(jpaRepository).getTotalTokensBySessionId("test-session-id");
    }

    @Test
    void shouldReturnZeroTokensWhenNull() {
        when(jpaRepository.getTotalTokensBySessionId("test-session-id")).thenReturn(null);

        long totalTokens = messageRepository.getTotalTokensBySessionId("test-session-id");

        assertThat(totalTokens).isEqualTo(0L);
        verify(jpaRepository).getTotalTokensBySessionId("test-session-id");
    }

    @Test
    void shouldGetAverageConfidenceBySessionId() {
        when(jpaRepository.getAverageConfidenceBySessionId("test-session-id")).thenReturn(0.85);

        double avgConfidence = messageRepository.getAverageConfidenceBySessionId("test-session-id");

        assertThat(avgConfidence).isEqualTo(0.85);
        verify(jpaRepository).getAverageConfidenceBySessionId("test-session-id");
    }

    @Test
    void shouldReturnZeroConfidenceWhenNull() {
        when(jpaRepository.getAverageConfidenceBySessionId("test-session-id")).thenReturn(null);

        double avgConfidence = messageRepository.getAverageConfidenceBySessionId("test-session-id");

        assertThat(avgConfidence).isEqualTo(0.0);
        verify(jpaRepository).getAverageConfidenceBySessionId("test-session-id");
    }

    @Test
    void shouldGetAverageProcessingTimeBySessionId() {
        when(jpaRepository.getAverageProcessingTimeBySessionId("test-session-id")).thenReturn(1250.0);

        double avgProcessingTime = messageRepository.getAverageProcessingTimeBySessionId("test-session-id");

        assertThat(avgProcessingTime).isEqualTo(1250.0);
        verify(jpaRepository).getAverageProcessingTimeBySessionId("test-session-id");
    }

    @Test
    void shouldReturnZeroProcessingTimeWhenNull() {
        when(jpaRepository.getAverageProcessingTimeBySessionId("test-session-id")).thenReturn(null);

        double avgProcessingTime = messageRepository.getAverageProcessingTimeBySessionId("test-session-id");

        assertThat(avgProcessingTime).isEqualTo(0.0);
        verify(jpaRepository).getAverageProcessingTimeBySessionId("test-session-id");
    }

    @Test
    void shouldUpdateMessageStatus() {
        when(jpaRepository.updateMessageStatus("test-message-id", Message.ProcessingStatus.COMPLETED)).thenReturn(1);

        int updateCount = messageRepository.updateMessageStatus("test-message-id", Message.ProcessingStatus.COMPLETED);

        assertThat(updateCount).isEqualTo(1);
        verify(jpaRepository).updateMessageStatus("test-message-id", Message.ProcessingStatus.COMPLETED);
    }

    @Test
    void shouldUpdateMessageError() {
        String errorMessage = "Processing failed";
        when(jpaRepository.updateMessageError("test-message-id", Message.ProcessingStatus.FAILED, errorMessage)).thenReturn(1);

        int updateCount = messageRepository.updateMessageError("test-message-id", Message.ProcessingStatus.FAILED, errorMessage);

        assertThat(updateCount).isEqualTo(1);
        verify(jpaRepository).updateMessageError("test-message-id", Message.ProcessingStatus.FAILED, errorMessage);
    }

    @Test
    void shouldBulkUpdateMessageStatus() {
        List<String> messageIds = Arrays.asList("msg1", "msg2", "msg3");
        when(jpaRepository.bulkUpdateMessageStatus(messageIds, Message.ProcessingStatus.FAILED)).thenReturn(3);

        int updateCount = messageRepository.bulkUpdateMessageStatus(messageIds, Message.ProcessingStatus.FAILED);

        assertThat(updateCount).isEqualTo(3);
        verify(jpaRepository).bulkUpdateMessageStatus(messageIds, Message.ProcessingStatus.FAILED);
    }

    @Test
    void shouldDeleteMessageByIdWhenExists() {
        when(jpaRepository.existsById("test-message-id")).thenReturn(true);

        boolean deleted = messageRepository.deleteById("test-message-id");

        assertThat(deleted).isTrue();
        verify(jpaRepository).existsById("test-message-id");
        verify(jpaRepository).deleteById("test-message-id");
    }

    @Test
    void shouldNotDeleteMessageByIdWhenNotExists() {
        when(jpaRepository.existsById("non-existent")).thenReturn(false);

        boolean deleted = messageRepository.deleteById("non-existent");

        assertThat(deleted).isFalse();
        verify(jpaRepository).existsById("non-existent");
        verify(jpaRepository, never()).deleteById("non-existent");
    }

    @Test
    void shouldDeleteMessagesBySessionId() {
        when(jpaRepository.deleteBySession_Id("test-session-id")).thenReturn(5);

        int deleteCount = messageRepository.deleteBySessionId("test-session-id");

        assertThat(deleteCount).isEqualTo(5);
        verify(jpaRepository).deleteBySession_Id("test-session-id");
    }

    @Test
    void shouldDeleteOldMessagesBySessionId() {
        Instant cutoffTime = Instant.now().minusSeconds(86400);
        when(jpaRepository.deleteOldMessagesBySessionId("test-session-id", cutoffTime)).thenReturn(3);

        int deleteCount = messageRepository.deleteOldMessagesBySessionId("test-session-id", cutoffTime);

        assertThat(deleteCount).isEqualTo(3);
        verify(jpaRepository).deleteOldMessagesBySessionId("test-session-id", cutoffTime);
    }

    @Test
    void shouldDeleteFailedMessagesBySessionId() {
        when(jpaRepository.deleteBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.FAILED)).thenReturn(2);

        int deleteCount = messageRepository.deleteFailedMessagesBySessionId("test-session-id");

        assertThat(deleteCount).isEqualTo(2);
        verify(jpaRepository).deleteBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.FAILED);
    }

    @Test
    void shouldCheckIfMessageExists() {
        when(jpaRepository.existsById("test-message-id")).thenReturn(true);

        boolean exists = messageRepository.existsById("test-message-id");

        assertThat(exists).isTrue();
        verify(jpaRepository).existsById("test-message-id");
    }

    @Test
    void shouldGetConversationForExport() {
        List<Message> conversation = Arrays.asList(testMessage);
        when(jpaRepository.findBySession_IdOrderByCreatedAtAsc("test-session-id")).thenReturn(conversation);

        List<Message> result = messageRepository.getConversationForExport("test-session-id");

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).findBySession_IdOrderByCreatedAtAsc("test-session-id");
    }

    @Test
    void shouldGetMessageStats() {
        IMessageRepository.MessageRepositoryStats stats = messageRepository.getMessageStats("test-session-id");

        assertThat(stats).isNotNull();
        assertThat(stats).isInstanceOf(IMessageRepository.MessageRepositoryStats.class);
    }

    @Test
    void shouldSaveAllMessages() {
        List<Message> messages = Arrays.asList(testMessage);
        when(jpaRepository.saveAll(messages)).thenReturn(messages);

        List<Message> savedMessages = messageRepository.saveAll(messages);

        assertThat(savedMessages).hasSize(1);
        assertThat(savedMessages.get(0)).isEqualTo(testMessage);
        verify(jpaRepository).saveAll(messages);
    }

    @Test
    void shouldHandleMessageStatsCorrectly() {
        // Mock data for statistics
        when(jpaRepository.countBySession_Id("test-session-id")).thenReturn(10L);
        when(jpaRepository.countBySession_IdAndRole("test-session-id", Message.MessageRole.USER)).thenReturn(5L);
        when(jpaRepository.countBySession_IdAndRole("test-session-id", Message.MessageRole.ASSISTANT)).thenReturn(4L);
        when(jpaRepository.countBySession_IdAndRole("test-session-id", Message.MessageRole.SYSTEM)).thenReturn(1L);
        when(jpaRepository.countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.PENDING)).thenReturn(0L);
        when(jpaRepository.countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.PROCESSING)).thenReturn(1L);
        when(jpaRepository.countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.COMPLETED)).thenReturn(8L);
        when(jpaRepository.countBySession_IdAndStatus("test-session-id", Message.ProcessingStatus.FAILED)).thenReturn(1L);
        when(jpaRepository.getAverageConfidenceBySessionId("test-session-id")).thenReturn(0.85);
        when(jpaRepository.getAverageProcessingTimeBySessionId("test-session-id")).thenReturn(1200.0);
        when(jpaRepository.getTotalTokensBySessionId("test-session-id")).thenReturn(2500L);
        when(jpaRepository.getLanguageFrequencyBySessionId("test-session-id"))
            .thenReturn(Arrays.asList(new Object[]{"en-US", 8L}, new Object[]{"es-ES", 2L}));

        IMessageRepository.MessageRepositoryStats stats = messageRepository.getMessageStats("test-session-id");

        assertThat(stats.getTotalMessages()).isEqualTo(10L);
        assertThat(stats.getUserMessages()).isEqualTo(5L);
        assertThat(stats.getAssistantMessages()).isEqualTo(4L);
        assertThat(stats.getSystemMessages()).isEqualTo(1L);
        assertThat(stats.getPendingMessages()).isEqualTo(0L);
        assertThat(stats.getProcessingMessages()).isEqualTo(1L);
        assertThat(stats.getCompletedMessages()).isEqualTo(8L);
        assertThat(stats.getFailedMessages()).isEqualTo(1L);
        assertThat(stats.getAverageConfidence()).isEqualTo(0.85);
        assertThat(stats.getAverageProcessingTime()).isEqualTo(1200.0);
        assertThat(stats.getTotalTokensUsed()).isEqualTo(2500L);
        assertThat(stats.getPrimaryLanguage()).isEqualTo("en-US");
    }

    @Test
    void shouldHandleEmptyLanguageFrequencyInStats() {
        when(jpaRepository.getLanguageFrequencyBySessionId("test-session-id")).thenReturn(Arrays.asList());

        IMessageRepository.MessageRepositoryStats stats = messageRepository.getMessageStats("test-session-id");

        assertThat(stats.getPrimaryLanguage()).isEqualTo("unknown");
    }

    @Test
    void shouldHandleNullParametersGracefully() {
        // Test methods that might receive null parameters
        assertThatThrownBy(() -> messageRepository.save(null))
            .isInstanceOf(RuntimeException.class);

        assertThatThrownBy(() -> messageRepository.findById(null))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void shouldLogDebugMessages() {
        // Since we're testing logging, we mainly verify that methods complete without errors
        when(jpaRepository.save(testMessage)).thenReturn(testMessage);
        when(jpaRepository.findById("test-message-id")).thenReturn(Optional.of(testMessage));

        assertThatCode(() -> messageRepository.save(testMessage)).doesNotThrowAnyException();
        assertThatCode(() -> messageRepository.findById("test-message-id")).doesNotThrowAnyException();
    }
}
package com.interview.assistant.repository;

import com.interview.assistant.model.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Message repository interface for message persistence operations
 * <p>
 * Why: Abstracts message data access for flexible storage backends
 * Pattern: Repository pattern - separates domain from infrastructure
 * Rationale: Enables testing and different storage implementations
 */
public interface IMessageRepository {

    /**
     * Save message to repository
     * Why: Primary persistence operation for message storage
     *
     * @param message Message to save
     * @return Saved message with updated metadata
     */
    Message save(Message message);

    /**
     * Save message asynchronously
     * Why: Non-blocking persistence for better performance
     *
     * @param message Message to save
     * @return Future containing saved message
     */
    CompletableFuture<Message> saveAsync(Message message);

    /**
     * Find message by ID
     * Why: Primary lookup operation for message retrieval
     *
     * @param messageId Message identifier
     * @return Optional containing message if found
     */
    Optional<Message> findById(String messageId);

    /**
     * Find messages by session ID
     * Why: Retrieve conversation history for a session
     *
     * @param sessionId Session identifier
     * @return List of messages ordered by creation time
     */
    List<Message> findBySessionId(String sessionId);

    /**
     * Find messages by session ID with pagination
     * Why: Handle large conversations efficiently
     *
     * @param sessionId Session identifier
     * @param pageable  Pagination parameters
     * @return Page of messages ordered by creation time
     */
    Page<Message> findBySessionId(String sessionId, Pageable pageable);

    /**
     * Find recent messages for session
     * Why: Get latest conversation context efficiently
     *
     * @param sessionId Session identifier
     * @param limit     Maximum number of messages to return
     * @return List of recent messages ordered by creation time
     */
    List<Message> findRecentMessagesBySessionId(String sessionId, int limit);

    /**
     * Find messages by session and role
     * Why: Filter messages by user, assistant, or system
     *
     * @param sessionId Session identifier
     * @param role      Message role to filter by
     * @return List of messages with specified role
     */
    List<Message> findBySessionIdAndRole(String sessionId, Message.MessageRole role);

    /**
     * Find messages by session and processing status
     * Why: Monitor message processing lifecycle
     *
     * @param sessionId Session identifier
     * @param status    Processing status to filter by
     * @return List of messages with specified status
     */
    List<Message> findBySessionIdAndStatus(String sessionId, Message.ProcessingStatus status);

    /**
     * Find user messages with low confidence
     * Why: Identify potential transcription issues
     *
     * @param sessionId           Session identifier
     * @param confidenceThreshold Maximum confidence score
     * @return List of user messages below confidence threshold
     */
    List<Message> findLowConfidenceUserMessages(String sessionId, double confidenceThreshold);

    /**
     * Find messages created between time range
     * Why: Analytics and time-based filtering
     *
     * @param sessionId Session identifier
     * @param startTime Start of time range
     * @param endTime   End of time range
     * @return List of messages created in time range
     */
    List<Message> findBySessionIdAndCreatedAtBetween(String sessionId, Instant startTime, Instant endTime);

    /**
     * Find messages by detected language
     * Why: Language-specific analysis and filtering
     *
     * @param sessionId Session identifier
     * @param language  Detected language code
     * @return List of messages in specified language
     */
    List<Message> findBySessionIdAndDetectedLanguage(String sessionId, String language);

    /**
     * Find failed messages
     * Why: Error monitoring and recovery
     *
     * @param sessionId Session identifier
     * @return List of messages that failed processing
     */
    List<Message> findFailedMessagesBySessionId(String sessionId);

    /**
     * Count messages by session
     * Why: Efficient conversation size calculation
     *
     * @param sessionId Session identifier
     * @return Number of messages in session
     */
    long countBySessionId(String sessionId);

    /**
     * Count messages by session and role
     * Why: Conversation statistics and analysis
     *
     * @param sessionId Session identifier
     * @param role      Message role to count
     * @return Number of messages with specified role
     */
    long countBySessionIdAndRole(String sessionId, Message.MessageRole role);

    /**
     * Count messages by session and status
     * Why: Processing status monitoring
     *
     * @param sessionId Session identifier
     * @param status    Processing status to count
     * @return Number of messages with specified status
     */
    long countBySessionIdAndStatus(String sessionId, Message.ProcessingStatus status);

    /**
     * Get total tokens used by session
     * Why: Cost tracking and conversation analysis
     *
     * @param sessionId Session identifier
     * @return Total tokens used in all assistant messages
     */
    long getTotalTokensBySessionId(String sessionId);

    /**
     * Get average confidence for session
     * Why: Conversation quality assessment
     *
     * @param sessionId Session identifier
     * @return Average confidence score for user messages
     */
    double getAverageConfidenceBySessionId(String sessionId);

    /**
     * Get average processing time for session
     * Why: Performance monitoring and optimization
     *
     * @param sessionId Session identifier
     * @return Average processing time for assistant messages
     */
    double getAverageProcessingTimeBySessionId(String sessionId);

    /**
     * Update message processing status
     * Why: Efficient status updates without full entity save
     *
     * @param messageId Message identifier
     * @param status    New processing status
     * @return Number of updated records
     */
    int updateMessageStatus(String messageId, Message.ProcessingStatus status);

    /**
     * Update message error information
     * Why: Record processing failures efficiently
     *
     * @param messageId    Message identifier
     * @param status       New processing status
     * @param errorMessage Error description
     * @return Number of updated records
     */
    int updateMessageError(String messageId, Message.ProcessingStatus status, String errorMessage);

    /**
     * Bulk update message statuses
     * Why: Efficient batch operations for message processing
     *
     * @param messageIds List of message identifiers
     * @param status     New status for all messages
     * @return Number of updated records
     */
    int bulkUpdateMessageStatus(List<String> messageIds, Message.ProcessingStatus status);

    /**
     * Delete message by ID
     * Why: Remove individual messages from storage
     *
     * @param messageId Message identifier
     * @return True if message was deleted
     */
    boolean deleteById(String messageId);

    /**
     * Delete messages by session ID
     * Why: Cleanup all messages when session is deleted
     *
     * @param sessionId Session identifier
     * @return Number of deleted messages
     */
    int deleteBySessionId(String sessionId);

    /**
     * Delete old messages from session
     * Why: Conversation history management and storage optimization
     *
     * @param sessionId  Session identifier
     * @param cutoffTime Messages created before this time
     * @return Number of deleted messages
     */
    int deleteOldMessagesBySessionId(String sessionId, Instant cutoffTime);

    /**
     * Delete failed messages
     * Why: Cleanup processing failures
     *
     * @param sessionId Session identifier
     * @return Number of deleted failed messages
     */
    int deleteFailedMessagesBySessionId(String sessionId);

    /**
     * Check if message exists
     * Why: Efficient existence checking without full retrieval
     *
     * @param messageId Message identifier
     * @return True if message exists
     */
    boolean existsById(String messageId);

    /**
     * Get conversation messages for export
     * Why: Data export and backup functionality
     *
     * @param sessionId Session identifier
     * @return List of all messages formatted for export
     */
    List<Message> getConversationForExport(String sessionId);

    /**
     * Get message statistics for session
     * Why: Comprehensive conversation analysis
     *
     * @param sessionId Session identifier
     * @return Statistics about messages in session
     */
    MessageRepositoryStats getMessageStats(String sessionId);

    /**
     * Batch save messages
     * Why: Efficient bulk persistence operations
     *
     * @param messages List of messages to save
     * @return List of saved messages
     */
    List<Message> saveAll(List<Message> messages);

    /**
     * Message repository statistics value object
     */
    interface MessageRepositoryStats {
        long getTotalMessages();

        long getUserMessages();

        long getAssistantMessages();

        long getSystemMessages();

        long getPendingMessages();

        long getProcessingMessages();

        long getCompletedMessages();

        long getFailedMessages();

        double getAverageConfidence();

        double getAverageProcessingTime();

        long getTotalTokensUsed();

        String getPrimaryLanguage();
    }
}
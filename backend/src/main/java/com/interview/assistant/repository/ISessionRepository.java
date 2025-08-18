package com.interview.assistant.repository;

import com.interview.assistant.model.Session;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Session repository interface for session persistence operations
 * 
 * Why: Abstracts data access for flexible storage backends
 * Pattern: Repository pattern - separates domain from infrastructure
 * Rationale: Enables testing with different storage implementations
 */
public interface ISessionRepository {
    
    /**
     * Save session to repository
     * Why: Primary persistence operation for session management
     * 
     * @param session Session to save
     * @return Saved session with updated metadata
     */
    Session save(Session session);
    
    /**
     * Save session asynchronously
     * Why: Non-blocking persistence for better performance
     * 
     * @param session Session to save
     * @return Future containing saved session
     */
    CompletableFuture<Session> saveAsync(Session session);
    
    /**
     * Find session by ID
     * Why: Primary lookup operation for session retrieval
     * 
     * @param sessionId Session identifier
     * @return Optional containing session if found
     */
    Optional<Session> findById(String sessionId);
    
    /**
     * Find session by ID asynchronously
     * Why: Non-blocking retrieval for better performance
     * 
     * @param sessionId Session identifier
     * @return Future containing optional session
     */
    CompletableFuture<Optional<Session>> findByIdAsync(String sessionId);
    
    /**
     * Find active sessions
     * Why: Retrieve all currently active conversation sessions
     * 
     * @return List of active sessions
     */
    List<Session> findActiveSessions();
    
    /**
     * Find sessions by status
     * Why: Query sessions by their current state
     * 
     * @param status Session status to filter by
     * @return List of sessions with specified status
     */
    List<Session> findByStatus(Session.SessionStatus status);
    
    /**
     * Find sessions by status with pagination
     * Why: Handle large result sets efficiently
     * 
     * @param status Session status to filter by
     * @param pageable Pagination parameters
     * @return Page of sessions with specified status
     */
    Page<Session> findByStatus(Session.SessionStatus status, Pageable pageable);
    
    /**
     * Find sessions last accessed before specified time
     * Why: Identify inactive sessions for cleanup
     * 
     * @param cutoffTime Time threshold for last access
     * @return List of sessions accessed before cutoff
     */
    List<Session> findSessionsLastAccessedBefore(Instant cutoffTime);
    
    /**
     * Find sessions by WebSocket session ID
     * Why: Map WebSocket connections to conversation sessions
     * 
     * @param webSocketSessionId WebSocket session identifier
     * @return Optional containing session if found
     */
    Optional<Session> findByWebSocketSessionId(String webSocketSessionId);
    
    /**
     * Find sessions created between time range
     * Why: Analytics and reporting on session creation patterns
     * 
     * @param startTime Start of time range
     * @param endTime End of time range
     * @return List of sessions created in time range
     */
    List<Session> findSessionsCreatedBetween(Instant startTime, Instant endTime);
    
    /**
     * Count sessions by status
     * Why: Provide statistics on session distribution
     * 
     * @param status Session status to count
     * @return Number of sessions with specified status
     */
    long countByStatus(Session.SessionStatus status);
    
    /**
     * Count active sessions
     * Why: Monitor current system load
     * 
     * @return Number of currently active sessions
     */
    long countActiveSessions();
    
    /**
     * Update session last accessed time
     * Why: Efficient timestamp updates without full entity save
     * 
     * @param sessionId Session identifier
     * @param lastAccessedAt New last accessed timestamp
     * @return Number of updated records
     */
    int updateLastAccessedTime(String sessionId, Instant lastAccessedAt);
    
    /**
     * Update session status
     * Why: Efficient status updates without full entity save
     * 
     * @param sessionId Session identifier
     * @param status New session status
     * @return Number of updated records
     */
    int updateSessionStatus(String sessionId, Session.SessionStatus status);
    
    /**
     * Bulk update session statuses
     * Why: Efficient batch operations for session management
     * 
     * @param sessionIds List of session identifiers
     * @param status New status for all sessions
     * @return Number of updated records
     */
    int bulkUpdateSessionStatus(List<String> sessionIds, Session.SessionStatus status);
    
    /**
     * Delete session by ID
     * Why: Remove session from storage
     * 
     * @param sessionId Session identifier
     * @return True if session was deleted
     */
    boolean deleteById(String sessionId);
    
    /**
     * Delete sessions by status
     * Why: Bulk cleanup of sessions in specific states
     * 
     * @param status Session status to delete
     * @return Number of deleted sessions
     */
    int deleteByStatus(Session.SessionStatus status);
    
    /**
     * Delete expired sessions
     * Why: Automated cleanup of old inactive sessions
     * 
     * @param cutoffTime Sessions last accessed before this time
     * @return Number of deleted sessions
     */
    int deleteExpiredSessions(Instant cutoffTime);
    
    /**
     * Check if session exists
     * Why: Efficient existence checking without full retrieval
     * 
     * @param sessionId Session identifier
     * @return True if session exists
     */
    boolean existsById(String sessionId);
    
    /**
     * Get session statistics
     * Why: Provide aggregate information about sessions
     * 
     * @return Statistics about session repository contents
     */
    SessionRepositoryStats getRepositoryStats();
    
    /**
     * Get sessions requiring cleanup
     * Why: Identify sessions that need maintenance operations
     * 
     * @param inactivityThreshold Time threshold for inactivity
     * @param maxResults Maximum number of results to return
     * @return List of sessions requiring cleanup
     */
    List<Session> getSessionsRequiringCleanup(Instant inactivityThreshold, int maxResults);
    
    /**
     * Batch save sessions
     * Why: Efficient bulk persistence operations
     * 
     * @param sessions List of sessions to save
     * @return List of saved sessions
     */
    List<Session> saveAll(List<Session> sessions);
    
    /**
     * Session repository statistics value object
     */
    interface SessionRepositoryStats {
        long getTotalSessions();
        long getActiveSessions();
        long getClosedSessions();
        long getExpiredSessions();
        Instant getOldestSessionCreatedAt();
        Instant getNewestSessionCreatedAt();
        double getAverageSessionDurationMinutes();
    }
}
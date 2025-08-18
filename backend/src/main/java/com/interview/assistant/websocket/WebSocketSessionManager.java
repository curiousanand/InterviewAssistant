package com.interview.assistant.websocket;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.Set;

/**
 * WebSocket session manager for tracking active connections
 * 
 * Why: Centralized management of WebSocket sessions for broadcasting and monitoring
 * Pattern: Session management pattern with concurrent data structures
 * Rationale: Enables efficient session lookup, broadcasting, and cleanup
 */
@Component
public class WebSocketSessionManager {
    
    private final Map<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();
    private final Map<String, SessionMetadata> sessionMetadata = new ConcurrentHashMap<>();
    private final Set<String> authenticatedSessions = new CopyOnWriteArraySet<>();
    
    /**
     * Register new WebSocket session
     * Why: Track sessions for management and broadcasting
     * 
     * @param session WebSocket session to register
     */
    public void registerSession(WebSocketSession session) {
        String sessionId = session.getId();
        activeSessions.put(sessionId, session);
        
        SessionMetadata metadata = new SessionMetadata(
            sessionId,
            session.getRemoteAddress() != null ? session.getRemoteAddress().toString() : "unknown",
            Instant.now(),
            Instant.now()
        );
        sessionMetadata.put(sessionId, metadata);
    }
    
    /**
     * Unregister WebSocket session
     * Why: Clean up resources when session closes
     * 
     * @param session WebSocket session to unregister
     */
    public void unregisterSession(WebSocketSession session) {
        String sessionId = session.getId();
        activeSessions.remove(sessionId);
        sessionMetadata.remove(sessionId);
        authenticatedSessions.remove(sessionId);
    }
    
    /**
     * Mark session as authenticated
     * Why: Track authentication status for security
     * 
     * @param session WebSocket session
     */
    public void markAuthenticated(WebSocketSession session) {
        authenticatedSessions.add(session.getId());
        updateLastActivity(session.getId());
    }
    
    /**
     * Check if session is authenticated
     * Why: Verify authentication status for message processing
     */
    public boolean isAuthenticated(WebSocketSession session) {
        return authenticatedSessions.contains(session.getId());
    }
    
    /**
     * Get session by ID
     * Why: Lookup sessions for targeted messaging
     */
    public WebSocketSession getSession(String sessionId) {
        return activeSessions.get(sessionId);
    }
    
    /**
     * Get all active sessions
     * Why: Broadcasting and monitoring functionality
     */
    public Set<WebSocketSession> getAllSessions() {
        return new CopyOnWriteArraySet<>(activeSessions.values());
    }
    
    /**
     * Get all authenticated sessions
     * Why: Send messages only to authenticated clients
     */
    public Set<WebSocketSession> getAuthenticatedSessions() {
        return authenticatedSessions.stream()
                .map(activeSessions::get)
                .filter(session -> session != null && session.isOpen())
                .collect(java.util.stream.Collectors.toCollection(CopyOnWriteArraySet::new));
    }
    
    /**
     * Update last activity timestamp
     * Why: Track session activity for timeout management
     */
    public void updateLastActivity(String sessionId) {
        SessionMetadata metadata = sessionMetadata.get(sessionId);
        if (metadata != null) {
            metadata.updateLastActivity();
        }
    }
    
    /**
     * Get session metadata
     * Why: Provide session information for monitoring
     */
    public SessionMetadata getSessionMetadata(String sessionId) {
        return sessionMetadata.get(sessionId);
    }
    
    /**
     * Get session count
     * Why: Monitoring and capacity planning
     */
    public int getActiveSessionCount() {
        return activeSessions.size();
    }
    
    /**
     * Get authenticated session count
     * Why: Security monitoring
     */
    public int getAuthenticatedSessionCount() {
        return authenticatedSessions.size();
    }
    
    /**
     * Clean up inactive sessions
     * Why: Remove sessions that are no longer responsive
     */
    public void cleanupInactiveSessions(long inactivityTimeoutMs) {
        long cutoffTime = Instant.now().toEpochMilli() - inactivityTimeoutMs;
        
        sessionMetadata.entrySet().removeIf(entry -> {
            SessionMetadata metadata = entry.getValue();
            if (metadata.getLastActivity().toEpochMilli() < cutoffTime) {
                String sessionId = entry.getKey();
                WebSocketSession session = activeSessions.remove(sessionId);
                authenticatedSessions.remove(sessionId);
                
                // Close session if still open
                if (session != null && session.isOpen()) {
                    try {
                        session.close();
                    } catch (Exception e) {
                        // Log error in production
                    }
                }
                return true;
            }
            return false;
        });
    }
    
    /**
     * Get sessions by criteria
     * Why: Advanced session filtering for management
     */
    public Set<WebSocketSession> getSessionsByCriteria(SessionCriteria criteria) {
        return sessionMetadata.entrySet().stream()
                .filter(entry -> criteria.matches(entry.getValue()))
                .map(entry -> activeSessions.get(entry.getKey()))
                .filter(session -> session != null && session.isOpen())
                .collect(java.util.stream.Collectors.toCollection(CopyOnWriteArraySet::new));
    }
    
    /**
     * Session metadata for tracking
     */
    public static class SessionMetadata {
        private final String sessionId;
        private final String remoteAddress;
        private final Instant connectedAt;
        private volatile Instant lastActivity;
        
        public SessionMetadata(String sessionId, String remoteAddress, Instant connectedAt, Instant lastActivity) {
            this.sessionId = sessionId;
            this.remoteAddress = remoteAddress;
            this.connectedAt = connectedAt;
            this.lastActivity = lastActivity;
        }
        
        public void updateLastActivity() {
            this.lastActivity = Instant.now();
        }
        
        // Getters
        public String getSessionId() { return sessionId; }
        public String getRemoteAddress() { return remoteAddress; }
        public Instant getConnectedAt() { return connectedAt; }
        public Instant getLastActivity() { return lastActivity; }
        
        public long getConnectionDurationMs() {
            return Instant.now().toEpochMilli() - connectedAt.toEpochMilli();
        }
        
        public long getInactivityDurationMs() {
            return Instant.now().toEpochMilli() - lastActivity.toEpochMilli();
        }
    }
    
    /**
     * Session criteria for filtering
     */
    public interface SessionCriteria {
        boolean matches(SessionMetadata metadata);
        
        static SessionCriteria connectedAfter(Instant time) {
            return metadata -> metadata.getConnectedAt().isAfter(time);
        }
        
        static SessionCriteria inactiveFor(long durationMs) {
            return metadata -> metadata.getInactivityDurationMs() > durationMs;
        }
        
        static SessionCriteria fromAddress(String address) {
            return metadata -> metadata.getRemoteAddress().contains(address);
        }
    }
    
    /**
     * Session statistics
     */
    public SessionStatistics getStatistics() {
        int totalSessions = activeSessions.size();
        int authenticatedCount = authenticatedSessions.size();
        
        long totalConnectionTime = sessionMetadata.values().stream()
                .mapToLong(SessionMetadata::getConnectionDurationMs)
                .sum();
        
        double averageConnectionTime = totalSessions > 0 ? 
            (double) totalConnectionTime / totalSessions : 0.0;
        
        return new SessionStatistics(
            totalSessions,
            authenticatedCount,
            averageConnectionTime,
            sessionMetadata.values().stream()
                .mapToLong(SessionMetadata::getInactivityDurationMs)
                .average()
                .orElse(0.0)
        );
    }
    
    /**
     * Session statistics value object
     */
    public static class SessionStatistics {
        private final int totalSessions;
        private final int authenticatedSessions;
        private final double averageConnectionTimeMs;
        private final double averageInactivityMs;
        
        public SessionStatistics(int totalSessions, int authenticatedSessions, 
                               double averageConnectionTimeMs, double averageInactivityMs) {
            this.totalSessions = totalSessions;
            this.authenticatedSessions = authenticatedSessions;
            this.averageConnectionTimeMs = averageConnectionTimeMs;
            this.averageInactivityMs = averageInactivityMs;
        }
        
        // Getters
        public int getTotalSessions() { return totalSessions; }
        public int getAuthenticatedSessions() { return authenticatedSessions; }
        public double getAverageConnectionTimeMs() { return averageConnectionTimeMs; }
        public double getAverageInactivityMs() { return averageInactivityMs; }
    }
}
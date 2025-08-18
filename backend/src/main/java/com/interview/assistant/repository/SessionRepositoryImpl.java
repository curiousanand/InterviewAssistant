package com.interview.assistant.repository;

import com.interview.assistant.model.Session;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory implementation of ISessionRepository for production use
 * This is a temporary implementation until proper database integration is added
 * 
 * Why: Enables production mode to start without database dependencies
 * Pattern: Repository pattern implementation with in-memory storage
 */
@Repository
@Profile("!test")
public class SessionRepositoryImpl implements ISessionRepository {
    
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    
    @Override
    public Session save(Session session) {
        if (session.getId() == null) {
            session.setId(UUID.randomUUID().toString());
        }
        // Only set lastAccessedAt if it's null (preserve existing values for tests)
        if (session.getLastAccessedAt() == null) {
            session.setLastAccessedAt(Instant.now());
        }
        sessions.put(session.getId(), session);
        return session;
    }
    
    @Override
    public CompletableFuture<Session> saveAsync(Session session) {
        return CompletableFuture.supplyAsync(() -> save(session));
    }
    
    @Override
    public Optional<Session> findById(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }
    
    @Override
    public CompletableFuture<Optional<Session>> findByIdAsync(String sessionId) {
        return CompletableFuture.supplyAsync(() -> findById(sessionId));
    }
    
    @Override
    public List<Session> findActiveSessions() {
        return sessions.values().stream()
                .filter(session -> session.getStatus() == Session.SessionStatus.ACTIVE)
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Session> findByStatus(Session.SessionStatus status) {
        return sessions.values().stream()
                .filter(session -> session.getStatus() == status)
                .collect(Collectors.toList());
    }
    
    @Override
    public Page<Session> findByStatus(Session.SessionStatus status, Pageable pageable) {
        List<Session> filtered = findByStatus(status);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        
        List<Session> pageContent = filtered.subList(start, end);
        return new PageImpl<>(pageContent, pageable, filtered.size());
    }
    
    @Override
    public List<Session> findSessionsLastAccessedBefore(Instant cutoffTime) {
        return sessions.values().stream()
                .filter(session -> session.getLastAccessedAt() != null && 
                        session.getLastAccessedAt().isBefore(cutoffTime))
                .collect(Collectors.toList());
    }
    
    @Override
    public Optional<Session> findByWebSocketSessionId(String webSocketSessionId) {
        return sessions.values().stream()
                .filter(session -> webSocketSessionId.equals(session.getWebSocketSessionId()))
                .findFirst();
    }
    
    @Override
    public List<Session> findSessionsCreatedBetween(Instant startTime, Instant endTime) {
        return sessions.values().stream()
                .filter(session -> session.getCreatedAt() != null &&
                        !session.getCreatedAt().isBefore(startTime) &&
                        !session.getCreatedAt().isAfter(endTime))
                .collect(Collectors.toList());
    }
    
    @Override
    public long countByStatus(Session.SessionStatus status) {
        return sessions.values().stream()
                .filter(session -> session.getStatus() == status)
                .count();
    }
    
    @Override
    public long countActiveSessions() {
        return countByStatus(Session.SessionStatus.ACTIVE);
    }
    
    @Override
    public int updateLastAccessedTime(String sessionId, Instant lastAccessedAt) {
        Session session = sessions.get(sessionId);
        if (session != null) {
            session.setLastAccessedAt(lastAccessedAt);
            return 1;
        }
        return 0;
    }
    
    @Override
    public int updateSessionStatus(String sessionId, Session.SessionStatus status) {
        Session session = sessions.get(sessionId);
        if (session != null) {
            session.setStatus(status);
            return 1;
        }
        return 0;
    }
    
    @Override
    public int bulkUpdateSessionStatus(List<String> sessionIds, Session.SessionStatus status) {
        int updated = 0;
        for (String sessionId : sessionIds) {
            updated += updateSessionStatus(sessionId, status);
        }
        return updated;
    }
    
    @Override
    public boolean deleteById(String sessionId) {
        return sessions.remove(sessionId) != null;
    }
    
    @Override
    public int deleteByStatus(Session.SessionStatus status) {
        List<String> toDelete = sessions.values().stream()
                .filter(session -> session.getStatus() == status)
                .map(Session::getId)
                .collect(Collectors.toList());
        
        toDelete.forEach(sessions::remove);
        return toDelete.size();
    }
    
    @Override
    public int deleteExpiredSessions(Instant cutoffTime) {
        List<String> toDelete = sessions.values().stream()
                .filter(session -> session.getLastAccessedAt() != null && 
                        session.getLastAccessedAt().isBefore(cutoffTime))
                .map(Session::getId)
                .collect(Collectors.toList());
        
        toDelete.forEach(sessions::remove);
        return toDelete.size();
    }
    
    @Override
    public boolean existsById(String sessionId) {
        return sessions.containsKey(sessionId);
    }
    
    @Override
    public SessionRepositoryStats getRepositoryStats() {
        return new SessionRepositoryStatsImpl();
    }
    
    @Override
    public List<Session> getSessionsRequiringCleanup(Instant inactivityThreshold, int maxResults) {
        return sessions.values().stream()
                .filter(session -> session.getLastAccessedAt() != null && 
                        session.getLastAccessedAt().isBefore(inactivityThreshold))
                .limit(maxResults)
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Session> saveAll(List<Session> sessionsToSave) {
        return sessionsToSave.stream()
                .map(this::save)
                .collect(Collectors.toList());
    }
    
    /**
     * Implementation of SessionRepositoryStats for in-memory storage
     */
    private class SessionRepositoryStatsImpl implements SessionRepositoryStats {
        
        @Override
        public long getTotalSessions() {
            return sessions.size();
        }
        
        @Override
        public long getActiveSessions() {
            return countByStatus(Session.SessionStatus.ACTIVE);
        }
        
        @Override
        public long getClosedSessions() {
            return countByStatus(Session.SessionStatus.CLOSED);
        }
        
        @Override
        public long getExpiredSessions() {
            return countByStatus(Session.SessionStatus.EXPIRED);
        }
        
        @Override
        public Instant getOldestSessionCreatedAt() {
            return sessions.values().stream()
                    .map(Session::getCreatedAt)
                    .filter(Objects::nonNull)
                    .min(Instant::compareTo)
                    .orElse(null);
        }
        
        @Override
        public Instant getNewestSessionCreatedAt() {
            return sessions.values().stream()
                    .map(Session::getCreatedAt)
                    .filter(Objects::nonNull)
                    .max(Instant::compareTo)
                    .orElse(null);
        }
        
        @Override
        public double getAverageSessionDurationMinutes() {
            // For in-memory implementation, return 0 as we don't track session end times
            return 0.0;
        }
    }
}
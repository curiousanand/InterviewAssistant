package com.interview.assistant.repository;

import com.interview.assistant.model.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprehensive test suite for SessionRepositoryImpl
 * <p>
 * Tests all repository operations, edge cases, and business logic
 */
@DisplayName("SessionRepository Implementation Tests")
class SessionRepositoryImplTest {

    private ISessionRepository repository;

    @BeforeEach
    void setUp() {
        repository = new SessionRepositoryImpl();
    }

    @Test
    @DisplayName("Should save and retrieve session")
    void shouldSaveAndRetrieveSession() {
        // Given
        Session session = Session.create("en-US", true);

        // When
        Session savedSession = repository.save(session);

        // Then
        assertThat(savedSession.getId()).isNotNull();
        assertThat(savedSession.getLastAccessedAt()).isNotNull();

        // Verify retrieval
        Optional<Session> retrieved = repository.findById(savedSession.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getId()).isEqualTo(savedSession.getId());
    }

    @Test
    @DisplayName("Should generate ID for new session")
    void shouldGenerateIdForNewSession() {
        // Given
        Session session = Session.create("en-US", true);
        String originalId = session.getId();
        session.setId(null); // Remove ID to test generation

        // When
        Session savedSession = repository.save(session);

        // Then
        assertThat(savedSession.getId()).isNotNull();
        assertThat(savedSession.getId()).isNotEqualTo(originalId);
    }

    @Test
    @DisplayName("Should update last accessed time on save")
    void shouldUpdateLastAccessedTimeOnSave() {
        // Given
        Session session = Session.create("en-US", true);
        Instant before = Instant.now().minusSeconds(1);

        // When
        Session savedSession = repository.save(session);

        // Then
        assertThat(savedSession.getLastAccessedAt()).isAfter(before);
    }

    @Test
    @DisplayName("Should save session asynchronously")
    void shouldSaveSessionAsynchronously() {
        // Given
        Session session = Session.create("es-ES", false);

        // When
        CompletableFuture<Session> future = repository.saveAsync(session);

        // Then
        assertThat(future).succeedsWithin(java.time.Duration.ofSeconds(1));
        Session savedSession = future.join();
        assertThat(savedSession.getId()).isNotNull();
    }

    @Test
    @DisplayName("Should find session by ID asynchronously")
    void shouldFindSessionByIdAsynchronously() {
        // Given
        Session session = Session.create("fr-FR", true);
        Session savedSession = repository.save(session);

        // When
        CompletableFuture<Optional<Session>> future = repository.findByIdAsync(savedSession.getId());

        // Then
        assertThat(future).succeedsWithin(java.time.Duration.ofSeconds(1));
        Optional<Session> result = future.join();
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(savedSession.getId());
    }

    @Test
    @DisplayName("Should return empty optional for non-existent session")
    void shouldReturnEmptyOptionalForNonExistentSession() {
        // When
        Optional<Session> result = repository.findById("non-existent-id");

        // Then
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Should find active sessions")
    void shouldFindActiveSessions() {
        // Given
        Session activeSession1 = Session.create("en-US", true);
        Session activeSession2 = Session.create("es-ES", false);
        Session closedSession = Session.create("fr-FR", true);
        closedSession.close();

        repository.save(activeSession1);
        repository.save(activeSession2);
        repository.save(closedSession);

        // When
        List<Session> activeSessions = repository.findActiveSessions();

        // Then
        assertThat(activeSessions).hasSize(2);
        assertThat(activeSessions).allMatch(Session::isActive);
    }

    @Test
    @DisplayName("Should find sessions by status")
    void shouldFindSessionsByStatus() {
        // Given
        Session activeSession = Session.create("en-US", true);
        Session closedSession = Session.create("es-ES", false);
        Session expiredSession = Session.create("fr-FR", true);

        closedSession.close();
        expiredSession.expire();

        repository.save(activeSession);
        repository.save(closedSession);
        repository.save(expiredSession);

        // When
        List<Session> activeSessions = repository.findByStatus(Session.SessionStatus.ACTIVE);
        List<Session> closedSessions = repository.findByStatus(Session.SessionStatus.CLOSED);
        List<Session> expiredSessions = repository.findByStatus(Session.SessionStatus.EXPIRED);

        // Then
        assertThat(activeSessions).hasSize(1);
        assertThat(closedSessions).hasSize(1);
        assertThat(expiredSessions).hasSize(1);
    }

    @Test
    @DisplayName("Should find sessions by status with pagination")
    void shouldFindSessionsByStatusWithPagination() {
        // Given
        for (int i = 0; i < 5; i++) {
            Session session = Session.create("en-US", true);
            repository.save(session);
        }

        Pageable pageable = PageRequest.of(0, 3);

        // When
        Page<Session> page = repository.findByStatus(Session.SessionStatus.ACTIVE, pageable);

        // Then
        assertThat(page.getContent()).hasSize(3);
        assertThat(page.getTotalElements()).isEqualTo(5);
        assertThat(page.getTotalPages()).isEqualTo(2);
    }

    @Test
    @DisplayName("Should find sessions last accessed before cutoff time")
    void shouldFindSessionsLastAccessedBeforeCutoffTime() {
        // Given
        Session oldSession = Session.create("en-US", true);
        oldSession.setLastAccessedAt(Instant.now().minusSeconds(3600)); // 1 hour ago

        Session recentSession = Session.create("es-ES", false);
        // recentSession has current timestamp

        repository.save(oldSession);
        repository.save(recentSession);

        Instant cutoffTime = Instant.now().minusSeconds(1800); // 30 minutes ago

        // When
        List<Session> oldSessions = repository.findSessionsLastAccessedBefore(cutoffTime);

        // Then
        assertThat(oldSessions).hasSize(1);
        assertThat(oldSessions.get(0).getId()).isEqualTo(oldSession.getId());
    }

    @Test
    @DisplayName("Should find session by WebSocket session ID")
    void shouldFindSessionByWebSocketSessionId() {
        // Given
        Session session = Session.create("en-US", true);
        String wsSessionId = "ws-session-123";
        session.setWebSocketSessionId(wsSessionId);
        repository.save(session);

        // When
        Optional<Session> result = repository.findByWebSocketSessionId(wsSessionId);

        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(session.getId());
    }

    @Test
    @DisplayName("Should find sessions created between time range")
    void shouldFindSessionsCreatedBetweenTimeRange() {
        // Given
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);
        Instant twoHoursAgo = now.minusSeconds(7200);

        Session oldSession = Session.create("en-US", true);
        oldSession.setCreatedAt(twoHoursAgo.minusSeconds(100)); // Before range

        Session recentSession = Session.create("es-ES", false);
        recentSession.setCreatedAt(oneHourAgo.plusSeconds(100)); // In range

        Session futureSession = Session.create("fr-FR", true);
        futureSession.setCreatedAt(now.plusSeconds(100)); // After range

        repository.save(oldSession);
        repository.save(recentSession);
        repository.save(futureSession);

        // When
        List<Session> sessionsInRange = repository.findSessionsCreatedBetween(oneHourAgo, now);

        // Then
        assertThat(sessionsInRange).hasSize(1);
        assertThat(sessionsInRange.get(0).getId()).isEqualTo(recentSession.getId());
    }

    @Test
    @DisplayName("Should count sessions by status")
    void shouldCountSessionsByStatus() {
        // Given
        for (int i = 0; i < 3; i++) {
            Session session = Session.create("en-US", true);
            repository.save(session);
        }

        for (int i = 0; i < 2; i++) {
            Session session = Session.create("es-ES", false);
            session.close();
            repository.save(session);
        }

        // When
        long activeCount = repository.countByStatus(Session.SessionStatus.ACTIVE);
        long closedCount = repository.countByStatus(Session.SessionStatus.CLOSED);
        long expiredCount = repository.countByStatus(Session.SessionStatus.EXPIRED);

        // Then
        assertThat(activeCount).isEqualTo(3);
        assertThat(closedCount).isEqualTo(2);
        assertThat(expiredCount).isEqualTo(0);
    }

    @Test
    @DisplayName("Should count active sessions")
    void shouldCountActiveSessions() {
        // Given
        for (int i = 0; i < 4; i++) {
            Session session = Session.create("en-US", true);
            repository.save(session);
        }

        Session closedSession = Session.create("es-ES", false);
        closedSession.close();
        repository.save(closedSession);

        // When
        long activeCount = repository.countActiveSessions();

        // Then
        assertThat(activeCount).isEqualTo(4);
    }

    @Test
    @DisplayName("Should update last accessed time")
    void shouldUpdateLastAccessedTime() {
        // Given
        Session session = Session.create("en-US", true);
        Session savedSession = repository.save(session);
        Instant newTime = Instant.now().plusSeconds(100);

        // When
        int updated = repository.updateLastAccessedTime(savedSession.getId(), newTime);

        // Then
        assertThat(updated).isEqualTo(1);

        Optional<Session> retrieved = repository.findById(savedSession.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getLastAccessedAt()).isEqualTo(newTime);
    }

    @Test
    @DisplayName("Should update session status")
    void shouldUpdateSessionStatus() {
        // Given
        Session session = Session.create("en-US", true);
        Session savedSession = repository.save(session);

        // When
        int updated = repository.updateSessionStatus(savedSession.getId(), Session.SessionStatus.CLOSED);

        // Then
        assertThat(updated).isEqualTo(1);

        Optional<Session> retrieved = repository.findById(savedSession.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getStatus()).isEqualTo(Session.SessionStatus.CLOSED);
    }

    @Test
    @DisplayName("Should bulk update session statuses")
    void shouldBulkUpdateSessionStatuses() {
        // Given
        Session session1 = Session.create("en-US", true);
        Session session2 = Session.create("es-ES", false);
        Session savedSession1 = repository.save(session1);
        Session savedSession2 = repository.save(session2);

        List<String> sessionIds = List.of(savedSession1.getId(), savedSession2.getId());

        // When
        int updated = repository.bulkUpdateSessionStatus(sessionIds, Session.SessionStatus.EXPIRED);

        // Then
        assertThat(updated).isEqualTo(2);

        // Verify both sessions were updated
        Optional<Session> retrieved1 = repository.findById(savedSession1.getId());
        Optional<Session> retrieved2 = repository.findById(savedSession2.getId());

        assertThat(retrieved1.get().getStatus()).isEqualTo(Session.SessionStatus.EXPIRED);
        assertThat(retrieved2.get().getStatus()).isEqualTo(Session.SessionStatus.EXPIRED);
    }

    @Test
    @DisplayName("Should delete session by ID")
    void shouldDeleteSessionById() {
        // Given
        Session session = Session.create("en-US", true);
        Session savedSession = repository.save(session);

        // When
        boolean deleted = repository.deleteById(savedSession.getId());

        // Then
        assertThat(deleted).isTrue();
        assertThat(repository.findById(savedSession.getId())).isEmpty();
    }

    @Test
    @DisplayName("Should return false when deleting non-existent session")
    void shouldReturnFalseWhenDeletingNonExistentSession() {
        // When
        boolean deleted = repository.deleteById("non-existent-id");

        // Then
        assertThat(deleted).isFalse();
    }

    @Test
    @DisplayName("Should delete sessions by status")
    void shouldDeleteSessionsByStatus() {
        // Given
        Session activeSession = Session.create("en-US", true);
        Session closedSession1 = Session.create("es-ES", false);
        Session closedSession2 = Session.create("fr-FR", true);

        closedSession1.close();
        closedSession2.close();

        repository.save(activeSession);
        repository.save(closedSession1);
        repository.save(closedSession2);

        // When
        int deletedCount = repository.deleteByStatus(Session.SessionStatus.CLOSED);

        // Then
        assertThat(deletedCount).isEqualTo(2);
        assertThat(repository.countByStatus(Session.SessionStatus.CLOSED)).isEqualTo(0);
        assertThat(repository.countByStatus(Session.SessionStatus.ACTIVE)).isEqualTo(1);
    }

    @Test
    @DisplayName("Should delete expired sessions")
    void shouldDeleteExpiredSessions() {
        // Given
        Session recentSession = Session.create("en-US", true);

        Session oldSession = Session.create("es-ES", false);
        oldSession.setLastAccessedAt(Instant.now().minusSeconds(7200)); // 2 hours ago

        repository.save(recentSession);
        repository.save(oldSession);

        Instant cutoffTime = Instant.now().minusSeconds(3600); // 1 hour ago

        // When
        int deletedCount = repository.deleteExpiredSessions(cutoffTime);

        // Then
        assertThat(deletedCount).isEqualTo(1);
        assertThat(repository.findById(oldSession.getId())).isEmpty();
        assertThat(repository.findById(recentSession.getId())).isPresent();
    }

    @Test
    @DisplayName("Should check if session exists")
    void shouldCheckIfSessionExists() {
        // Given
        Session session = Session.create("en-US", true);
        Session savedSession = repository.save(session);

        // When & Then
        assertThat(repository.existsById(savedSession.getId())).isTrue();
        assertThat(repository.existsById("non-existent-id")).isFalse();
    }

    @Test
    @DisplayName("Should get repository statistics")
    void shouldGetRepositoryStatistics() {
        // Given
        Session activeSession = Session.create("en-US", true);
        Session closedSession = Session.create("es-ES", false);
        Session expiredSession = Session.create("fr-FR", true);

        closedSession.close();
        expiredSession.expire();

        repository.save(activeSession);
        repository.save(closedSession);
        repository.save(expiredSession);

        // When
        ISessionRepository.SessionRepositoryStats stats = repository.getRepositoryStats();

        // Then
        assertThat(stats.getTotalSessions()).isEqualTo(3);
        assertThat(stats.getActiveSessions()).isEqualTo(1);
        assertThat(stats.getClosedSessions()).isEqualTo(1);
        assertThat(stats.getExpiredSessions()).isEqualTo(1);
    }

    @Test
    @DisplayName("Should get sessions requiring cleanup")
    void shouldGetSessionsRequiringCleanup() {
        // Given
        Session recentSession = Session.create("en-US", true);

        Session oldSession = Session.create("es-ES", false);
        oldSession.setLastAccessedAt(Instant.now().minusSeconds(7200)); // 2 hours ago

        repository.save(recentSession);
        repository.save(oldSession);

        Instant threshold = Instant.now().minusSeconds(3600); // 1 hour ago

        // When
        List<Session> sessionsForCleanup = repository.getSessionsRequiringCleanup(threshold, 10);

        // Then
        assertThat(sessionsForCleanup).hasSize(1);
        assertThat(sessionsForCleanup.get(0).getId()).isEqualTo(oldSession.getId());
    }

    @Test
    @DisplayName("Should save all sessions in batch")
    void shouldSaveAllSessionsInBatch() {
        // Given
        Session session1 = Session.create("en-US", true);
        Session session2 = Session.create("es-ES", false);
        Session session3 = Session.create("fr-FR", true);

        List<Session> sessions = List.of(session1, session2, session3);

        // When
        List<Session> savedSessions = repository.saveAll(sessions);

        // Then
        assertThat(savedSessions).hasSize(3);
        assertThat(savedSessions).allMatch(session -> session.getId() != null);

        // Verify all sessions can be retrieved
        for (Session savedSession : savedSessions) {
            assertThat(repository.findById(savedSession.getId())).isPresent();
        }
    }
}
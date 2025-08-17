package com.interview.assistant.infrastructure.repository;

import com.interview.assistant.domain.entity.Session;
import com.interview.assistant.domain.repository.ISessionRepository;
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
 * Test suite for H2SessionRepository
 * 
 * Tests session repository operations, queries, and business logic
 * Rationale: Ensures session persistence layer works correctly with proper error handling
 */
@ExtendWith(MockitoExtension.class)
class H2SessionRepositoryTest {

    @Mock
    private H2SessionRepository.SessionJpaRepository jpaRepository;

    private H2SessionRepository sessionRepository;
    private Session testSession;

    @BeforeEach
    void setUp() {
        sessionRepository = new H2SessionRepository(jpaRepository);
        
        testSession = Session.builder()
            .id("test-session-id")
            .status(Session.SessionStatus.ACTIVE)
            .language("en-US")
            .createdAt(Instant.now())
            .lastAccessedAt(Instant.now())
            .build();
    }

    @Test
    void shouldSaveSessionSuccessfully() {
        when(jpaRepository.save(testSession)).thenReturn(testSession);

        Session savedSession = sessionRepository.save(testSession);

        assertThat(savedSession).isEqualTo(testSession);
        verify(jpaRepository).save(testSession);
    }

    @Test
    void shouldSaveSessionAsynchronously() throws Exception {
        when(jpaRepository.save(testSession)).thenReturn(testSession);

        CompletableFuture<Session> future = sessionRepository.saveAsync(testSession);
        Session savedSession = future.get();

        assertThat(savedSession).isEqualTo(testSession);
        verify(jpaRepository).save(testSession);
    }

    @Test
    void shouldFindSessionById() {
        when(jpaRepository.findById("test-session-id")).thenReturn(Optional.of(testSession));

        Optional<Session> foundSession = sessionRepository.findById("test-session-id");

        assertThat(foundSession).isPresent();
        assertThat(foundSession.get()).isEqualTo(testSession);
        verify(jpaRepository).findById("test-session-id");
    }

    @Test
    void shouldReturnEmptyWhenSessionNotFound() {
        when(jpaRepository.findById("non-existent")).thenReturn(Optional.empty());

        Optional<Session> foundSession = sessionRepository.findById("non-existent");

        assertThat(foundSession).isEmpty();
        verify(jpaRepository).findById("non-existent");
    }

    @Test
    void shouldFindSessionByIdAsynchronously() throws Exception {
        when(jpaRepository.findById("test-session-id")).thenReturn(Optional.of(testSession));

        CompletableFuture<Optional<Session>> future = sessionRepository.findByIdAsync("test-session-id");
        Optional<Session> foundSession = future.get();

        assertThat(foundSession).isPresent();
        assertThat(foundSession.get()).isEqualTo(testSession);
        verify(jpaRepository).findById("test-session-id");
    }

    @Test
    void shouldFindActiveSessions() {
        List<Session> activeSessions = Arrays.asList(testSession);
        when(jpaRepository.findByStatus(Session.SessionStatus.ACTIVE)).thenReturn(activeSessions);

        List<Session> result = sessionRepository.findActiveSessions();

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testSession);
        verify(jpaRepository).findByStatus(Session.SessionStatus.ACTIVE);
    }

    @Test
    void shouldFindSessionsByStatus() {
        List<Session> closedSessions = Arrays.asList(testSession);
        when(jpaRepository.findByStatus(Session.SessionStatus.CLOSED)).thenReturn(closedSessions);

        List<Session> result = sessionRepository.findByStatus(Session.SessionStatus.CLOSED);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testSession);
        verify(jpaRepository).findByStatus(Session.SessionStatus.CLOSED);
    }

    @Test
    void shouldFindSessionsByStatusWithPagination() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Session> sessionPage = new PageImpl<>(Arrays.asList(testSession));
        when(jpaRepository.findByStatus(Session.SessionStatus.ACTIVE, pageable)).thenReturn(sessionPage);

        Page<Session> result = sessionRepository.findByStatus(Session.SessionStatus.ACTIVE, pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0)).isEqualTo(testSession);
        verify(jpaRepository).findByStatus(Session.SessionStatus.ACTIVE, pageable);
    }

    @Test
    void shouldFindSessionsLastAccessedBefore() {
        Instant cutoffTime = Instant.now().minusSeconds(3600);
        List<Session> expiredSessions = Arrays.asList(testSession);
        when(jpaRepository.findByLastAccessedAtBefore(cutoffTime)).thenReturn(expiredSessions);

        List<Session> result = sessionRepository.findSessionsLastAccessedBefore(cutoffTime);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testSession);
        verify(jpaRepository).findByLastAccessedAtBefore(cutoffTime);
    }

    @Test
    void shouldFindSessionByWebSocketSessionId() {
        String webSocketSessionId = "ws-session-id";
        when(jpaRepository.findByWebSocketSessionId(webSocketSessionId)).thenReturn(Optional.of(testSession));

        Optional<Session> result = sessionRepository.findByWebSocketSessionId(webSocketSessionId);

        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo(testSession);
        verify(jpaRepository).findByWebSocketSessionId(webSocketSessionId);
    }

    @Test
    void shouldFindSessionsCreatedBetween() {
        Instant startTime = Instant.now().minusSeconds(7200);
        Instant endTime = Instant.now();
        List<Session> sessions = Arrays.asList(testSession);
        when(jpaRepository.findByCreatedAtBetween(startTime, endTime)).thenReturn(sessions);

        List<Session> result = sessionRepository.findSessionsCreatedBetween(startTime, endTime);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testSession);
        verify(jpaRepository).findByCreatedAtBetween(startTime, endTime);
    }

    @Test
    void shouldCountSessionsByStatus() {
        when(jpaRepository.countByStatus(Session.SessionStatus.ACTIVE)).thenReturn(5L);

        long count = sessionRepository.countByStatus(Session.SessionStatus.ACTIVE);

        assertThat(count).isEqualTo(5L);
        verify(jpaRepository).countByStatus(Session.SessionStatus.ACTIVE);
    }

    @Test
    void shouldCountActiveSessions() {
        when(jpaRepository.countByStatus(Session.SessionStatus.ACTIVE)).thenReturn(3L);

        long count = sessionRepository.countActiveSessions();

        assertThat(count).isEqualTo(3L);
        verify(jpaRepository).countByStatus(Session.SessionStatus.ACTIVE);
    }

    @Test
    void shouldUpdateLastAccessedTime() {
        Instant newTime = Instant.now();
        when(jpaRepository.updateLastAccessedTime("test-session-id", newTime)).thenReturn(1);

        int updateCount = sessionRepository.updateLastAccessedTime("test-session-id", newTime);

        assertThat(updateCount).isEqualTo(1);
        verify(jpaRepository).updateLastAccessedTime("test-session-id", newTime);
    }

    @Test
    void shouldUpdateSessionStatus() {
        when(jpaRepository.updateSessionStatus("test-session-id", Session.SessionStatus.CLOSED)).thenReturn(1);

        int updateCount = sessionRepository.updateSessionStatus("test-session-id", Session.SessionStatus.CLOSED);

        assertThat(updateCount).isEqualTo(1);
        verify(jpaRepository).updateSessionStatus("test-session-id", Session.SessionStatus.CLOSED);
    }

    @Test
    void shouldBulkUpdateSessionStatus() {
        List<String> sessionIds = Arrays.asList("session1", "session2", "session3");
        when(jpaRepository.bulkUpdateSessionStatus(sessionIds, Session.SessionStatus.EXPIRED)).thenReturn(3);

        int updateCount = sessionRepository.bulkUpdateSessionStatus(sessionIds, Session.SessionStatus.EXPIRED);

        assertThat(updateCount).isEqualTo(3);
        verify(jpaRepository).bulkUpdateSessionStatus(sessionIds, Session.SessionStatus.EXPIRED);
    }

    @Test
    void shouldDeleteSessionByIdWhenExists() {
        when(jpaRepository.existsById("test-session-id")).thenReturn(true);

        boolean deleted = sessionRepository.deleteById("test-session-id");

        assertThat(deleted).isTrue();
        verify(jpaRepository).existsById("test-session-id");
        verify(jpaRepository).deleteById("test-session-id");
    }

    @Test
    void shouldNotDeleteSessionByIdWhenNotExists() {
        when(jpaRepository.existsById("non-existent")).thenReturn(false);

        boolean deleted = sessionRepository.deleteById("non-existent");

        assertThat(deleted).isFalse();
        verify(jpaRepository).existsById("non-existent");
        verify(jpaRepository, never()).deleteById("non-existent");
    }

    @Test
    void shouldDeleteSessionsByStatus() {
        when(jpaRepository.deleteByStatus(Session.SessionStatus.EXPIRED)).thenReturn(2);

        int deleteCount = sessionRepository.deleteByStatus(Session.SessionStatus.EXPIRED);

        assertThat(deleteCount).isEqualTo(2);
        verify(jpaRepository).deleteByStatus(Session.SessionStatus.EXPIRED);
    }

    @Test
    void shouldDeleteExpiredSessions() {
        Instant cutoffTime = Instant.now().minusSeconds(86400);
        when(jpaRepository.deleteExpiredSessions(cutoffTime)).thenReturn(5);

        int deleteCount = sessionRepository.deleteExpiredSessions(cutoffTime);

        assertThat(deleteCount).isEqualTo(5);
        verify(jpaRepository).deleteExpiredSessions(cutoffTime);
    }

    @Test
    void shouldCheckIfSessionExists() {
        when(jpaRepository.existsById("test-session-id")).thenReturn(true);

        boolean exists = sessionRepository.existsById("test-session-id");

        assertThat(exists).isTrue();
        verify(jpaRepository).existsById("test-session-id");
    }

    @Test
    void shouldGetRepositoryStats() {
        ISessionRepository.SessionRepositoryStats stats = sessionRepository.getRepositoryStats();

        assertThat(stats).isNotNull();
        assertThat(stats).isInstanceOf(ISessionRepository.SessionRepositoryStats.class);
    }

    @Test
    void shouldGetSessionsRequiringCleanup() {
        Instant inactivityThreshold = Instant.now().minusSeconds(1800);
        List<Session> sessionsForCleanup = Arrays.asList(testSession);
        when(jpaRepository.findSessionsRequiringCleanup(inactivityThreshold, 10)).thenReturn(sessionsForCleanup);

        List<Session> result = sessionRepository.getSessionsRequiringCleanup(inactivityThreshold, 10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).isEqualTo(testSession);
        verify(jpaRepository).findSessionsRequiringCleanup(inactivityThreshold, 10);
    }

    @Test
    void shouldSaveAllSessions() {
        List<Session> sessions = Arrays.asList(testSession);
        when(jpaRepository.saveAll(sessions)).thenReturn(sessions);

        List<Session> savedSessions = sessionRepository.saveAll(sessions);

        assertThat(savedSessions).hasSize(1);
        assertThat(savedSessions.get(0)).isEqualTo(testSession);
        verify(jpaRepository).saveAll(sessions);
    }

    @Test
    void shouldHandleRepositoryStatsCorrectly() {
        // Mock data for statistics
        when(jpaRepository.count()).thenReturn(100L);
        when(jpaRepository.countByStatus(Session.SessionStatus.ACTIVE)).thenReturn(30L);
        when(jpaRepository.countByStatus(Session.SessionStatus.CLOSED)).thenReturn(60L);
        when(jpaRepository.countByStatus(Session.SessionStatus.EXPIRED)).thenReturn(10L);
        when(jpaRepository.findAll()).thenReturn(Arrays.asList(testSession));

        ISessionRepository.SessionRepositoryStats stats = sessionRepository.getRepositoryStats();

        assertThat(stats.getTotalSessions()).isEqualTo(100L);
        assertThat(stats.getActiveSessions()).isEqualTo(30L);
        assertThat(stats.getClosedSessions()).isEqualTo(60L);
        assertThat(stats.getExpiredSessions()).isEqualTo(10L);
        assertThat(stats.getOldestSessionCreatedAt()).isNotNull();
        assertThat(stats.getNewestSessionCreatedAt()).isNotNull();
        assertThat(stats.getAverageSessionDurationMinutes()).isGreaterThanOrEqualTo(0.0);
    }

    @Test
    void shouldHandleEmptySessionListInStats() {
        when(jpaRepository.count()).thenReturn(0L);
        when(jpaRepository.countByStatus(any())).thenReturn(0L);
        when(jpaRepository.findAll()).thenReturn(Arrays.asList());

        ISessionRepository.SessionRepositoryStats stats = sessionRepository.getRepositoryStats();

        assertThat(stats.getTotalSessions()).isEqualTo(0L);
        assertThat(stats.getActiveSessions()).isEqualTo(0L);
        assertThat(stats.getAverageSessionDurationMinutes()).isEqualTo(0.0);
    }

    @Test
    void shouldHandleNullParametersGracefully() {
        // Test methods that might receive null parameters
        assertThatThrownBy(() -> sessionRepository.save(null))
            .isInstanceOf(RuntimeException.class);

        assertThatThrownBy(() -> sessionRepository.findById(null))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void shouldLogDebugMessages() {
        // Since we're testing logging, we mainly verify that methods complete without errors
        // In a real scenario, you might use a logging testing framework
        
        when(jpaRepository.save(testSession)).thenReturn(testSession);
        when(jpaRepository.findById("test-session-id")).thenReturn(Optional.of(testSession));

        assertThatCode(() -> sessionRepository.save(testSession)).doesNotThrowAnyException();
        assertThatCode(() -> sessionRepository.findById("test-session-id")).doesNotThrowAnyException();
    }
}
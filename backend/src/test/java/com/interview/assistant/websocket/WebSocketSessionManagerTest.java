package com.interview.assistant.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.socket.WebSocketSession;

import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for WebSocketSessionManager
 * <p>
 * Tests session management, authentication tracking, cleanup, and statistics
 */
@DisplayName("WebSocketSessionManager Tests")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WebSocketSessionManagerTest {

    private WebSocketSessionManager sessionManager;

    @Mock
    private WebSocketSession mockSession1;

    @Mock
    private WebSocketSession mockSession2;

    @Mock
    private WebSocketSession mockSession3;

    private String sessionId1;
    private String sessionId2;
    private String sessionId3;

    @BeforeEach
    void setUp() {
        sessionManager = new WebSocketSessionManager();

        sessionId1 = "session-001";
        sessionId2 = "session-002";
        sessionId3 = "session-003";

        // Setup mock sessions
        when(mockSession1.getId()).thenReturn(sessionId1);
        when(mockSession1.isOpen()).thenReturn(true);
        when(mockSession1.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 8080));

        when(mockSession2.getId()).thenReturn(sessionId2);
        when(mockSession2.isOpen()).thenReturn(true);
        when(mockSession2.getRemoteAddress()).thenReturn(new InetSocketAddress("192.168.1.100", 8080));

        when(mockSession3.getId()).thenReturn(sessionId3);
        when(mockSession3.isOpen()).thenReturn(true);
        when(mockSession3.getRemoteAddress()).thenReturn(new InetSocketAddress("10.0.0.50", 8080));
    }

    @Test
    @DisplayName("Should register session successfully")
    void shouldRegisterSessionSuccessfully() {
        // When
        sessionManager.registerSession(mockSession1);

        // Then
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(1);
        assertThat(sessionManager.getSession(sessionId1)).isEqualTo(mockSession1);

        WebSocketSessionManager.SessionMetadata metadata = sessionManager.getSessionMetadata(sessionId1);
        assertThat(metadata).isNotNull();
        assertThat(metadata.getSessionId()).isEqualTo(sessionId1);
        assertThat(metadata.getRemoteAddress()).contains("127.0.0.1");
        assertThat(metadata.getConnectedAt()).isNotNull();
        assertThat(metadata.getLastActivity()).isNotNull();
    }

    @Test
    @DisplayName("Should register multiple sessions")
    void shouldRegisterMultipleSessions() {
        // When
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.registerSession(mockSession3);

        // Then
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(3);
        assertThat(sessionManager.getSession(sessionId1)).isEqualTo(mockSession1);
        assertThat(sessionManager.getSession(sessionId2)).isEqualTo(mockSession2);
        assertThat(sessionManager.getSession(sessionId3)).isEqualTo(mockSession3);

        Set<WebSocketSession> allSessions = sessionManager.getAllSessions();
        assertThat(allSessions).hasSize(3);
        assertThat(allSessions).containsExactlyInAnyOrder(mockSession1, mockSession2, mockSession3);
    }

    @Test
    @DisplayName("Should unregister session successfully")
    void shouldUnregisterSessionSuccessfully() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(2);

        // When
        sessionManager.unregisterSession(mockSession1);

        // Then
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(1);
        assertThat(sessionManager.getSession(sessionId1)).isNull();
        assertThat(sessionManager.getSession(sessionId2)).isEqualTo(mockSession2);
        assertThat(sessionManager.getSessionMetadata(sessionId1)).isNull();
    }

    @Test
    @DisplayName("Should handle session authentication")
    void shouldHandleSessionAuthentication() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);

        // When
        sessionManager.markAuthenticated(mockSession1);

        // Then
        assertThat(sessionManager.isAuthenticated(mockSession1)).isTrue();
        assertThat(sessionManager.isAuthenticated(mockSession2)).isFalse();
        assertThat(sessionManager.getAuthenticatedSessionCount()).isEqualTo(1);

        Set<WebSocketSession> authenticatedSessions = sessionManager.getAuthenticatedSessions();
        assertThat(authenticatedSessions).hasSize(1);
        assertThat(authenticatedSessions).contains(mockSession1);
    }

    @Test
    @DisplayName("Should remove authentication on unregister")
    void shouldRemoveAuthenticationOnUnregister() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.markAuthenticated(mockSession1);
        assertThat(sessionManager.isAuthenticated(mockSession1)).isTrue();

        // When
        sessionManager.unregisterSession(mockSession1);

        // Then
        assertThat(sessionManager.getAuthenticatedSessionCount()).isEqualTo(0);
        assertThat(sessionManager.getAuthenticatedSessions()).isEmpty();
    }

    @Test
    @DisplayName("Should update last activity timestamp")
    void shouldUpdateLastActivityTimestamp() throws InterruptedException {
        // Given
        sessionManager.registerSession(mockSession1);
        WebSocketSessionManager.SessionMetadata initialMetadata = sessionManager.getSessionMetadata(sessionId1);
        Instant initialActivity = initialMetadata.getLastActivity();

        // Wait a small amount to ensure timestamp difference
        Thread.sleep(10);

        // When
        sessionManager.updateLastActivity(sessionId1);

        // Then
        WebSocketSessionManager.SessionMetadata updatedMetadata = sessionManager.getSessionMetadata(sessionId1);
        assertThat(updatedMetadata.getLastActivity()).isAfter(initialActivity);
    }

    @Test
    @DisplayName("Should handle non-existent session activity update")
    void shouldHandleNonExistentSessionActivityUpdate() {
        // When - Try to update non-existent session
        assertThatNoException().isThrownBy(() ->
                sessionManager.updateLastActivity("non-existent-session"));
    }

    @Test
    @DisplayName("Should return null for non-existent session")
    void shouldReturnNullForNonExistentSession() {
        // When & Then
        assertThat(sessionManager.getSession("non-existent")).isNull();
        assertThat(sessionManager.getSessionMetadata("non-existent")).isNull();
    }

    @Test
    @DisplayName("Should handle session with null remote address")
    void shouldHandleSessionWithNullRemoteAddress() {
        // Given
        WebSocketSession sessionWithNullAddress = mock(WebSocketSession.class);
        when(sessionWithNullAddress.getId()).thenReturn("null-address-session");
        when(sessionWithNullAddress.isOpen()).thenReturn(true);
        when(sessionWithNullAddress.getRemoteAddress()).thenReturn(null);

        // When
        sessionManager.registerSession(sessionWithNullAddress);

        // Then
        WebSocketSessionManager.SessionMetadata metadata = sessionManager.getSessionMetadata("null-address-session");
        assertThat(metadata).isNotNull();
        assertThat(metadata.getRemoteAddress()).isEqualTo("unknown");
    }

    @Test
    @DisplayName("Should get authenticated sessions excluding closed ones")
    void shouldGetAuthenticatedSessionsExcludingClosedOnes() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.markAuthenticated(mockSession1);
        sessionManager.markAuthenticated(mockSession2);

        // Mock session2 as closed
        when(mockSession2.isOpen()).thenReturn(false);

        // When
        Set<WebSocketSession> authenticatedSessions = sessionManager.getAuthenticatedSessions();

        // Then
        assertThat(authenticatedSessions).hasSize(1);
        assertThat(authenticatedSessions).contains(mockSession1);
        assertThat(authenticatedSessions).doesNotContain(mockSession2);
    }

    @Test
    @DisplayName("Should cleanup inactive sessions")
    void shouldCleanupInactiveSessions() throws Exception {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.registerSession(mockSession3);
        sessionManager.markAuthenticated(mockSession1);
        sessionManager.markAuthenticated(mockSession2);

        // Simulate old activity for session1 and session2
        WebSocketSessionManager.SessionMetadata metadata1 = sessionManager.getSessionMetadata(sessionId1);
        WebSocketSessionManager.SessionMetadata metadata2 = sessionManager.getSessionMetadata(sessionId2);

        // Use reflection to set old activity times (simulating old sessions)
        java.lang.reflect.Field lastActivityField = metadata1.getClass().getDeclaredField("lastActivity");
        lastActivityField.setAccessible(true);
        lastActivityField.set(metadata1, Instant.now().minusSeconds(3600)); // 1 hour ago
        lastActivityField.set(metadata2, Instant.now().minusSeconds(1800)); // 30 minutes ago

        // When - Cleanup sessions inactive for more than 45 minutes (2700 seconds)
        sessionManager.cleanupInactiveSessions(45 * 60 * 1000); // 45 minutes in ms

        // Then
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(2);
        assertThat(sessionManager.getSession(sessionId1)).isNull(); // Should be removed (1 hour old)
        assertThat(sessionManager.getSession(sessionId2)).isEqualTo(mockSession2); // Should remain (30 min old < 45 min limit)
        assertThat(sessionManager.getSession(sessionId3)).isEqualTo(mockSession3); // Should remain (recent)
        assertThat(sessionManager.getAuthenticatedSessionCount()).isEqualTo(1); // Session2 still authenticated

        verify(mockSession1).close();
        verify(mockSession2, never()).close(); // Session2 should not be closed
        verify(mockSession3, never()).close();
    }

    @Test
    @DisplayName("Should handle session close error during cleanup")
    void shouldHandleSessionCloseErrorDuringCleanup() throws Exception {
        // Given
        sessionManager.registerSession(mockSession1);

        // Simulate old activity
        WebSocketSessionManager.SessionMetadata metadata = sessionManager.getSessionMetadata(sessionId1);
        java.lang.reflect.Field lastActivityField = metadata.getClass().getDeclaredField("lastActivity");
        lastActivityField.setAccessible(true);
        lastActivityField.set(metadata, Instant.now().minusSeconds(3600)); // 1 hour ago

        // Mock session.close() to throw exception
        doThrow(new RuntimeException("Close failed")).when(mockSession1).close();

        // When & Then - Should not throw exception
        assertThatNoException().isThrownBy(() ->
                sessionManager.cleanupInactiveSessions(30 * 60 * 1000)); // 30 minutes

        // Session should still be removed from manager
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("Should filter sessions by criteria")
    void shouldFilterSessionsByCriteria() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.registerSession(mockSession3);

        // When - Filter sessions connected after a specific time
        Instant filterTime = Instant.now().minusSeconds(10);
        WebSocketSessionManager.SessionCriteria criteria = WebSocketSessionManager.SessionCriteria.connectedAfter(filterTime);
        Set<WebSocketSession> filteredSessions = sessionManager.getSessionsByCriteria(criteria);

        // Then - All sessions should match (they were all created after filterTime)
        assertThat(filteredSessions).hasSize(3);
        assertThat(filteredSessions).containsExactlyInAnyOrder(mockSession1, mockSession2, mockSession3);
    }

    @Test
    @DisplayName("Should filter sessions by remote address")
    void shouldFilterSessionsByRemoteAddress() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.registerSession(mockSession3);

        // When - Filter sessions from specific address
        WebSocketSessionManager.SessionCriteria criteria = WebSocketSessionManager.SessionCriteria.fromAddress("127.0.0.1");
        Set<WebSocketSession> filteredSessions = sessionManager.getSessionsByCriteria(criteria);

        // Then - Only session1 should match
        assertThat(filteredSessions).hasSize(1);
        assertThat(filteredSessions).contains(mockSession1);
    }

    @Test
    @DisplayName("Should filter sessions by inactivity duration")
    void shouldFilterSessionsByInactivityDuration() throws Exception {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);

        // Simulate old activity for session1
        WebSocketSessionManager.SessionMetadata metadata1 = sessionManager.getSessionMetadata(sessionId1);
        java.lang.reflect.Field lastActivityField = metadata1.getClass().getDeclaredField("lastActivity");
        lastActivityField.setAccessible(true);
        lastActivityField.set(metadata1, Instant.now().minusSeconds(3600)); // 1 hour ago

        // When - Filter sessions inactive for more than 30 minutes
        WebSocketSessionManager.SessionCriteria criteria = WebSocketSessionManager.SessionCriteria.inactiveFor(30 * 60 * 1000);
        Set<WebSocketSession> filteredSessions = sessionManager.getSessionsByCriteria(criteria);

        // Then - Only session1 should match (inactive for 1 hour)
        assertThat(filteredSessions).hasSize(1);
        assertThat(filteredSessions).contains(mockSession1);
    }

    @Test
    @DisplayName("Should exclude closed sessions from criteria filtering")
    void shouldExcludeClosedSessionsFromCriteriaFiltering() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);

        // Mock session2 as closed
        when(mockSession2.isOpen()).thenReturn(false);

        // When
        WebSocketSessionManager.SessionCriteria criteria = WebSocketSessionManager.SessionCriteria.connectedAfter(Instant.now().minusSeconds(10));
        Set<WebSocketSession> filteredSessions = sessionManager.getSessionsByCriteria(criteria);

        // Then - Only open session should be included
        assertThat(filteredSessions).hasSize(1);
        assertThat(filteredSessions).contains(mockSession1);
        assertThat(filteredSessions).doesNotContain(mockSession2);
    }

    @Test
    @DisplayName("Should calculate session statistics correctly")
    void shouldCalculateSessionStatisticsCorrectly() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.markAuthenticated(mockSession1);

        // When
        WebSocketSessionManager.SessionStatistics stats = sessionManager.getStatistics();

        // Then
        assertThat(stats.getTotalSessions()).isEqualTo(2);
        assertThat(stats.getAuthenticatedSessions()).isEqualTo(1);
        assertThat(stats.getAverageConnectionTimeMs()).isGreaterThanOrEqualTo(0);
        assertThat(stats.getAverageInactivityMs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    @DisplayName("Should calculate zero statistics for empty manager")
    void shouldCalculateZeroStatisticsForEmptyManager() {
        // When
        WebSocketSessionManager.SessionStatistics stats = sessionManager.getStatistics();

        // Then
        assertThat(stats.getTotalSessions()).isEqualTo(0);
        assertThat(stats.getAuthenticatedSessions()).isEqualTo(0);
        assertThat(stats.getAverageConnectionTimeMs()).isEqualTo(0.0);
        assertThat(stats.getAverageInactivityMs()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("Should test SessionMetadata methods")
    void shouldTestSessionMetadataMethods() {
        // Given
        sessionManager.registerSession(mockSession1);
        WebSocketSessionManager.SessionMetadata metadata = sessionManager.getSessionMetadata(sessionId1);

        // When & Then
        assertThat(metadata.getSessionId()).isEqualTo(sessionId1);
        assertThat(metadata.getRemoteAddress()).contains("127.0.0.1");
        assertThat(metadata.getConnectedAt()).isNotNull();
        assertThat(metadata.getLastActivity()).isNotNull();
        assertThat(metadata.getConnectionDurationMs()).isGreaterThanOrEqualTo(0);
        assertThat(metadata.getInactivityDurationMs()).isGreaterThanOrEqualTo(0);
    }

    @Test
    @DisplayName("Should update last activity when marking session as authenticated")
    void shouldUpdateLastActivityWhenMarkingAuthenticated() throws InterruptedException {
        // Given
        sessionManager.registerSession(mockSession1);
        WebSocketSessionManager.SessionMetadata initialMetadata = sessionManager.getSessionMetadata(sessionId1);
        Instant initialActivity = initialMetadata.getLastActivity();

        // Wait a small amount to ensure timestamp difference
        Thread.sleep(10);

        // When
        sessionManager.markAuthenticated(mockSession1);

        // Then
        WebSocketSessionManager.SessionMetadata updatedMetadata = sessionManager.getSessionMetadata(sessionId1);
        assertThat(updatedMetadata.getLastActivity()).isAfter(initialActivity);
        assertThat(sessionManager.isAuthenticated(mockSession1)).isTrue();
    }

    @Test
    @DisplayName("Should handle concurrent session operations")
    void shouldHandleConcurrentSessionOperations() {
        // When - Simulate concurrent registrations
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);
        sessionManager.markAuthenticated(mockSession1);
        sessionManager.updateLastActivity(sessionId1);
        sessionManager.unregisterSession(mockSession2);

        // Then
        assertThat(sessionManager.getActiveSessionCount()).isEqualTo(1);
        assertThat(sessionManager.getAuthenticatedSessionCount()).isEqualTo(1);
        assertThat(sessionManager.isAuthenticated(mockSession1)).isTrue();
    }

    @Test
    @DisplayName("Should create custom session criteria")
    void shouldCreateCustomSessionCriteria() {
        // Given
        sessionManager.registerSession(mockSession1);
        sessionManager.registerSession(mockSession2);

        // When - Create custom criteria
        WebSocketSessionManager.SessionCriteria customCriteria = metadata ->
                metadata.getSessionId().equals(sessionId1);

        Set<WebSocketSession> filteredSessions = sessionManager.getSessionsByCriteria(customCriteria);

        // Then
        assertThat(filteredSessions).hasSize(1);
        assertThat(filteredSessions).contains(mockSession1);
        assertThat(filteredSessions).doesNotContain(mockSession2);
    }
}
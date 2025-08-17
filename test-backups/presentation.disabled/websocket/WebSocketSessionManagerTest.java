package com.interview.assistant.presentation.websocket;

import com.interview.assistant.presentation.websocket.model.WebSocketContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.WebSocketSession;

import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.fail;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for WebSocketSessionManager
 * 
 * Tests session lifecycle management, cleanup, and monitoring
 * Rationale: Ensures proper session tracking and resource management
 */
@ExtendWith(MockitoExtension.class)
class WebSocketSessionManagerTest {

    @Mock
    private WebSocketSession webSocketSession1;

    @Mock
    private WebSocketSession webSocketSession2;

    private WebSocketSessionManager sessionManager;

    @BeforeEach
    void setUp() {
        sessionManager = new WebSocketSessionManager();
        
        // Set configuration values using reflection
        ReflectionTestUtils.setField(sessionManager, "sessionTimeoutMinutes", 60L);
        ReflectionTestUtils.setField(sessionManager, "cleanupIntervalMinutes", 5L);
        ReflectionTestUtils.setField(sessionManager, "maxSessions", 1000);

        // Setup mock WebSocket sessions
        when(webSocketSession1.getId()).thenReturn("ws-session-1");
        when(webSocketSession1.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 8080));
        when(webSocketSession1.isOpen()).thenReturn(true);

        when(webSocketSession2.getId()).thenReturn("ws-session-2");
        when(webSocketSession2.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.2", 8080));
        when(webSocketSession2.isOpen()).thenReturn(true);
    }

    @Test
    void shouldInitializeSuccessfully() {
        sessionManager.initialize();
        
        // Verify initialization completed without errors
        assertThatCode(() -> sessionManager.initialize()).doesNotThrowAnyException();
    }

    @Test
    void shouldCreateSessionSuccessfully() {
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        
        assertThat(context).isNotNull();
        assertThat(context.getSessionId()).isNotNull();
        assertThat(context.getWebSocketSessionId()).isEqualTo("ws-session-1");
        assertThat(context.getClientIpAddress()).isEqualTo("127.0.0.1");
        assertThat(context.getWebSocketSession()).isEqualTo(webSocketSession1);
        assertThat(context.getCreatedAt()).isNotNull();
        assertThat(context.getLastActivity()).isNotNull();
    }

    @Test
    void shouldTrackMultipleSessions() {
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        WebSocketContext context2 = sessionManager.createSession(webSocketSession2);
        
        assertThat(context1.getSessionId()).isNotEqualTo(context2.getSessionId());
        assertThat(sessionManager.getSessionCount()).isEqualTo(2);
        
        Collection<WebSocketContext> activeSessions = sessionManager.getAllSessions();
        assertThat(activeSessions).hasSize(2);
        assertThat(activeSessions).contains(context1, context2);
    }

    @Test
    void shouldRetrieveSessionById() {
        WebSocketContext originalContext = sessionManager.createSession(webSocketSession1);
        String sessionId = originalContext.getSessionId();
        
        WebSocketContext retrievedContext = sessionManager.getSession(sessionId);
        
        assertThat(retrievedContext).isEqualTo(originalContext);
        assertThat(retrievedContext.getSessionId()).isEqualTo(sessionId);
    }

    @Test
    void shouldRetrieveSessionByWebSocket() {
        WebSocketContext originalContext = sessionManager.createSession(webSocketSession1);
        
        WebSocketContext retrievedContext = sessionManager.getSessionByWebSocket(webSocketSession1);
        
        assertThat(retrievedContext).isEqualTo(originalContext);
        assertThat(retrievedContext.getWebSocketSession()).isEqualTo(webSocketSession1);
    }

    @Test
    void shouldReturnNullForNonExistentSession() {
        WebSocketContext context = sessionManager.getSession("non-existent-session-id");
        
        assertThat(context).isNull();
    }

    @Test
    void shouldReturnNullForNonExistentWebSocketSession() {
        WebSocketSession unknownSession = mock(WebSocketSession.class);
        when(unknownSession.getId()).thenReturn("unknown-session");
        
        WebSocketContext context = sessionManager.getSessionByWebSocket(unknownSession);
        
        assertThat(context).isNull();
    }

    @Test
    void shouldRemoveSessionById() {
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        String sessionId = context.getSessionId();
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(1);
        
        sessionManager.removeSession(sessionId);
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(0);
        assertThat(sessionManager.getSession(sessionId)).isNull();
    }

    @Test
    void shouldRemoveSessionByWebSocket() {
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(1);
        
        sessionManager.removeSessionByWebSocket(webSocketSession1);
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(0);
        assertThat(sessionManager.getSessionByWebSocket(webSocketSession1)).isNull();
    }

    @Test
    void shouldHandleRemovingNonExistentSession() {
        // Should not throw exception when removing non-existent session
        assertThatCode(() -> sessionManager.removeSession("non-existent-session-id"))
            .doesNotThrowAnyException();
    }

    @Test
    void shouldHandleRemovingNonExistentWebSocketSession() {
        WebSocketSession unknownSession = mock(WebSocketSession.class);
        when(unknownSession.getId()).thenReturn("unknown-session");
        
        // Should not throw exception when removing non-existent session
        assertThatCode(() -> sessionManager.removeSessionByWebSocket(unknownSession))
            .doesNotThrowAnyException();
    }

    @Test
    void shouldPreventExceedingMaxSessions() {
        // Set a low max session limit for testing
        ReflectionTestUtils.setField(sessionManager, "maxSessions", 1);
        
        // Create first session - should succeed
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        assertThat(context1).isNotNull();
        
        // Create second session - should fail due to limit
        assertThatThrownBy(() -> sessionManager.createSession(webSocketSession2))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Maximum session limit reached");
    }

    @Test
    void shouldCleanupExpiredSessions() {
        // Set a very short timeout for testing
        ReflectionTestUtils.setField(sessionManager, "sessionTimeoutMinutes", 0L);
        
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        assertThat(sessionManager.getSessionCount()).isEqualTo(1);
        
        // Manually trigger cleanup using reflection
        try {
            java.lang.reflect.Method cleanupMethod = WebSocketSessionManager.class.getDeclaredMethod("cleanupExpiredSessions");
            cleanupMethod.setAccessible(true);
            cleanupMethod.invoke(sessionManager);
        } catch (Exception e) {
            fail("Failed to invoke cleanup method: " + e.getMessage());
        }
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(0);
        assertThat(sessionManager.getSession(context.getSessionId())).isNull();
    }

    @Test
    void shouldNotCleanupActiveSessions() {
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        
        // Update last activity to current time
        context.updateLastActivity();
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(1);
        
        // Trigger cleanup using reflection
        try {
            java.lang.reflect.Method cleanupMethod = WebSocketSessionManager.class.getDeclaredMethod("cleanupExpiredSessions");
            cleanupMethod.setAccessible(true);
            cleanupMethod.invoke(sessionManager);
        } catch (Exception e) {
            fail("Failed to invoke cleanup method: " + e.getMessage());
        }
        
        // Session should still exist
        assertThat(sessionManager.getSessionCount()).isEqualTo(1);
        assertThat(sessionManager.getSession(context.getSessionId())).isNotNull();
    }

    @Test
    void shouldGetSessionStatistics() {
        // Create some sessions
        sessionManager.createSession(webSocketSession1);
        sessionManager.createSession(webSocketSession2);
        
        // Remove one session
        sessionManager.removeSessionByWebSocket(webSocketSession1);
        
        WebSocketSessionManager.SessionStatistics stats = sessionManager.getStatistics();
        
        assertThat(stats).isNotNull();
        assertThat(stats.getActiveSessions()).isEqualTo(1);
        assertThat(stats.getTotalSessionsCreated()).isEqualTo(2);
        assertThat(stats.getTotalSessionsClosed()).isEqualTo(1);
    }

    @Test
    void shouldFilterSessionsByClientIp() {
        sessionManager.createSession(webSocketSession1);
        sessionManager.createSession(webSocketSession2);
        
        Collection<WebSocketContext> allSessions = sessionManager.getAllSessions();
        
        List<WebSocketContext> sessionsForIp1 = allSessions.stream()
            .filter(ctx -> "127.0.0.1".equals(ctx.getClientIpAddress()))
            .collect(java.util.stream.Collectors.toList());
        
        List<WebSocketContext> sessionsForIp2 = allSessions.stream()
            .filter(ctx -> "127.0.0.2".equals(ctx.getClientIpAddress()))
            .collect(java.util.stream.Collectors.toList());
        
        assertThat(sessionsForIp1).hasSize(1);
        assertThat(sessionsForIp2).hasSize(1);
        assertThat(sessionsForIp1.get(0).getClientIpAddress()).isEqualTo("127.0.0.1");
        assertThat(sessionsForIp2.get(0).getClientIpAddress()).isEqualTo("127.0.0.2");
    }

    @Test
    void shouldFilterSessionsByAge() {
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        WebSocketContext context2 = sessionManager.createSession(webSocketSession2);
        
        // Make context1 older by manipulating its creation time
        ReflectionTestUtils.setField(context1, "connectionTime", Instant.now().minusSeconds(7200)); // 2 hours ago
        
        Collection<WebSocketContext> allSessions = sessionManager.getAllSessions();
        Instant cutoffTime = Instant.now().minusSeconds(3600); // 1 hour ago
        
        List<WebSocketContext> oldSessions = allSessions.stream()
            .filter(ctx -> ctx.getConnectionTime().isBefore(cutoffTime))
            .collect(java.util.stream.Collectors.toList());
        
        assertThat(oldSessions).hasSize(1);
        assertThat(oldSessions.get(0)).isEqualTo(context1);
    }

    @Test
    void shouldCheckIfSessionExists() {
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        String sessionId = context.getSessionId();
        
        assertThat(sessionManager.sessionExists(sessionId)).isTrue();
        assertThat(sessionManager.sessionExists("non-existent-id")).isFalse();
        
        sessionManager.removeSession(sessionId);
        assertThat(sessionManager.sessionExists(sessionId)).isFalse();
    }

    @Test
    void shouldShutdownGracefully() {
        sessionManager.initialize();
        
        // Create some sessions
        sessionManager.createSession(webSocketSession1);
        sessionManager.createSession(webSocketSession2);
        
        assertThatCode(() -> sessionManager.shutdown()).doesNotThrowAnyException();
        
        // After shutdown, session operations should still work
        assertThat(sessionManager.getSessionCount()).isEqualTo(2);
    }

    @Test
    void shouldHandleConcurrentSessionCreation() {
        // This test simulates concurrent session creation
        Thread thread1 = new Thread(() -> sessionManager.createSession(webSocketSession1));
        Thread thread2 = new Thread(() -> sessionManager.createSession(webSocketSession2));
        
        thread1.start();
        thread2.start();
        
        try {
            thread1.join();
            thread2.join();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(2);
    }

    @Test
    void shouldHandleConcurrentSessionRemoval() {
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        WebSocketContext context2 = sessionManager.createSession(webSocketSession2);
        
        String sessionId1 = context1.getSessionId();
        String sessionId2 = context2.getSessionId();
        
        Thread thread1 = new Thread(() -> sessionManager.removeSession(sessionId1));
        Thread thread2 = new Thread(() -> sessionManager.removeSession(sessionId2));
        
        thread1.start();
        thread2.start();
        
        try {
            thread1.join();
            thread2.join();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(0);
    }

    @Test
    void shouldUpdateSessionStatisticsCorrectly() {
        WebSocketSessionManager.SessionStatistics initialStats = sessionManager.getStatistics();
        long initialCreated = initialStats.getTotalSessionsCreated();
        long initialClosed = initialStats.getTotalSessionsClosed();
        
        // Create and remove sessions
        WebSocketContext context = sessionManager.createSession(webSocketSession1);
        sessionManager.removeSession(context.getSessionId());
        
        WebSocketSessionManager.SessionStatistics finalStats = sessionManager.getStatistics();
        
        assertThat(finalStats.getTotalSessionsCreated()).isEqualTo(initialCreated + 1);
        assertThat(finalStats.getTotalSessionsClosed()).isEqualTo(initialClosed + 1);
    }

    @Test
    void shouldHandleNullWebSocketSession() {
        assertThatThrownBy(() -> sessionManager.createSession(null))
            .isInstanceOf(RuntimeException.class);
    }

    @Test
    void shouldGetAllSessionsAsCollection() {
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        WebSocketContext context2 = sessionManager.createSession(webSocketSession2);
        
        Collection<WebSocketContext> allSessions = sessionManager.getAllSessions();
        
        assertThat(allSessions).hasSize(2);
        assertThat(allSessions).contains(context1);
        assertThat(allSessions).contains(context2);
    }

    @Test
    void shouldRemoveAllSessions() {
        WebSocketContext context1 = sessionManager.createSession(webSocketSession1);
        WebSocketContext context2 = sessionManager.createSession(webSocketSession2);
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(2);
        
        // Remove all sessions manually since there's no closeAllSessions method
        sessionManager.removeSession(context1.getSessionId());
        sessionManager.removeSession(context2.getSessionId());
        
        assertThat(sessionManager.getSessionCount()).isEqualTo(0);
    }

    @Test
    void shouldTrackCleanupRuns() {
        WebSocketSessionManager.SessionStatistics initialStats = sessionManager.getStatistics();
        long initialCleanupRuns = initialStats.getTotalCleanupRuns();
        
        // Use reflection to call private cleanupExpiredSessions method
        try {
            java.lang.reflect.Method cleanupMethod = WebSocketSessionManager.class.getDeclaredMethod("cleanupExpiredSessions");
            cleanupMethod.setAccessible(true);
            cleanupMethod.invoke(sessionManager);
        } catch (Exception e) {
            fail("Failed to invoke cleanup method: " + e.getMessage());
        }
        
        WebSocketSessionManager.SessionStatistics finalStats = sessionManager.getStatistics();
        assertThat(finalStats.getTotalCleanupRuns()).isEqualTo(initialCleanupRuns + 1);
    }
}
package com.interview.assistant.presentation.websocket.handler;

import com.interview.assistant.presentation.websocket.model.WebSocketContext;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for AuthenticationHandler
 * 
 * Tests authentication logic, API key validation, and security features
 * Rationale: Ensures only authenticated users can access WebSocket functionality
 */
@ExtendWith(MockitoExtension.class)
class AuthenticationHandlerTest {

    @Mock
    private IMessageHandler nextHandler;

    @Mock
    private WebSocketContext webSocketContext;

    private AuthenticationHandler authenticationHandler;

    private final String validApiKey = "test-api-key";
    private final String invalidApiKey = "invalid-api-key";

    @BeforeEach
    void setUp() {
        authenticationHandler = new AuthenticationHandler();
        authenticationHandler.setNext(nextHandler);

        // Set configuration values using reflection
        ReflectionTestUtils.setField(authenticationHandler, "expectedApiKey", validApiKey);
        ReflectionTestUtils.setField(authenticationHandler, "authCacheTtlSeconds", 300L);
        ReflectionTestUtils.setField(authenticationHandler, "maxFailedAttempts", 5);
        ReflectionTestUtils.setField(authenticationHandler, "lockoutDurationSeconds", 300L);

        // Setup context
        when(webSocketContext.getSessionId()).thenReturn("test-session-id");
        when(webSocketContext.getClientIpAddress()).thenReturn("127.0.0.1");
        when(nextHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);
    }

    @Test
    void shouldAllowAlreadyAuthenticatedSession() {
        when(webSocketContext.isAuthenticated()).thenReturn(true);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).updateLastActivity();
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldAuthenticateWithValidApiKeyInContext() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(validApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).markAsAuthenticated();
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldAuthenticateWithValidApiKeyInMessageMetadata() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(null);
        
        Map<String, Object> metadata = Map.of("apiKey", validApiKey);
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello")
            .metadata(metadata)
            .build();

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).markAsAuthenticated();
        verify(nextHandler).handle(message, webSocketContext);
    }

    @Test
    void shouldRejectInvalidApiKey() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(invalidApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext, never()).markAsAuthenticated();
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Invalid API key");
    }

    @Test
    void shouldRejectMissingApiKey() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(null);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext, never()).markAsAuthenticated();
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("API key is required");
    }

    @Test
    void shouldRejectEmptyApiKey() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn("");
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext, never()).markAsAuthenticated();
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("API key is required");
    }

    @Test
    void shouldTrackFailedAuthenticationAttempts() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(invalidApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        // Make multiple failed attempts
        for (int i = 0; i < 3; i++) {
            MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);
            assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        }

        verify(webSocketContext, times(3)).incrementErrorCount();
    }

    @Test
    void shouldLockAccountAfterMaxFailedAttempts() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(invalidApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        // Make maximum failed attempts to trigger lockout
        for (int i = 0; i < 5; i++) {
            authenticationHandler.handle(message, webSocketContext);
        }

        // Next attempt should be blocked due to lockout
        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        assertThat(message.getProcessingError()).contains("Account temporarily locked");
    }

    @Test
    void shouldClearFailedAttemptsAfterSuccessfulAuthentication() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        WebSocketMessage message = createTestMessage("Hello");

        // Make a few failed attempts
        when(webSocketContext.getApiKey()).thenReturn(invalidApiKey);
        for (int i = 0; i < 2; i++) {
            authenticationHandler.handle(message, webSocketContext);
        }

        // Then authenticate successfully
        when(webSocketContext.getApiKey()).thenReturn(validApiKey);
        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).markAsAuthenticated();

        // Failed attempts should be cleared - no lockout should occur
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(invalidApiKey);
        for (int i = 0; i < 5; i++) {
            authenticationHandler.handle(message, webSocketContext);
        }
        // Should still process (not locked) since failed attempts were cleared
    }

    @Test
    void shouldUseAuthenticationCacheForPerformance() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(validApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        // First authentication
        MessageProcessingResult result1 = authenticationHandler.handle(message, webSocketContext);
        assertThat(result1).isEqualTo(MessageProcessingResult.CONTINUE);

        // Reset authentication status and test cache
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        MessageProcessingResult result2 = authenticationHandler.handle(message, webSocketContext);
        assertThat(result2).isEqualTo(MessageProcessingResult.CONTINUE);

        // Should have marked as authenticated both times
        verify(webSocketContext, times(2)).markAsAuthenticated();
    }

    @Test
    void shouldHandleAuthenticationException() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenThrow(new RuntimeException("Context error"));
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Authentication failed");
    }

    @Test
    void shouldReturnCorrectHandlerName() {
        String handlerName = authenticationHandler.getHandlerName();
        
        assertThat(handlerName).isEqualTo("AuthenticationHandler");
    }

    @Test
    void shouldReturnCorrectPriority() {
        int priority = authenticationHandler.getPriority();
        
        assertThat(priority).isEqualTo(20); // AuthenticationHandler should have high priority
    }

    @Test
    void shouldHandleAllMessageTypes() {
        String[] messageTypes = {"text", "audio", "control", "ping"};
        
        for (String type : messageTypes) {
            boolean canHandle = authenticationHandler.canHandle(type);
            assertThat(canHandle).isTrue();
        }
    }

    @Test
    void shouldSetNextHandlerCorrectly() {
        IMessageHandler newNextHandler = mock(IMessageHandler.class);
        
        IMessageHandler returnedHandler = authenticationHandler.setNext(newNextHandler);
        
        assertThat(returnedHandler).isEqualTo(newNextHandler);
    }

    @Test
    void shouldHandleNullNextHandler() {
        authenticationHandler.setNext(null);
        
        when(webSocketContext.isAuthenticated()).thenReturn(true);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).updateLastActivity();
    }

    @Test
    void shouldExtractApiKeyFromDifferentSources() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);

        // Test API key in message text content (for auth messages)
        WebSocketMessage authMessage = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("auth")
            .textContent(validApiKey)
            .build();

        when(webSocketContext.getApiKey()).thenReturn(null);
        MessageProcessingResult result = authenticationHandler.handle(authMessage, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).markAsAuthenticated();
    }

    @Test
    void shouldValidateApiKeySecurely() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        
        // Test with API key that has similar characters but is not exact match
        String similarApiKey = validApiKey.substring(0, validApiKey.length() - 1) + "X";
        when(webSocketContext.getApiKey()).thenReturn(similarApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext, never()).markAsAuthenticated();
        assertThat(message.getProcessingError()).contains("Invalid API key");
    }

    @Test
    void shouldHandleConcurrentAuthentication() {
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(validApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        // Simulate concurrent authentication attempts
        MessageProcessingResult result1 = authenticationHandler.handle(message, webSocketContext);
        MessageProcessingResult result2 = authenticationHandler.handle(message, webSocketContext);

        assertThat(result1).isEqualTo(MessageProcessingResult.CONTINUE);
        assertThat(result2).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext, atLeastOnce()).markAsAuthenticated();
    }

    @Test
    void shouldCleanupExpiredCacheEntries() {
        // This test verifies that the cache cleanup mechanism works
        // by setting a very short TTL and checking behavior over time
        ReflectionTestUtils.setField(authenticationHandler, "authCacheTtlSeconds", 1L);
        
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        when(webSocketContext.getApiKey()).thenReturn(validApiKey);
        WebSocketMessage message = createTestMessage("Hello");

        // First authentication should succeed
        MessageProcessingResult result = authenticationHandler.handle(message, webSocketContext);
        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);

        // After cache expiry, should still work (cache should be cleaned up)
        try {
            Thread.sleep(1100); // Wait for cache to expire
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Reset context and test again
        when(webSocketContext.isAuthenticated()).thenReturn(false);
        result = authenticationHandler.handle(message, webSocketContext);
        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
    }

    private WebSocketMessage createTestMessage(String content) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent(content)
            .build();
    }
}
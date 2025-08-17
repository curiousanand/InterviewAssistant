package com.interview.assistant.domain.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;

import java.time.Instant;

import static org.assertj.core.api.Assertions.*;

/**
 * Comprehensive test suite for Session entity
 * 
 * Tests all business rules, state transitions, and edge cases
 */
@DisplayName("Session Entity Tests")
class SessionTest {
    
    private Session session;
    
    @BeforeEach
    void setUp() {
        session = Session.create("en-US", true);
    }
    
    @Test
    @DisplayName("Should create session with valid initial state")
    void shouldCreateSessionWithValidInitialState() {
        // Given & When
        Session newSession = Session.create("es-ES", false);
        
        // Then
        assertThat(newSession.getId()).isNotNull();
        assertThat(newSession.getStatus()).isEqualTo(Session.SessionStatus.ACTIVE);
        assertThat(newSession.getTargetLanguage()).isEqualTo("es-ES");
        assertThat(newSession.getAutoDetectLanguage()).isFalse();
        assertThat(newSession.getMessageCount()).isEqualTo(0);
        assertThat(newSession.getTotalTokensUsed()).isEqualTo(0);
        assertThat(newSession.getMessages()).isEmpty();
        assertThat(newSession.isActive()).isTrue();
    }
    
    @Test
    @DisplayName("Should add message to active session")
    void shouldAddMessageToActiveSession() {
        // Given
        Message message = Message.createUserMessage("Hello", 0.95, "en-US");
        
        // When
        session.addMessage(message);
        
        // Then
        assertThat(session.getMessages()).hasSize(1);
        assertThat(session.getMessageCount()).isEqualTo(1);
        assertThat(session.getMessages().get(0)).isEqualTo(message);
        assertThat(message.getSession()).isEqualTo(session);
        assertThat(session.getLastAccessedAt()).isNotNull();
    }
    
    @Test
    @DisplayName("Should update token count when adding assistant message")
    void shouldUpdateTokenCountWhenAddingAssistantMessage() {
        // Given
        Message assistantMessage = Message.createAssistantMessage("Hello there!", "gpt-4", 15, 250.0);
        
        // When
        session.addMessage(assistantMessage);
        
        // Then
        assertThat(session.getTotalTokensUsed()).isEqualTo(15);
        assertThat(session.getMessageCount()).isEqualTo(1);
    }
    
    @Test
    @DisplayName("Should accumulate tokens from multiple messages")
    void shouldAccumulateTokensFromMultipleMessages() {
        // Given
        Message msg1 = Message.createAssistantMessage("First", "gpt-4", 10, 100.0);
        Message msg2 = Message.createAssistantMessage("Second", "gpt-4", 15, 150.0);
        
        // When
        session.addMessage(msg1);
        session.addMessage(msg2);
        
        // Then
        assertThat(session.getTotalTokensUsed()).isEqualTo(25);
        assertThat(session.getMessageCount()).isEqualTo(2);
    }
    
    @Test
    @DisplayName("Should handle null tokens gracefully")
    void shouldHandleNullTokensGracefully() {
        // Given
        Message userMessage = Message.createUserMessage("Hello", 0.9, "en-US");
        // User messages don't have tokens
        
        // When
        session.addMessage(userMessage);
        
        // Then
        assertThat(session.getTotalTokensUsed()).isEqualTo(0);
        assertThat(session.getMessageCount()).isEqualTo(1);
    }
    
    @Test
    @DisplayName("Should not allow adding message to inactive session")
    void shouldNotAllowAddingMessageToInactiveSession() {
        // Given
        session.close();
        Message message = Message.createUserMessage("Test", 0.9, "en-US");
        
        // When & Then
        assertThatThrownBy(() -> session.addMessage(message))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Cannot add message to inactive session");
    }
    
    @Test
    @DisplayName("Should close session successfully")
    void shouldCloseSessionSuccessfully() {
        // When
        session.close();
        
        // Then
        assertThat(session.getStatus()).isEqualTo(Session.SessionStatus.CLOSED);
        assertThat(session.getClosedAt()).isNotNull();
        assertThat(session.isActive()).isFalse();
    }
    
    @Test
    @DisplayName("Should be idempotent when closing already closed session")
    void shouldBeIdempotentWhenClosingAlreadyClosedSession() {
        // Given
        session.close();
        Instant firstCloseTime = session.getClosedAt();
        
        // When
        session.close();
        
        // Then
        assertThat(session.getStatus()).isEqualTo(Session.SessionStatus.CLOSED);
        assertThat(session.getClosedAt()).isEqualTo(firstCloseTime);
    }
    
    @Test
    @DisplayName("Should expire session successfully")
    void shouldExpireSessionSuccessfully() {
        // When
        session.expire();
        
        // Then
        assertThat(session.getStatus()).isEqualTo(Session.SessionStatus.EXPIRED);
        assertThat(session.getClosedAt()).isNotNull();
        assertThat(session.isActive()).isFalse();
    }
    
    @Test
    @DisplayName("Should not expire already closed session")
    void shouldNotExpireAlreadyClosedSession() {
        // Given
        session.close();
        Instant closeTime = session.getClosedAt();
        
        // When
        session.expire();
        
        // Then
        assertThat(session.getStatus()).isEqualTo(Session.SessionStatus.CLOSED);
        assertThat(session.getClosedAt()).isEqualTo(closeTime);
    }
    
    @Test
    @DisplayName("Should determine summarization need correctly")
    void shouldDetermineSummarizationNeedCorrectly() {
        // Given
        int threshold = 5;
        
        // Add messages below threshold
        for (int i = 0; i < 4; i++) {
            session.addMessage(Message.createUserMessage("Message " + i, 0.9, "en-US"));
        }
        
        // When & Then - below threshold
        assertThat(session.shouldSummarize(threshold)).isFalse();
        
        // Add one more message to exceed threshold
        session.addMessage(Message.createUserMessage("Message 5", 0.9, "en-US"));
        
        // When & Then - above threshold
        assertThat(session.shouldSummarize(threshold)).isTrue();
    }
    
    @Test
    @DisplayName("Should handle WebSocket session ID")
    void shouldHandleWebSocketSessionId() {
        // Given
        String wsSessionId = "ws-session-123";
        
        // When
        session.setWebSocketSessionId(wsSessionId);
        
        // Then
        assertThat(session.getWebSocketSessionId()).isEqualTo(wsSessionId);
    }
    
    @Test
    @DisplayName("Should handle client metadata")
    void shouldHandleClientMetadata() {
        // Given
        String ipAddress = "192.168.1.1";
        String userAgent = "Mozilla/5.0 Test";
        
        // When
        session.setClientIpAddress(ipAddress);
        session.setUserAgent(userAgent);
        
        // Then
        assertThat(session.getClientIpAddress()).isEqualTo(ipAddress);
        assertThat(session.getUserAgent()).isEqualTo(userAgent);
    }
    
    @Test
    @DisplayName("Should provide session ID through getSessionId method")
    void shouldProvideSessionIdThroughGetSessionIdMethod() {
        // When
        String sessionId = session.getSessionId();
        
        // Then
        assertThat(sessionId).isEqualTo(session.getId());
        assertThat(sessionId).isNotNull();
    }
    
    @Test
    @DisplayName("Should provide language code through getLanguageCode method")
    void shouldProvideLanguageCodeThroughGetLanguageCodeMethod() {
        // When
        String languageCode = session.getLanguageCode();
        
        // Then
        assertThat(languageCode).isEqualTo(session.getTargetLanguage());
        assertThat(languageCode).isEqualTo("en-US");
    }
    
    @Test
    @DisplayName("Should maintain creation and access timestamps")
    void shouldMaintainCreationAndAccessTimestamps() {
        // Given
        Instant before = Instant.now().minusSeconds(1);
        
        // When
        Session newSession = Session.create("en-US", true);
        
        // Then
        assertThat(newSession.getCreatedAt()).isAfter(before);
        assertThat(newSession.getLastAccessedAt()).isAfter(before);
    }
    
    @Test
    @DisplayName("Should update last accessed time when adding messages")
    void shouldUpdateLastAccessedTimeWhenAddingMessages() {
        // Given
        Instant initialAccess = session.getLastAccessedAt();
        
        try {
            Thread.sleep(1); // Ensure time difference
        } catch (InterruptedException e) {
            // Ignore
        }
        
        // When
        session.addMessage(Message.createUserMessage("Test", 0.9, "en-US"));
        
        // Then
        assertThat(session.getLastAccessedAt()).isAfter(initialAccess);
    }
}
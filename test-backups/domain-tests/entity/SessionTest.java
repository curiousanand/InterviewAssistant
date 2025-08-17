package com.interview.assistant.domain.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.assertj.core.api.Assertions.*;
import java.time.LocalDateTime;
import java.util.UUID;

class SessionTest {

    private Session session;

    @BeforeEach
    void setUp() {
        session = new Session();
        session.setId(UUID.randomUUID().toString());
        session.setStartTime(LocalDateTime.now());
        session.setLastActivity(LocalDateTime.now());
        session.setStatus("active");
    }

    @Test
    void shouldCreateSessionWithValidId() {
        String sessionId = UUID.randomUUID().toString();
        session.setId(sessionId);
        
        assertThat(session.getId()).isEqualTo(sessionId);
    }

    @Test
    void shouldSetAndGetStartTime() {
        LocalDateTime startTime = LocalDateTime.now();
        session.setStartTime(startTime);
        
        assertThat(session.getStartTime()).isEqualTo(startTime);
    }

    @Test
    void shouldSetAndGetLastActivity() {
        LocalDateTime lastActivity = LocalDateTime.now();
        session.setLastActivity(lastActivity);
        
        assertThat(session.getLastActivity()).isEqualTo(lastActivity);
    }

    @Test
    void shouldSetAndGetStatus() {
        session.setStatus("idle");
        
        assertThat(session.getStatus()).isEqualTo("idle");
    }

    @Test
    void shouldSetAndGetUserId() {
        String userId = "user123";
        session.setUserId(userId);
        
        assertThat(session.getUserId()).isEqualTo(userId);
    }

    @Test
    void shouldSetAndGetLanguage() {
        String language = "en-US";
        session.setLanguage(language);
        
        assertThat(session.getLanguage()).isEqualTo(language);
    }

    @Test
    void shouldValidateSessionStatus() {
        // Test valid statuses
        session.setStatus("active");
        assertThat(session.getStatus()).isEqualTo("active");
        
        session.setStatus("idle");
        assertThat(session.getStatus()).isEqualTo("idle");
        
        session.setStatus("closed");
        assertThat(session.getStatus()).isEqualTo("closed");
    }

    @Test
    void shouldUpdateLastActivityWhenSessionIsActive() {
        LocalDateTime originalActivity = session.getLastActivity();
        
        // Simulate some delay
        try {
            Thread.sleep(10);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        session.setLastActivity(LocalDateTime.now());
        
        assertThat(session.getLastActivity()).isAfter(originalActivity);
    }

    @Test
    void shouldHandleNullValues() {
        session.setUserId(null);
        session.setLanguage(null);
        
        assertThat(session.getUserId()).isNull();
        assertThat(session.getLanguage()).isNull();
    }
}
package com.interview.assistant;

import com.interview.assistant.model.Message;
import com.interview.assistant.model.Session;
import com.interview.assistant.repository.IMessageRepository;
import com.interview.assistant.repository.ISessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Simple integration test to verify test framework and basic functionality
 * <p>
 * Why: Validates that test/production separation is working correctly
 * Pattern: Integration test with minimal dependencies
 * Rationale: Proves the refactoring successfully separated concerns
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@ActiveProfiles("test")
class SimpleIntegrationTest {

    @Autowired
    private ISessionRepository sessionRepository;

    @Autowired
    private IMessageRepository messageRepository;

    @Test
    void contextLoads() {
        // Test that Spring context loads successfully with test profile
        assertThat(sessionRepository).isNotNull();
        assertThat(messageRepository).isNotNull();
    }

    @Test
    void canCreateAndSaveSession() {
        // Test basic session creation and persistence
        Session session = Session.create("en-US", true);
        assertThat(session).isNotNull();
        assertThat(session.getId()).isNotNull();
        assertThat(session.isActive()).isTrue();

        Session savedSession = sessionRepository.save(session);
        assertThat(savedSession.getId()).isEqualTo(session.getId());

        // Verify we can retrieve it
        var retrieved = sessionRepository.findById(savedSession.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getId()).isEqualTo(savedSession.getId());
    }

    @Test
    void canCreateAndSaveMessage() {
        // Test basic message creation and persistence
        Message message = Message.createUserMessage("Hello world", 0.95, "en-US");
        assertThat(message).isNotNull();
        assertThat(message.getId()).isNotNull();
        assertThat(message.getContent()).isEqualTo("Hello world");
        assertThat(message.getConfidence()).isEqualTo(0.95);

        Message savedMessage = messageRepository.save(message);
        assertThat(savedMessage.getId()).isEqualTo(message.getId());

        // Verify we can retrieve it
        var retrieved = messageRepository.findById(savedMessage.getId());
        assertThat(retrieved).isPresent();
        assertThat(retrieved.get().getContent()).isEqualTo("Hello world");
    }

    @Test
    void sessionAndMessageWorkTogether() {
        // Test session and message relationship
        Session session = Session.create("en-US", true);
        Session savedSession = sessionRepository.save(session);

        Message message = Message.createUserMessage("Test message", 0.9, "en-US");
        message.setSession(savedSession);
        Message savedMessage = messageRepository.save(message);

        // Add message to session
        savedSession.addMessage(savedMessage);
        sessionRepository.save(savedSession);

        // Verify relationship
        assertThat(savedSession.getMessageCount()).isEqualTo(1);
        assertThat(savedSession.getMessages()).hasSize(1);
        assertThat(savedSession.getMessages().get(0).getContent()).isEqualTo("Test message");
    }
}
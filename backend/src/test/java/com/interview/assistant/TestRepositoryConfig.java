package com.interview.assistant;

import com.interview.assistant.repository.IMessageRepository;
import com.interview.assistant.repository.ISessionRepository;
import com.interview.assistant.repository.MessageRepositoryImpl;
import com.interview.assistant.repository.SessionRepositoryImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Test repository configuration
 * <p>
 * Why: Provides repository implementations for test profile
 * Pattern: Spring configuration for test-specific beans
 * Rationale: Enables testing with in-memory repositories
 */
@Configuration
@Profile("test")
public class TestRepositoryConfig {

    @Bean
    @Profile("test")
    public ISessionRepository sessionRepository() {
        return new SessionRepositoryImpl();
    }

    @Bean
    @Profile("test")
    public IMessageRepository messageRepository() {
        return new MessageRepositoryImpl();
    }
}
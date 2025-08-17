package com.interview.assistant;

import com.interview.assistant.domain.repository.ISessionRepository;
import com.interview.assistant.domain.repository.IMessageRepository;
import com.interview.assistant.infrastructure.repository.SessionRepositoryImpl;
import com.interview.assistant.infrastructure.repository.MessageRepositoryImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * Test repository configuration
 * 
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
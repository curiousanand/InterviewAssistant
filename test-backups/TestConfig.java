package com.interview.assistant;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.mockito.Mockito;

import com.interview.assistant.application.service.MockTranscriptionService;
import com.interview.assistant.application.service.MockAIService;
import com.interview.assistant.domain.service.ITranscriptionService;
import com.interview.assistant.domain.service.IAIService;

@TestConfiguration
public class TestConfig {

    @Bean
    @Primary
    public ITranscriptionService mockTranscriptionService() {
        return new MockTranscriptionService();
    }

    @Bean
    @Primary
    public IAIService mockAIService() {
        return new MockAIService();
    }
}
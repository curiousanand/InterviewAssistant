package com.interview.assistant.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Mock implementation of IAIService for development and testing
 * 
 * Why: Enables application startup without external service dependencies
 * Pattern: Mock Object - provides fake implementation for development
 * Rationale: Allows testing of application flow without Azure OpenAI Services
 */
@Service
@Profile("!test")
public class MockAIService implements IAIService {
    
    @Override
    public CompletableFuture<AIResponse> generateResponse(String sessionId, String userMessage, String language) {
        return CompletableFuture.completedFuture(new MockAIResponse(
            "Mock AI response to: " + userMessage,
            150,
            500.0,
            "mock-gpt-4",
            true,
            null
        ));
    }
    
    @Override
    public CompletableFuture<AIResponse> generateStreamingResponse(String sessionId, String userMessage, 
                                                                   String language, StreamingCallback callback) {
        // Simulate streaming with mock data
        CompletableFuture.runAsync(() -> {
            try {
                String[] words = "Mock streaming AI response to your question".split(" ");
                for (String word : words) {
                    callback.onToken(word + " ");
                    Thread.sleep(100); // Simulate streaming delay
                }
                callback.onComplete(new MockAIResponse(
                    "Mock streaming AI response to your question",
                    words.length,
                    600.0,
                    "mock-gpt-4",
                    true,
                    null
                ));
            } catch (InterruptedException e) {
                callback.onError("Streaming interrupted: " + e.getMessage());
            }
        });
        
        return CompletableFuture.completedFuture(new MockAIResponse(
            "Mock streaming AI response to your question",
            7,
            600.0,
            "mock-gpt-4",
            true,
            null
        ));
    }
    
    @Override
    public CompletableFuture<String> summarizeConversation(String sessionId, List<String> messages) {
        return CompletableFuture.completedFuture(
            "Mock summary of conversation with " + messages.size() + " messages in session " + sessionId
        );
    }
    
    @Override
    public boolean isServiceAvailable() {
        return true;
    }
    
    @Override
    public ServiceConfiguration getConfiguration() {
        return new MockServiceConfiguration();
    }
    
    // Mock implementations of inner interfaces
    
    private static class MockAIResponse implements AIResponse {
        private final String content;
        private final int tokensUsed;
        private final double processingTimeMs;
        private final String model;
        private final boolean success;
        private final String errorMessage;
        
        public MockAIResponse(String content, int tokensUsed, double processingTimeMs, 
                             String model, boolean success, String errorMessage) {
            this.content = content;
            this.tokensUsed = tokensUsed;
            this.processingTimeMs = processingTimeMs;
            this.model = model;
            this.success = success;
            this.errorMessage = errorMessage;
        }
        
        @Override
        public String getContent() { return content; }
        @Override
        public int getTokensUsed() { return tokensUsed; }
        @Override
        public double getProcessingTimeMs() { return processingTimeMs; }
        @Override
        public String getModel() { return model; }
        @Override
        public boolean isSuccess() { return success; }
        @Override
        public String getErrorMessage() { return errorMessage; }
    }
    
    private static class MockServiceConfiguration implements ServiceConfiguration {
        @Override
        public String getProviderName() { return "Mock AI Service"; }
        @Override
        public String getModel() { return "mock-gpt-4"; }
        @Override
        public int getMaxTokens() { return 4000; }
        @Override
        public double getTemperature() { return 0.7; }
        @Override
        public String getEndpoint() { return "http://mock-ai-service"; }
    }
}
package com.interview.assistant.service;

import java.util.concurrent.CompletableFuture;

/**
 * AI Service interface for generating intelligent responses
 * 
 * Why: Abstracts AI service implementations for flexible provider switching
 * Pattern: Strategy pattern - allows different AI providers
 * Rationale: Enables testing with mock implementations and provider independence
 */
public interface IAIService {
    
    /**
     * Generate response for user message
     * Why: Primary AI interaction for conversation responses
     * 
     * @param sessionId Session identifier for context
     * @param userMessage User's message content
     * @param language Detected or target language
     * @return Future containing AI response
     */
    CompletableFuture<AIResponse> generateResponse(String sessionId, String userMessage, String language);
    
    /**
     * Generate streaming response for real-time interaction
     * Why: Enables real-time response streaming for better UX
     * 
     * @param sessionId Session identifier for context
     * @param userMessage User's message content
     * @param language Detected or target language
     * @param callback Callback for streaming response tokens
     * @return Future containing complete response
     */
    CompletableFuture<AIResponse> generateStreamingResponse(String sessionId, String userMessage, 
                                                          String language, StreamingCallback callback);
    
    /**
     * Get conversation summary for context management
     * Why: Manage conversation context length and memory
     * 
     * @param sessionId Session identifier
     * @param messages List of messages to summarize
     * @return Future containing summary
     */
    CompletableFuture<String> summarizeConversation(String sessionId, java.util.List<String> messages);
    
    /**
     * Check if service is available
     * Why: Health checking and failover support
     * 
     * @return True if service is responsive
     */
    boolean isServiceAvailable();
    
    /**
     * Get service configuration
     * Why: Service introspection and monitoring
     * 
     * @return Service configuration information
     */
    ServiceConfiguration getConfiguration();
    
    /**
     * AI Response value object
     */
    interface AIResponse {
        String getContent();
        int getTokensUsed();
        double getProcessingTimeMs();
        String getModel();
        boolean isSuccess();
        String getErrorMessage();
    }
    
    /**
     * Streaming callback interface for real-time responses
     */
    interface StreamingCallback {
        void onToken(String token);
        void onComplete(AIResponse response);
        void onError(String error);
    }
    
    /**
     * Service configuration value object
     */
    interface ServiceConfiguration {
        String getProviderName();
        String getModel();
        int getMaxTokens();
        double getTemperature();
        String getEndpoint();
    }
}
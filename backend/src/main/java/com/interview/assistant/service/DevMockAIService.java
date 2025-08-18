package com.interview.assistant.service;

import com.interview.assistant.model.ConversationMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Mock implementation of IAIService for development profile
 * <p>
 * Why: Enables application startup without external service dependencies
 * Pattern: Mock Object - provides fake implementation for development
 * Rationale: Allows testing of application flow without Azure OpenAI Services
 */
@Service
@Profile("dev")
public class DevMockAIService implements IAIService {

    private static final Logger logger = LoggerFactory.getLogger(DevMockAIService.class);

    @Override
    public CompletableFuture<AIResponse> generateResponse(String sessionId, String prompt, String language) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Generating mock AI response for session: {} in language: {}", sessionId, language);
            
            // Simulate processing time
            try {
                Thread.sleep(500 + (int) (Math.random() * 1500)); // 500ms - 2s
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            String mockResponse = generateMockResponse(prompt, language);
            
            return new MockAIResponse(
                    mockResponse,
                    "mock-ai-model-v1.0",
                    estimateTokenCount(mockResponse),
                    System.currentTimeMillis() - 1000,
                    true,
                    null
            );
        });
    }

    @Override
    public CompletableFuture<AIResponse> generateStreamingResponse(String sessionId, String prompt, String language, StreamingCallback callback) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Generating mock streaming AI response for session: {}", sessionId);
            
            try {
                String fullResponse = generateMockResponse(prompt, language);
                
                // Simulate streaming by sending response word by word
                String[] words = fullResponse.split(" ");
                
                for (String word : words) {
                    callback.onToken(word + " ");
                    
                    // Simulate realistic streaming delay
                    Thread.sleep(100 + (int) (Math.random() * 200));
                }
                
                MockAIResponse response = new MockAIResponse(
                        fullResponse,
                        "mock-ai-streaming-v1.0",
                        estimateTokenCount(fullResponse),
                        System.currentTimeMillis() - 2000,
                        true,
                        null
                );
                
                callback.onComplete(response);
                
                return response;
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                callback.onError("Streaming interrupted");
                return new MockAIResponse("", "mock-ai-model-v1.0", 0, 0, false, "Streaming interrupted");
            } catch (Exception e) {
                callback.onError("Streaming error: " + e.getMessage());
                return new MockAIResponse("", "mock-ai-model-v1.0", 0, 0, false, e.getMessage());
            }
        });
    }

    @Override
    public CompletableFuture<Void> generateStreamingResponse(ChatRequest request, StreamingCallback callback) {
        return CompletableFuture.runAsync(() -> {
            logger.info("Generating mock streaming response for chat request with {} messages", request.getMessageCount());
            
            try {
                // Create context from conversation messages
                StringBuilder contextBuilder = new StringBuilder();
                contextBuilder.append(request.getSystemPrompt()).append(" ");
                
                for (ConversationMessage msg : request.getMessages()) {
                    contextBuilder.append(msg.getContent()).append(" ");
                }
                
                String prompt = contextBuilder.toString().trim();
                String response = generateMockResponse(prompt, "en-US");
                
                // Stream response
                String[] words = response.split(" ");
                for (String word : words) {
                    callback.onToken(word + " ");
                    Thread.sleep(80 + (int) (Math.random() * 120));
                }
                
                MockAIResponse aiResponse = new MockAIResponse(
                        response,
                        request.getModel(),
                        estimateTokenCount(response),
                        System.currentTimeMillis() - 1500,
                        true,
                        null
                );
                
                callback.onComplete(aiResponse);
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                callback.onError("Streaming interrupted");
            } catch (Exception e) {
                callback.onError("Chat streaming error: " + e.getMessage());
            }
        });
    }

    @Override
    public CompletableFuture<String> summarizeConversation(String sessionId, List<String> messages) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Generating mock conversation summary for session: {} with {} messages", sessionId, messages.size());
            
            if (messages.isEmpty()) {
                return "No conversation to summarize.";
            }
            
            // Simple mock summarization
            int totalLength = messages.stream().mapToInt(String::length).sum();
            String firstMessage = messages.get(0);
            String lastMessage = messages.get(messages.size() - 1);
            
            return String.format("Conversation summary (%d messages, %d characters): Started with '%s...' and ended with '%s...'", 
                    messages.size(), 
                    totalLength,
                    firstMessage.substring(0, Math.min(30, firstMessage.length())),
                    lastMessage.substring(0, Math.min(30, lastMessage.length())));
        });
    }

    @Override
    public boolean isServiceAvailable() {
        return true; // Mock service is always available
    }

    @Override
    public ServiceConfiguration getConfiguration() {
        return new ServiceConfiguration() {
            @Override
            public String getProviderName() { return "Mock AI Service"; }
            
            @Override
            public String getModel() { return "mock-ai-model-v1.0"; }
            
            @Override
            public int getMaxTokens() { return 2000; }
            
            @Override
            public double getTemperature() { return 0.7; }
            
            @Override
            public String getEndpoint() { return "http://localhost:mock"; }
        };
    }

    /**
     * Generate contextually appropriate mock responses
     */
    private String generateMockResponse(String prompt, String language) {
        if (prompt == null || prompt.trim().isEmpty()) {
            return getLocalizedResponse("I'm sorry, I didn't understand that. Could you please repeat?", language);
        }

        // Simple pattern matching for more realistic responses
        String lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.contains("hello") || lowerPrompt.contains("hi") || lowerPrompt.contains("hey")) {
            return getLocalizedResponse("Hello! How can I help you today?", language);
        } else if (lowerPrompt.contains("how are you") || lowerPrompt.contains("how do you do")) {
            return getLocalizedResponse("I'm doing well, thank you! I'm here to help with any questions you have.", language);
        } else if (lowerPrompt.contains("what") || lowerPrompt.contains("explain") || lowerPrompt.contains("tell me")) {
            return getLocalizedResponse("That's an interesting question! While I'm just a mock AI service for development, I can see you asked about: " + prompt.substring(0, Math.min(50, prompt.length())) + "...", language);
        } else if (lowerPrompt.contains("weather")) {
            return getLocalizedResponse("I'm a mock service, so I can't check real weather data. But I'd say it's a perfect day for coding!", language);
        } else {
            return getLocalizedResponse("Thank you for your input: '" + prompt.substring(0, Math.min(100, prompt.length())) + "'. This is a mock AI response for development purposes.", language);
        }
    }

    /**
     * Get localized response based on language
     */
    private String getLocalizedResponse(String englishResponse, String language) {
        // Simple localization for common languages
        return switch (language) {
            case "hi-IN" -> "यह एक डेवलपमेंट मॉक AI सेवा है। " + englishResponse;
            case "es-ES" -> "Este es un servicio AI mock para desarrollo. " + englishResponse;
            case "fr-FR" -> "Ceci est un service IA fictif pour le développement. " + englishResponse;
            case "de-DE" -> "Dies ist ein Mock-AI-Dienst für die Entwicklung. " + englishResponse;
            case "zh-CN" -> "这是一个用于开发的模拟AI服务。" + englishResponse;
            default -> englishResponse;
        };
    }

    /**
     * Estimate token count for response
     */
    private int estimateTokenCount(String text) {
        if (text == null) return 0;
        // Rough estimation: ~4 characters per token
        return Math.max(1, text.length() / 4);
    }

    /**
     * Mock AI Response implementation
     */
    private static class MockAIResponse implements AIResponse {
        private final String content;
        private final String model;
        private final int tokensUsed;
        private final double processingTimeMs;
        private final boolean success;
        private final String errorMessage;

        public MockAIResponse(String content, String model, int tokensUsed, double processingTimeMs, 
                             boolean success, String errorMessage) {
            this.content = content;
            this.model = model;
            this.tokensUsed = tokensUsed;
            this.processingTimeMs = processingTimeMs;
            this.success = success;
            this.errorMessage = errorMessage;
        }

        @Override
        public String getContent() { return content; }

        @Override
        public String getModel() { return model; }

        @Override
        public int getTokensUsed() { return tokensUsed; }

        @Override
        public double getProcessingTimeMs() { return processingTimeMs; }

        @Override
        public boolean isSuccess() { return success; }

        @Override
        public String getErrorMessage() { return errorMessage; }
    }
}
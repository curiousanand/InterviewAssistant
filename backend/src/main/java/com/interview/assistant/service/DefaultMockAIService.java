package com.interview.assistant.service;

import com.interview.assistant.model.ConversationMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Default mock implementation of IAIService for development and testing
 * 
 * Why: Enables application startup without external service dependencies
 * Pattern: Mock Object - provides fake implementation for development
 * Rationale: Allows testing of application flow without Azure OpenAI Services
 */
@Service
@Primary
public class DefaultMockAIService implements IAIService {

    private static final Logger logger = LoggerFactory.getLogger(DefaultMockAIService.class);

    @Override
    public CompletableFuture<AIResponse> generateResponse(String sessionId, String userMessage, String language) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Generating mock AI response for session: {} in language: {}", sessionId, language);
            
            // Simulate processing time
            try {
                Thread.sleep(500 + (int) (Math.random() * 1000)); // 500ms - 1.5s
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            String mockResponse = generateMockResponse(userMessage, language);
            
            return new MockAIResponse(
                    mockResponse,
                    estimateTokenCount(mockResponse),
                    1000.0,
                    "mock-ai-model-v1.0",
                    true,
                    null
            );
        });
    }

    @Override
    public CompletableFuture<AIResponse> generateStreamingResponse(String sessionId, String userMessage, 
                                                                   String language, StreamingCallback callback) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Generating streaming mock AI response for session: {} in language: {}", sessionId, language);
            
            String fullResponse = generateMockResponse(userMessage, language);
            String[] words = fullResponse.split(" ");
            
            // Simulate streaming by sending words one by one
            for (int i = 0; i < words.length; i++) {
                String token = words[i];
                if (i > 0) token = " " + token;
                
                callback.onToken(token);
                
                try {
                    Thread.sleep(50 + (int) (Math.random() * 100)); // 50-150ms per word
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            MockAIResponse response = new MockAIResponse(
                    fullResponse,
                    estimateTokenCount(fullResponse),
                    System.currentTimeMillis(),
                    "mock-ai-model-v1.0",
                    true,
                    null
            );
            
            callback.onComplete(response);
            return response;
        });
    }

    @Override
    public CompletableFuture<Void> generateStreamingResponse(ChatRequest request, StreamingCallback callback) {
        return CompletableFuture.runAsync(() -> {
            logger.info("Processing chat request with {} messages", request.getMessages().size());
            
            // Extract latest user message
            String userMessage = "";
            for (ConversationMessage msg : request.getMessages()) {
                if ("user".equals(msg.getRole())) {
                    userMessage = msg.getContent();
                }
            }
            
            String fullResponse = generateMockResponse(userMessage, "en-US");
            String[] words = fullResponse.split(" ");
            
            // Simulate streaming
            for (int i = 0; i < words.length; i++) {
                String token = words[i];
                if (i > 0) token = " " + token;
                
                callback.onToken(token);
                
                try {
                    Thread.sleep(50 + (int) (Math.random() * 100));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            MockAIResponse response = new MockAIResponse(
                    fullResponse,
                    estimateTokenCount(fullResponse),
                    System.currentTimeMillis(),
                    "mock-ai-model-v1.0",
                    true,
                    null
            );
            
            callback.onComplete(response);
        });
    }

    @Override
    public CompletableFuture<String> summarizeConversation(String sessionId, List<String> messages) {
        return CompletableFuture.supplyAsync(() -> {
            logger.info("Mock summarizing conversation for session: {} with {} messages", sessionId, messages.size());
            
            if (messages.isEmpty()) {
                return "No conversation to summarize.";
            }
            
            return String.format("Mock summary: The conversation covered %d messages discussing various topics. " +
                               "Key themes included user questions and AI responses.", messages.size());
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
            public String getProviderName() {
                return "Mock AI Provider";
            }

            @Override
            public String getModel() {
                return "mock-ai-model-v1.0";
            }

            @Override
            public int getMaxTokens() {
                return 1000;
            }

            @Override
            public double getTemperature() {
                return 0.7;
            }

            @Override
            public String getEndpoint() {
                return "localhost://mock-ai-service";
            }
        };
    }

    /**
     * Generate context-appropriate mock responses
     */
    private String generateMockResponse(String userMessage, String language) {
        if (userMessage == null || userMessage.trim().isEmpty()) {
            return "I'm here to help! What would you like to know?";
        }
        
        String lowercaseMessage = userMessage.toLowerCase();
        
        // Context-aware responses
        if (lowercaseMessage.contains("hello") || lowercaseMessage.contains("hi")) {
            return "Hello! It's great to meet you. How can I assist you today?";
        } else if (lowercaseMessage.contains("how are you") || lowercaseMessage.contains("how do you do")) {
            return "I'm doing well, thank you for asking! I'm here and ready to help with any questions or tasks you have.";
        } else if (lowercaseMessage.contains("weather")) {
            return "I'd be happy to help with weather information! While I can't access real-time weather data in this mock mode, " +
                   "I can tell you that it's always a good idea to check your local weather forecast before planning outdoor activities.";
        } else if (lowercaseMessage.contains("time")) {
            return "I understand you're asking about time. In this mock mode, I can't provide the exact current time, " +
                   "but I'm always here whenever you need assistance!";
        } else if (lowercaseMessage.contains("help")) {
            return "I'm here to help you! I can assist with answering questions, providing information, " +
                   "having conversations, and helping with various tasks. What specifically would you like help with?";
        } else if (lowercaseMessage.contains("thank")) {
            return "You're very welcome! I'm glad I could help. Feel free to ask if you have any other questions.";
        } else {
            return String.format("That's an interesting point about \"%s\". I'd be happy to discuss this topic further with you. " +
                               "Could you tell me more about what specifically interests you about this?", 
                               userMessage.length() > 50 ? userMessage.substring(0, 50) + "..." : userMessage);
        }
    }

    /**
     * Estimate token count (rough approximation: 4 characters per token)
     */
    private int estimateTokenCount(String text) {
        return text.length() / 4;
    }

    /**
     * Mock AI Response implementation
     */
    public static class MockAIResponse implements AIResponse {
        private final String content;
        private final int tokensUsed;
        private final double processingTimeMs;
        private final String model;
        private final boolean success;
        private final String errorMessage;

        public MockAIResponse(String content, int tokensUsed, double processingTimeMs, 
                             String model, boolean success, String errorMessage) {
            this.content = content != null ? content : "";
            this.tokensUsed = tokensUsed;
            this.processingTimeMs = processingTimeMs;
            this.model = model != null ? model : "mock-ai-model";
            this.success = success;
            this.errorMessage = errorMessage;
        }

        @Override
        public String getContent() {
            return content;
        }

        @Override
        public int getTokensUsed() {
            return tokensUsed;
        }

        @Override
        public double getProcessingTimeMs() {
            return processingTimeMs;
        }

        @Override
        public String getModel() {
            return model;
        }

        @Override
        public boolean isSuccess() {
            return success;
        }

        @Override
        public String getErrorMessage() {
            return errorMessage;
        }

        @Override
        public String toString() {
            return String.format("MockAIResponse{content='%s', tokens=%d, time=%.1fms, model='%s', success=%s}",
                    content.length() > 50 ? content.substring(0, 50) + "..." : content,
                    tokensUsed, processingTimeMs, model, success);
        }
    }
}
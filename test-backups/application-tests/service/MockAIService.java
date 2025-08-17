package com.interview.assistant.application.service;

import com.interview.assistant.domain.service.IAIService;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class MockAIService implements IAIService {

    private final List<String> mockResponses = Arrays.asList(
        "Hello! How can I help you today?",
        "That's an interesting question. Let me think about that.",
        "Based on your question, I would suggest...",
        "I understand your concern. Here's what I think:",
        "Thank you for asking. The answer is..."
    );

    @Override
    public CompletableFuture<String> generateResponse(String userMessage, String conversationContext) {
        return CompletableFuture.supplyAsync(() -> {
            // Simulate processing delay
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            // Return mock response based on message content
            if (userMessage.toLowerCase().contains("hello")) {
                return "Hello! How can I help you today?";
            } else if (userMessage.toLowerCase().contains("help")) {
                return "I'm here to help you with any questions you might have.";
            } else if (userMessage.toLowerCase().contains("question")) {
                return "That's a great question! Let me provide you with a comprehensive answer.";
            } else {
                // Return a random mock response
                int index = userMessage.length() % mockResponses.size();
                return mockResponses.get(index);
            }
        });
    }

    @Override
    public Flux<String> generateResponseStream(String userMessage, String conversationContext) {
        String response = generateMockResponse(userMessage);
        String[] words = response.split(" ");
        
        return Flux.fromArray(words)
            .delayElements(Duration.ofMillis(100))
            .map(word -> word + " ");
    }

    @Override
    public CompletableFuture<String> summarizeConversation(List<String> messages) {
        return CompletableFuture.supplyAsync(() -> {
            if (messages.isEmpty()) {
                return "No conversation to summarize.";
            }
            
            return String.format("Conversation summary: %d messages exchanged covering various topics.", messages.size());
        });
    }

    @Override
    public CompletableFuture<Double> estimateResponseComplexity(String userMessage) {
        return CompletableFuture.supplyAsync(() -> {
            // Mock complexity based on message length and content
            double complexity = 0.5; // Base complexity
            
            if (userMessage.length() > 100) {
                complexity += 0.2;
            }
            
            if (userMessage.contains("?")) {
                complexity += 0.1;
            }
            
            if (userMessage.toLowerCase().contains("explain") || 
                userMessage.toLowerCase().contains("describe")) {
                complexity += 0.2;
            }
            
            return Math.min(complexity, 1.0);
        });
    }

    @Override
    public boolean isServiceAvailable() {
        return true;
    }

    private String generateMockResponse(String userMessage) {
        if (userMessage.toLowerCase().contains("hello")) {
            return "Hello! How can I help you today?";
        } else if (userMessage.toLowerCase().contains("help")) {
            return "I'm here to help you with any questions you might have.";
        } else if (userMessage.toLowerCase().contains("question")) {
            return "That's a great question! Let me provide you with a comprehensive answer.";
        } else {
            int index = userMessage.length() % mockResponses.size();
            return mockResponses.get(index);
        }
    }
}
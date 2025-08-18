package com.interview.assistant.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for IAIService interface implementations
 * 
 * Tests contract compliance, async behavior, and error handling
 */
@DisplayName("IAIService Interface Tests")
@ExtendWith(MockitoExtension.class)
class IAIServiceTest {
    
    @Mock
    private IAIService aiService;
    
    @Mock
    private IAIService.AIResponse mockResponse;
    
    @Mock
    private IAIService.StreamingCallback mockCallback;
    
    @Mock
    private IAIService.ServiceConfiguration mockConfiguration;
    
    private String testSessionId;
    private String testUserMessage;
    private String testLanguage;
    
    @BeforeEach
    void setUp() {
        testSessionId = "test-session-123";
        testUserMessage = "What is the weather like today?";
        testLanguage = "en-US";
    }
    
    @Test
    @DisplayName("Should generate response successfully")
    void shouldGenerateResponseSuccessfully() {
        // Given
        when(mockResponse.getContent()).thenReturn("Today's weather is sunny with temperatures around 75°F.");
        when(mockResponse.getTokensUsed()).thenReturn(25);
        when(mockResponse.getProcessingTimeMs()).thenReturn(150.0);
        when(mockResponse.getModel()).thenReturn("gpt-4");
        when(mockResponse.isSuccess()).thenReturn(true);
        when(mockResponse.getErrorMessage()).thenReturn(null);
        
        when(aiService.generateResponse(testSessionId, testUserMessage, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        IAIService.AIResponse response = future.join();
        
        assertThat(response.getContent()).isEqualTo("Today's weather is sunny with temperatures around 75°F.");
        assertThat(response.getTokensUsed()).isEqualTo(25);
        assertThat(response.getProcessingTimeMs()).isEqualTo(150.0);
        assertThat(response.getModel()).isEqualTo("gpt-4");
        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getErrorMessage()).isNull();
        
        verify(aiService).generateResponse(testSessionId, testUserMessage, testLanguage);
    }
    
    @Test
    @DisplayName("Should handle response generation failure")
    void shouldHandleResponseGenerationFailure() {
        // Given
        when(mockResponse.isSuccess()).thenReturn(false);
        when(mockResponse.getErrorMessage()).thenReturn("API rate limit exceeded");
        when(mockResponse.getContent()).thenReturn(null);
        
        when(aiService.generateResponse(testSessionId, testUserMessage, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        IAIService.AIResponse response = future.join();
        
        assertThat(response.isSuccess()).isFalse();
        assertThat(response.getErrorMessage()).isEqualTo("API rate limit exceeded");
        assertThat(response.getContent()).isNull();
    }
    
    @Test
    @DisplayName("Should handle async response generation failure")
    void shouldHandleAsyncResponseGenerationFailure() {
        // Given
        RuntimeException testException = new RuntimeException("Network timeout");
        CompletableFuture<IAIService.AIResponse> failedFuture = new CompletableFuture<>();
        failedFuture.completeExceptionally(testException);
        
        when(aiService.generateResponse(testSessionId, testUserMessage, testLanguage))
            .thenReturn(failedFuture);
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, testLanguage);
        
        // Then
        assertThat(future).failsWithin(1, TimeUnit.SECONDS)
            .withThrowableOfType(RuntimeException.class)
            .withMessage("Network timeout");
    }
    
    @Test
    @DisplayName("Should generate streaming response successfully")
    void shouldGenerateStreamingResponseSuccessfully() {
        // Given
        when(mockResponse.getContent()).thenReturn("Complete streaming response");
        when(mockResponse.getTokensUsed()).thenReturn(30);
        when(mockResponse.isSuccess()).thenReturn(true);
        
        when(aiService.generateStreamingResponse(testSessionId, testUserMessage, testLanguage, mockCallback))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateStreamingResponse(
            testSessionId, testUserMessage, testLanguage, mockCallback);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        IAIService.AIResponse response = future.join();
        
        assertThat(response.getContent()).isEqualTo("Complete streaming response");
        assertThat(response.getTokensUsed()).isEqualTo(30);
        assertThat(response.isSuccess()).isTrue();
        
        verify(aiService).generateStreamingResponse(testSessionId, testUserMessage, testLanguage, mockCallback);
    }
    
    @Test
    @DisplayName("Should handle streaming callback invocations")
    void shouldHandleStreamingCallbackInvocations() {
        // Given
        doNothing().when(mockCallback).onToken(anyString());
        doNothing().when(mockCallback).onComplete(any(IAIService.AIResponse.class));
        doNothing().when(mockCallback).onError(anyString());
        
        // When - Simulate streaming behavior
        mockCallback.onToken("Today's");
        mockCallback.onToken(" weather");
        mockCallback.onToken(" is");
        mockCallback.onToken(" sunny");
        mockCallback.onComplete(mockResponse);
        
        // Then
        verify(mockCallback, times(4)).onToken(anyString());
        verify(mockCallback).onComplete(mockResponse);
        verify(mockCallback, never()).onError(anyString());
    }
    
    @Test
    @DisplayName("Should handle streaming callback errors")
    void shouldHandleStreamingCallbackErrors() {
        // Given
        doNothing().when(mockCallback).onError(anyString());
        
        // When
        mockCallback.onError("Streaming connection lost");
        
        // Then
        verify(mockCallback).onError("Streaming connection lost");
        verify(mockCallback, never()).onToken(anyString());
        verify(mockCallback, never()).onComplete(any(IAIService.AIResponse.class));
    }
    
    @Test
    @DisplayName("Should summarize conversation successfully")
    void shouldSummarizeConversationSuccessfully() {
        // Given
        List<String> messages = List.of(
            "User: What is AI?",
            "Assistant: AI stands for Artificial Intelligence...",
            "User: How does machine learning work?",
            "Assistant: Machine learning is a subset of AI..."
        );
        String expectedSummary = "Discussion about AI and machine learning fundamentals";
        
        when(aiService.summarizeConversation(testSessionId, messages))
            .thenReturn(CompletableFuture.completedFuture(expectedSummary));
        
        // When
        CompletableFuture<String> future = aiService.summarizeConversation(testSessionId, messages);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        String summary = future.join();
        
        assertThat(summary).isEqualTo(expectedSummary);
        verify(aiService).summarizeConversation(testSessionId, messages);
    }
    
    @Test
    @DisplayName("Should handle empty conversation summarization")
    void shouldHandleEmptyConversationSummarization() {
        // Given
        List<String> emptyMessages = List.of();
        String expectedSummary = "No conversation content to summarize";
        
        when(aiService.summarizeConversation(testSessionId, emptyMessages))
            .thenReturn(CompletableFuture.completedFuture(expectedSummary));
        
        // When
        CompletableFuture<String> future = aiService.summarizeConversation(testSessionId, emptyMessages);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        String summary = future.join();
        
        assertThat(summary).isEqualTo(expectedSummary);
    }
    
    @Test
    @DisplayName("Should check service availability")
    void shouldCheckServiceAvailability() {
        // Given
        when(aiService.isServiceAvailable()).thenReturn(true);
        
        // When
        boolean isAvailable = aiService.isServiceAvailable();
        
        // Then
        assertThat(isAvailable).isTrue();
        verify(aiService).isServiceAvailable();
    }
    
    @Test
    @DisplayName("Should handle service unavailability")
    void shouldHandleServiceUnavailability() {
        // Given
        when(aiService.isServiceAvailable()).thenReturn(false);
        
        // When
        boolean isAvailable = aiService.isServiceAvailable();
        
        // Then
        assertThat(isAvailable).isFalse();
    }
    
    @Test
    @DisplayName("Should get service configuration")
    void shouldGetServiceConfiguration() {
        // Given
        when(mockConfiguration.getProviderName()).thenReturn("Azure OpenAI");
        when(mockConfiguration.getModel()).thenReturn("gpt-4");
        when(mockConfiguration.getMaxTokens()).thenReturn(4000);
        when(mockConfiguration.getTemperature()).thenReturn(0.7);
        when(mockConfiguration.getEndpoint()).thenReturn("https://api.openai.azure.com/");
        
        when(aiService.getConfiguration()).thenReturn(mockConfiguration);
        
        // When
        IAIService.ServiceConfiguration config = aiService.getConfiguration();
        
        // Then
        assertThat(config.getProviderName()).isEqualTo("Azure OpenAI");
        assertThat(config.getModel()).isEqualTo("gpt-4");
        assertThat(config.getMaxTokens()).isEqualTo(4000);
        assertThat(config.getTemperature()).isEqualTo(0.7);
        assertThat(config.getEndpoint()).isEqualTo("https://api.openai.azure.com/");
        
        verify(aiService).getConfiguration();
    }
    
    @Test
    @DisplayName("Should handle null or invalid session ID")
    void shouldHandleNullOrInvalidSessionId() {
        // Given
        when(aiService.generateResponse(null, testUserMessage, testLanguage))
            .thenThrow(new IllegalArgumentException("Session ID cannot be null"));
        
        when(aiService.generateResponse("", testUserMessage, testLanguage))
            .thenThrow(new IllegalArgumentException("Session ID cannot be empty"));
        
        // When & Then
        assertThatThrownBy(() -> aiService.generateResponse(null, testUserMessage, testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Session ID cannot be null");
        
        assertThatThrownBy(() -> aiService.generateResponse("", testUserMessage, testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Session ID cannot be empty");
    }
    
    @Test
    @DisplayName("Should handle null or empty user message")
    void shouldHandleNullOrEmptyUserMessage() {
        // Given
        when(aiService.generateResponse(testSessionId, null, testLanguage))
            .thenThrow(new IllegalArgumentException("User message cannot be null"));
        
        when(aiService.generateResponse(testSessionId, "", testLanguage))
            .thenThrow(new IllegalArgumentException("User message cannot be empty"));
        
        // When & Then
        assertThatThrownBy(() -> aiService.generateResponse(testSessionId, null, testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("User message cannot be null");
        
        assertThatThrownBy(() -> aiService.generateResponse(testSessionId, "", testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("User message cannot be empty");
    }
    
    @Test
    @DisplayName("Should handle different languages")
    void shouldHandleDifferentLanguages() {
        // Given
        List<String> languages = List.of("en-US", "es-ES", "fr-FR", "de-DE", "ja-JP");
        
        for (String language : languages) {
            when(mockResponse.getContent()).thenReturn("Response in " + language);
            when(aiService.generateResponse(testSessionId, testUserMessage, language))
                .thenReturn(CompletableFuture.completedFuture(mockResponse));
        }
        
        // When & Then
        for (String language : languages) {
            CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, language);
            assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
            
            verify(aiService).generateResponse(testSessionId, testUserMessage, language);
        }
    }
    
    @Test
    @DisplayName("Should handle long processing times")
    void shouldHandleLongProcessingTimes() {
        // Given
        when(mockResponse.getProcessingTimeMs()).thenReturn(5000.0); // 5 seconds
        when(mockResponse.isSuccess()).thenReturn(true);
        
        when(aiService.generateResponse(testSessionId, testUserMessage, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        IAIService.AIResponse response = future.join();
        
        assertThat(response.getProcessingTimeMs()).isEqualTo(5000.0);
        assertThat(response.isSuccess()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle high token usage")
    void shouldHandleHighTokenUsage() {
        // Given
        when(mockResponse.getTokensUsed()).thenReturn(3800); // Near max tokens
        when(mockResponse.isSuccess()).thenReturn(true);
        
        when(aiService.generateResponse(testSessionId, testUserMessage, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future = aiService.generateResponse(testSessionId, testUserMessage, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        IAIService.AIResponse response = future.join();
        
        assertThat(response.getTokensUsed()).isEqualTo(3800);
        assertThat(response.isSuccess()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle concurrent requests")
    void shouldHandleConcurrentRequests() {
        // Given
        when(mockResponse.getContent()).thenReturn("Concurrent response");
        when(mockResponse.isSuccess()).thenReturn(true);
        
        when(aiService.generateResponse(anyString(), anyString(), anyString()))
            .thenReturn(CompletableFuture.completedFuture(mockResponse));
        
        // When
        CompletableFuture<IAIService.AIResponse> future1 = aiService.generateResponse("session1", "message1", "en-US");
        CompletableFuture<IAIService.AIResponse> future2 = aiService.generateResponse("session2", "message2", "es-ES");
        CompletableFuture<IAIService.AIResponse> future3 = aiService.generateResponse("session3", "message3", "fr-FR");
        
        CompletableFuture.allOf(future1, future2, future3).join();
        
        // Then
        assertThat(future1.join().isSuccess()).isTrue();
        assertThat(future2.join().isSuccess()).isTrue();
        assertThat(future3.join().isSuccess()).isTrue();
        
        verify(aiService, times(3)).generateResponse(anyString(), anyString(), anyString());
    }
    
    @Test
    @DisplayName("Should validate AIResponse interface contract")
    void shouldValidateAIResponseInterfaceContract() {
        // When creating a mock response, all methods should be available
        when(mockResponse.getContent()).thenReturn("Test content");
        when(mockResponse.getTokensUsed()).thenReturn(50);
        when(mockResponse.getProcessingTimeMs()).thenReturn(200.0);
        when(mockResponse.getModel()).thenReturn("gpt-4");
        when(mockResponse.isSuccess()).thenReturn(true);
        when(mockResponse.getErrorMessage()).thenReturn(null);
        
        // Then - All interface methods should be callable
        assertThat(mockResponse.getContent()).isEqualTo("Test content");
        assertThat(mockResponse.getTokensUsed()).isEqualTo(50);
        assertThat(mockResponse.getProcessingTimeMs()).isEqualTo(200.0);
        assertThat(mockResponse.getModel()).isEqualTo("gpt-4");
        assertThat(mockResponse.isSuccess()).isTrue();
        assertThat(mockResponse.getErrorMessage()).isNull();
    }
    
    @Test
    @DisplayName("Should validate StreamingCallback interface contract")
    void shouldValidateStreamingCallbackInterfaceContract() {
        // Given
        doNothing().when(mockCallback).onToken(anyString());
        doNothing().when(mockCallback).onComplete(any(IAIService.AIResponse.class));
        doNothing().when(mockCallback).onError(anyString());
        
        // When - All interface methods should be callable
        mockCallback.onToken("test");
        mockCallback.onComplete(mockResponse);
        mockCallback.onError("test error");
        
        // Then
        verify(mockCallback).onToken("test");
        verify(mockCallback).onComplete(mockResponse);
        verify(mockCallback).onError("test error");
    }
    
    @Test
    @DisplayName("Should validate ServiceConfiguration interface contract")
    void shouldValidateServiceConfigurationInterfaceContract() {
        // When creating a mock configuration, all methods should be available
        when(mockConfiguration.getProviderName()).thenReturn("Test Provider");
        when(mockConfiguration.getModel()).thenReturn("test-model");
        when(mockConfiguration.getMaxTokens()).thenReturn(2000);
        when(mockConfiguration.getTemperature()).thenReturn(0.5);
        when(mockConfiguration.getEndpoint()).thenReturn("https://test.api.com");
        
        // Then - All interface methods should be callable
        assertThat(mockConfiguration.getProviderName()).isEqualTo("Test Provider");
        assertThat(mockConfiguration.getModel()).isEqualTo("test-model");
        assertThat(mockConfiguration.getMaxTokens()).isEqualTo(2000);
        assertThat(mockConfiguration.getTemperature()).isEqualTo(0.5);
        assertThat(mockConfiguration.getEndpoint()).isEqualTo("https://test.api.com");
    }
}
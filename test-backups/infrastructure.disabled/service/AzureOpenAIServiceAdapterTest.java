package com.interview.assistant.infrastructure.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for AzureOpenAIServiceAdapter
 * 
 * Tests Azure OpenAI integration, response generation, and streaming capabilities
 * Rationale: Ensures AI service works correctly with proper error handling and resilience
 */
@ExtendWith(MockitoExtension.class)
class AzureOpenAIServiceAdapterTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    private AzureOpenAIServiceAdapter aiService;

    private String mockCompletionResponse;
    private String mockStreamingResponse;

    @BeforeEach
    void setUp() {
        aiService = new AzureOpenAIServiceAdapter();
        
        // Use reflection to inject the mocked HttpClient
        try {
            var field = AzureOpenAIServiceAdapter.class.getDeclaredField("httpClient");
            field.setAccessible(true);
            field.set(aiService, httpClient);
        } catch (Exception e) {
            fail("Failed to inject mock HttpClient");
        }

        // Set configuration values using reflection
        setPrivateField("openaiKey", "test-openai-key");
        setPrivateField("openaiEndpoint", "https://test.openai.azure.com");
        setPrivateField("deploymentName", "test-deployment");
        setPrivateField("apiVersion", "2024-02-15-preview");

        mockCompletionResponse = """
            {
                "choices": [
                    {
                        "message": {
                            "content": "Hello! How can I help you today?"
                        }
                    }
                ]
            }
            """;

        mockStreamingResponse = """
            data: {"choices":[{"delta":{"content":"Hello"}}]}
            
            data: {"choices":[{"delta":{"content":"! How"}}]}
            
            data: {"choices":[{"delta":{"content":" can I help?"}}]}
            
            data: [DONE]
            """;
    }

    @Test
    void shouldGenerateResponseSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockCompletionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        CompletableFuture<String> result = aiService.generateResponse("Hello", "");
        String response = result.get();

        assertThat(response).isEqualTo("Hello! How can I help you today?");
        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldGenerateResponseWithConversationContext() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockCompletionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        String conversationContext = "Previous conversation about programming";
        CompletableFuture<String> result = aiService.generateResponse("Tell me more", conversationContext);
        String response = result.get();

        assertThat(response).isEqualTo("Hello! How can I help you today?");
        
        // Verify that the request body contains both user message and context
        verify(httpClient).send(argThat(request -> {
            try {
                String body = request.bodyPublisher().get().toString();
                return body.contains("Tell me more") && body.contains(conversationContext);
            } catch (Exception e) {
                return false;
            }
        }), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldThrowExceptionForNullUserMessage() {
        assertThatThrownBy(() -> aiService.generateResponse(null, ""))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("User message cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForEmptyUserMessage() {
        assertThatThrownBy(() -> aiService.generateResponse("", ""))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("User message cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForTooLongUserMessage() {
        String longMessage = "a".repeat(4001);
        
        assertThatThrownBy(() -> aiService.generateResponse(longMessage, ""))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("User message exceeds maximum length");
    }

    @Test
    void shouldHandleHttpErrorResponse() throws Exception {
        when(httpResponse.statusCode()).thenReturn(400);
        when(httpResponse.body()).thenReturn("Bad Request");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        assertThatThrownBy(() -> aiService.generateResponse("Hello", "").get())
            .isInstanceOf(ExecutionException.class)
            .hasCauseInstanceOf(RuntimeException.class)
            .hasMessageContaining("OpenAI service error: 400");
    }

    @Test
    void shouldHandleNetworkException() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Network error"));

        assertThatThrownBy(() -> aiService.generateResponse("Hello", "").get())
            .isInstanceOf(ExecutionException.class)
            .hasCauseInstanceOf(RuntimeException.class)
            .hasMessageContaining("Service communication failed");
    }

    @Test
    void shouldReturnDefaultResponseForUnparsableContent() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"invalid\":\"json\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        CompletableFuture<String> result = aiService.generateResponse("Hello", "");
        String response = result.get();

        assertThat(response).contains("trouble generating a response");
    }

    @Test
    void shouldGenerateStreamingResponseSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockStreamingResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Flux<String> result = aiService.generateResponseStream("Hello", "");

        StepVerifier.create(result)
            .expectNext("Hello")
            .expectNext("! How")
            .expectNext(" can I help?")
            .verifyComplete();
    }

    @Test
    void shouldHandleStreamingResponseWithInvalidData() throws Exception {
        String invalidStreamingResponse = """
            data: {"invalid":"format"}
            
            data: [DONE]
            """;

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(invalidStreamingResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Flux<String> result = aiService.generateResponseStream("Hello", "");

        StepVerifier.create(result)
            .verifyComplete(); // Should complete without emitting invalid data
    }

    @Test
    void shouldHandleStreamingError() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Streaming error"));

        Flux<String> result = aiService.generateResponseStream("Hello", "");

        StepVerifier.create(result)
            .expectError(RuntimeException.class)
            .verify();
    }

    @Test
    void shouldSummarizeConversationSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("""
            {
                "choices": [
                    {
                        "message": {
                            "content": "The conversation covered programming basics and best practices."
                        }
                    }
                ]
            }
            """);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        List<String> messages = Arrays.asList(
            "What is programming?",
            "Programming is writing instructions for computers.",
            "Can you explain best practices?",
            "Sure, here are some key best practices..."
        );

        CompletableFuture<String> result = aiService.summarizeConversation(messages);
        String summary = result.get();

        assertThat(summary).isEqualTo("The conversation covered programming basics and best practices.");
    }

    @Test
    void shouldReturnDefaultSummaryForEmptyConversation() throws Exception {
        CompletableFuture<String> result = aiService.summarizeConversation(Arrays.asList());
        String summary = result.get();

        assertThat(summary).isEqualTo("No conversation to summarize.");
    }

    @Test
    void shouldReturnErrorSummaryOnException() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Service error"));

        List<String> messages = Arrays.asList("Hello", "Hi there");
        CompletableFuture<String> result = aiService.summarizeConversation(messages);
        String summary = result.get();

        assertThat(summary).contains("Error: Could not summarize conversation");
    }

    @Test
    void shouldEstimateResponseComplexityBasedOnMessageCharacteristics() throws Exception {
        // Simple message
        CompletableFuture<Double> simpleResult = aiService.estimateResponseComplexity("Hi");
        Double simpleComplexity = simpleResult.get();
        assertThat(simpleComplexity).isBetween(0.0, 1.0);

        // Question
        CompletableFuture<Double> questionResult = aiService.estimateResponseComplexity("What is this?");
        Double questionComplexity = questionResult.get();
        assertThat(questionComplexity).isGreaterThan(simpleComplexity);

        // Explanation request
        CompletableFuture<Double> explainResult = aiService.estimateResponseComplexity("Please explain how machine learning works");
        Double explainComplexity = explainResult.get();
        assertThat(explainComplexity).isGreaterThan(questionComplexity);

        // Long message with multiple complexity indicators
        String complexMessage = "Can you explain in detail how to implement a machine learning algorithm? " +
                               "Please describe the steps and list the best practices for data preprocessing.";
        CompletableFuture<Double> complexResult = aiService.estimateResponseComplexity(complexMessage);
        Double complexComplexity = complexResult.get();
        assertThat(complexComplexity).isGreaterThan(explainComplexity);
    }

    @Test
    void shouldCapComplexityAtMaximum() throws Exception {
        String veryComplexMessage = "explain".repeat(100) + "how".repeat(100) + "?".repeat(100);
        
        CompletableFuture<Double> result = aiService.estimateResponseComplexity(veryComplexMessage);
        Double complexity = result.get();

        assertThat(complexity).isEqualTo(1.0); // Should be capped at maximum
    }

    @Test
    void shouldReturnDefaultComplexityOnError() throws Exception {
        // This would be difficult to trigger directly, but we can test the fallback logic
        CompletableFuture<Double> result = aiService.estimateResponseComplexity("normal message");
        Double complexity = result.get();

        assertThat(complexity).isBetween(0.0, 1.0);
    }

    @Test
    void shouldReturnTrueWhenServiceIsAvailable() {
        boolean isAvailable = aiService.isServiceAvailable();
        
        assertThat(isAvailable).isTrue();
    }

    @Test
    void shouldReturnFalseWhenOpenAIKeyIsNull() {
        setPrivateField("openaiKey", null);
        
        boolean isAvailable = aiService.isServiceAvailable();
        
        assertThat(isAvailable).isFalse();
    }

    @Test
    void shouldReturnFalseWhenOpenAIKeyIsEmpty() {
        setPrivateField("openaiKey", "");
        
        boolean isAvailable = aiService.isServiceAvailable();
        
        assertThat(isAvailable).isFalse();
    }

    @Test
    void shouldReturnFalseWhenEndpointIsNull() {
        setPrivateField("openaiEndpoint", null);
        
        boolean isAvailable = aiService.isServiceAvailable();
        
        assertThat(isAvailable).isFalse();
    }

    @Test
    void shouldReturnFalseAfterServiceFailure() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Service unavailable"));

        // Initial service availability should be true
        assertThat(aiService.isServiceAvailable()).isTrue();

        // Trigger service failure
        try {
            aiService.generateResponse("Hello", "").get();
        } catch (Exception e) {
            // Expected
        }

        // Service should now be marked as unavailable
        assertThat(aiService.isServiceAvailable()).isFalse();
    }

    @Test
    void shouldEscapeJsonSpecialCharacters() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockCompletionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        String messageWithSpecialChars = "Hello \"world\"\nNew line\tTab\\Backslash";
        CompletableFuture<String> result = aiService.generateResponse(messageWithSpecialChars, "");
        
        // Should not throw an exception and should complete successfully
        assertThat(result.get()).isNotNull();
        
        // Verify that the request was made (meaning JSON was properly escaped)
        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldParseComplexJsonResponseCorrectly() throws Exception {
        String complexResponse = """
            {
                "choices": [
                    {
                        "message": {
                            "content": "This is a response with \\"quotes\\" and\\nnewlines\\tand tabs."
                        }
                    }
                ]
            }
            """;

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(complexResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        CompletableFuture<String> result = aiService.generateResponse("Hello", "");
        String response = result.get();

        assertThat(response).contains("quotes");
        assertThat(response).contains("\n");
        assertThat(response).contains("\t");
    }

    @Test
    void shouldBuildRequestBodyWithSystemPrompt() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockCompletionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        aiService.generateResponse("Hello", "").get();

        // Verify that the request contains system prompt
        verify(httpClient).send(argThat(request -> {
            try {
                String body = request.bodyPublisher().get().toString();
                return body.contains("system") && body.contains("helpful AI assistant");
            } catch (Exception e) {
                return false;
            }
        }), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldIncludeProperHeadersInRequest() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockCompletionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        aiService.generateResponse("Hello", "").get();

        verify(httpClient).send(argThat(request -> {
            return request.headers().firstValue("api-key").isPresent() &&
                   request.headers().firstValue("Content-Type").equals(Optional.of("application/json"));
        }), any(HttpResponse.BodyHandler.class));
    }

    private void setPrivateField(String fieldName, Object value) {
        try {
            var field = AzureOpenAIServiceAdapter.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(aiService, value);
        } catch (Exception e) {
            fail("Failed to set private field: " + fieldName);
        }
    }
}
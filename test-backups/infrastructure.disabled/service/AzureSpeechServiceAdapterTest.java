package com.interview.assistant.infrastructure.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for AzureSpeechServiceAdapter
 * 
 * Tests Azure Speech Service integration, error handling, and audio processing
 * Rationale: Ensures speech-to-text service works correctly with proper resilience
 */
@ExtendWith(MockitoExtension.class)
class AzureSpeechServiceAdapterTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    private AzureSpeechServiceAdapter speechService;

    private byte[] testAudioData;
    private String mockTranscriptionResponse;
    private String mockLanguageDetectionResponse;

    @BeforeEach
    void setUp() {
        speechService = new AzureSpeechServiceAdapter();
        
        // Use reflection to inject the mocked HttpClient
        try {
            var field = AzureSpeechServiceAdapter.class.getDeclaredField("httpClient");
            field.setAccessible(true);
            field.set(speechService, httpClient);
        } catch (Exception e) {
            fail("Failed to inject mock HttpClient");
        }

        // Set up test data
        testAudioData = new byte[1024]; // 1KB of audio data
        for (int i = 0; i < testAudioData.length; i++) {
            testAudioData[i] = (byte) (i % 256);
        }

        mockTranscriptionResponse = "{\"DisplayText\":\"Hello world\",\"Confidence\":0.95}";
        mockLanguageDetectionResponse = "{\"Language\":\"en-US\",\"Confidence\":0.90}";
        
        // Set configuration values using reflection
        setPrivateField("speechKey", "test-speech-key");
        setPrivateField("speechRegion", "eastus");
        setPrivateField("speechEndpointTemplate", "https://%s.cognitiveservices.azure.com/");
    }

    @Test
    void shouldTranscribeAudioSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockTranscriptionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        CompletableFuture<String> result = speechService.transcribeAudio(testAudioData);
        String transcription = result.get();

        assertThat(transcription).isEqualTo("Hello world");
        verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldReturnEmptyStringForInvalidTranscriptionResponse() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"InvalidFormat\":\"test\"}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        CompletableFuture<String> result = speechService.transcribeAudio(testAudioData);
        String transcription = result.get();

        assertThat(transcription).isEmpty();
    }

    @Test
    void shouldThrowExceptionForNullAudioData() {
        assertThatThrownBy(() -> speechService.transcribeAudio(null))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Audio data cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForEmptyAudioData() {
        assertThatThrownBy(() -> speechService.transcribeAudio(new byte[0]))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Audio data cannot be null or empty");
    }

    @Test
    void shouldThrowExceptionForTooLargeAudioData() {
        byte[] largeAudioData = new byte[60 * 16000 * 2 + 1]; // Exceeds max length
        
        assertThatThrownBy(() -> speechService.transcribeAudio(largeAudioData))
            .isInstanceOf(RuntimeException.class)
            .hasCauseInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Audio data exceeds maximum length");
    }

    @Test
    void shouldHandleHttpErrorResponse() throws Exception {
        when(httpResponse.statusCode()).thenReturn(400);
        when(httpResponse.body()).thenReturn("Bad Request");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        assertThatThrownBy(() -> speechService.transcribeAudio(testAudioData).get())
            .isInstanceOf(ExecutionException.class)
            .hasCauseInstanceOf(RuntimeException.class)
            .hasMessageContaining("Speech service error: 400");
    }

    @Test
    void shouldHandleNetworkException() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Network error"));

        assertThatThrownBy(() -> speechService.transcribeAudio(testAudioData).get())
            .isInstanceOf(ExecutionException.class)
            .hasCauseInstanceOf(RuntimeException.class)
            .hasMessageContaining("Service communication failed");
    }

    @Test
    void shouldTranscribeAudioStreamSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockTranscriptionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Flux<byte[]> audioStream = Flux.just(testAudioData, testAudioData);
        Flux<String> result = speechService.transcribeAudioStream(audioStream);

        StepVerifier.create(result)
            .expectNext("Hello world")
            .verifyComplete();
    }

    @Test
    void shouldHandleEmptyAudioStreamChunks() {
        Flux<byte[]> emptyStream = Flux.just(new byte[0]);
        Flux<String> result = speechService.transcribeAudioStream(emptyStream);

        StepVerifier.create(result)
            .verifyComplete();
    }

    @Test
    void shouldContinueOnStreamingTranscriptionError() throws Exception {
        when(httpResponse.statusCode())
            .thenReturn(400) // First chunk fails
            .thenReturn(200); // Second chunk succeeds
        when(httpResponse.body())
            .thenReturn("Error")
            .thenReturn(mockTranscriptionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Flux<byte[]> audioStream = Flux.just(testAudioData, testAudioData);
        Flux<String> result = speechService.transcribeAudioStream(audioStream);

        // Should continue processing despite first chunk error
        StepVerifier.create(result)
            .expectNext("Hello world")
            .verifyComplete();
    }

    @Test
    void shouldDetectLanguageSuccessfully() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockLanguageDetectionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Mono<String> result = speechService.detectLanguage(testAudioData);

        StepVerifier.create(result)
            .expectNext("en-US")
            .verifyComplete();
    }

    @Test
    void shouldReturnDefaultLanguageOnDetectionFailure() throws Exception {
        when(httpResponse.statusCode()).thenReturn(400);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Mono<String> result = speechService.detectLanguage(testAudioData);

        StepVerifier.create(result)
            .expectNext("en-US") // Default language
            .verifyComplete();
    }

    @Test
    void shouldReturnDefaultLanguageOnNetworkError() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Network error"));

        Mono<String> result = speechService.detectLanguage(testAudioData);

        StepVerifier.create(result)
            .expectNext("en-US") // Default language
            .verifyComplete();
    }

    @Test
    void shouldCalculateConfidenceScoreForValidTranscription() throws Exception {
        String transcription = "This is a complete sentence.";
        
        CompletableFuture<Double> result = speechService.getConfidenceScore(transcription);
        Double confidence = result.get();

        assertThat(confidence).isBetween(0.0, 1.0);
        assertThat(confidence).isGreaterThan(0.8); // Should have high confidence for complete sentence
    }

    @Test
    void shouldReturnLowConfidenceForShortTranscription() throws Exception {
        String shortTranscription = "Hi";
        
        CompletableFuture<Double> result = speechService.getConfidenceScore(shortTranscription);
        Double confidence = result.get();

        assertThat(confidence).isBetween(0.0, 1.0);
        assertThat(confidence).isLessThan(0.8); // Should have lower confidence for short text
    }

    @Test
    void shouldReturnZeroConfidenceForEmptyTranscription() throws Exception {
        CompletableFuture<Double> result = speechService.getConfidenceScore("");
        Double confidence = result.get();

        assertThat(confidence).isEqualTo(0.0);
    }

    @Test
    void shouldReturnZeroConfidenceForNullTranscription() throws Exception {
        CompletableFuture<Double> result = speechService.getConfidenceScore(null);
        Double confidence = result.get();

        assertThat(confidence).isEqualTo(0.0);
    }

    @Test
    void shouldAdjustConfidenceForHesitations() throws Exception {
        String hesitantTranscription = "Um, this is, uh, a test sentence.";
        
        CompletableFuture<Double> result = speechService.getConfidenceScore(hesitantTranscription);
        Double confidence = result.get();

        assertThat(confidence).isBetween(0.0, 1.0);
        // Should be lower due to hesitations but still reasonable
        assertThat(confidence).isLessThan(0.9);
    }

    @Test
    void shouldReturnTrueWhenServiceIsAvailable() {
        boolean isAvailable = speechService.isServiceAvailable();
        
        assertThat(isAvailable).isTrue();
    }

    @Test
    void shouldReturnFalseWhenSpeechKeyIsNull() {
        setPrivateField("speechKey", null);
        
        boolean isAvailable = speechService.isServiceAvailable();
        
        assertThat(isAvailable).isFalse();
    }

    @Test
    void shouldReturnFalseWhenSpeechKeyIsEmpty() {
        setPrivateField("speechKey", "");
        
        boolean isAvailable = speechService.isServiceAvailable();
        
        assertThat(isAvailable).isFalse();
    }

    @Test
    void shouldReturnFalseAfterServiceFailure() throws Exception {
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenThrow(new IOException("Service unavailable"));

        // Initial service availability should be true
        assertThat(speechService.isServiceAvailable()).isTrue();

        // Trigger service failure
        try {
            speechService.transcribeAudio(testAudioData).get();
        } catch (Exception e) {
            // Expected
        }

        // Service should now be marked as unavailable
        assertThat(speechService.isServiceAvailable()).isFalse();
    }

    @Test
    void shouldCombineAudioChunksCorrectly() throws Exception {
        // This tests the private method indirectly through streaming transcription
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(mockTranscriptionResponse);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        byte[] chunk1 = new byte[]{1, 2, 3};
        byte[] chunk2 = new byte[]{4, 5, 6};
        
        Flux<byte[]> audioStream = Flux.just(chunk1, chunk2);
        Flux<String> result = speechService.transcribeAudioStream(audioStream);

        StepVerifier.create(result)
            .expectNext("Hello world")
            .verifyComplete();

        // Verify that the HTTP client was called (indicating chunks were combined)
        verify(httpClient, atLeastOnce()).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
    }

    @Test
    void shouldHandleLanguageDetectionResponseParsing() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"Language\":\"fr-FR\",\"Confidence\":0.85}");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Mono<String> result = speechService.detectLanguage(testAudioData);

        StepVerifier.create(result)
            .expectNext("fr-FR")
            .verifyComplete();
    }

    @Test
    void shouldHandleMalformedLanguageDetectionResponse() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"InvalidJson\":");
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(httpResponse);

        Mono<String> result = speechService.detectLanguage(testAudioData);

        StepVerifier.create(result)
            .expectNext("en-US") // Should fallback to default
            .verifyComplete();
    }

    private void setPrivateField(String fieldName, Object value) {
        try {
            var field = AzureSpeechServiceAdapter.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(speechService, value);
        } catch (Exception e) {
            fail("Failed to set private field: " + fieldName);
        }
    }
}
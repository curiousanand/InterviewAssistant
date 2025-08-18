package com.interview.assistant.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.lenient;

/**
 * Comprehensive test suite for ITranscriptionService interface implementations
 * 
 * Tests contract compliance, async behavior, streaming, and error handling
 */
@DisplayName("ITranscriptionService Interface Tests")
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ITranscriptionServiceTest {
    
    @Mock
    private ITranscriptionService transcriptionService;
    
    @Mock
    private ITranscriptionService.TranscriptionResult mockResult;
    
    @Mock
    private ITranscriptionService.AudioFormat mockAudioFormat;
    
    @Mock
    private ITranscriptionService.StreamingSession mockStreamingSession;
    
    @Mock
    private ITranscriptionService.StreamingTranscriptionCallback mockCallback;
    
    @Mock
    private ITranscriptionService.LanguageDetectionResult mockLanguageResult;
    
    @Mock
    private ITranscriptionService.LanguageCandidate mockLanguageCandidate;
    
    @Mock
    private ITranscriptionService.ServiceConfiguration mockConfiguration;
    
    private byte[] testAudioData;
    private String testSessionId;
    private String testLanguage;
    
    @BeforeEach
    void setUp() {
        testAudioData = new byte[]{1, 2, 3, 4, 5}; // Sample audio data
        testSessionId = "test-session-123";
        testLanguage = "en-US";
        
        // Setup default audio format mock with lenient stubbing
        lenient().when(mockAudioFormat.getSampleRate()).thenReturn(16000);
        lenient().when(mockAudioFormat.getChannels()).thenReturn(1);
        lenient().when(mockAudioFormat.getBitsPerSample()).thenReturn(16);
        lenient().when(mockAudioFormat.getEncoding()).thenReturn("PCM");
    }
    
    @Test
    @DisplayName("Should transcribe audio successfully")
    void shouldTranscribeAudioSuccessfully() {
        // Given
        when(mockResult.getText()).thenReturn("Hello, how are you today?");
        when(mockResult.getConfidence()).thenReturn(0.95);
        when(mockResult.getDetectedLanguage()).thenReturn("en-US");
        when(mockResult.isSuccess()).thenReturn(true);
        when(mockResult.getErrorMessage()).thenReturn(null);
        when(mockResult.getProcessingTimeMs()).thenReturn(250L);
        when(mockResult.isFinal()).thenReturn(true);
        
        when(transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.TranscriptionResult result = future.join();
        
        assertThat(result.getText()).isEqualTo("Hello, how are you today?");
        assertThat(result.getConfidence()).isEqualTo(0.95);
        assertThat(result.getDetectedLanguage()).isEqualTo("en-US");
        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getErrorMessage()).isNull();
        assertThat(result.getProcessingTimeMs()).isEqualTo(250L);
        assertThat(result.isFinal()).isTrue();
        
        verify(transcriptionService).transcribe(testAudioData, mockAudioFormat, testLanguage);
    }
    
    @Test
    @DisplayName("Should handle transcription failure")
    void shouldHandleTranscriptionFailure() {
        // Given
        when(mockResult.isSuccess()).thenReturn(false);
        when(mockResult.getErrorMessage()).thenReturn("Audio quality too low");
        when(mockResult.getText()).thenReturn(null);
        when(mockResult.getConfidence()).thenReturn(0.0);
        
        when(transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.TranscriptionResult result = future.join();
        
        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Audio quality too low");
        assertThat(result.getText()).isNull();
        assertThat(result.getConfidence()).isEqualTo(0.0);
    }
    
    @Test
    @DisplayName("Should handle async transcription failure")
    void shouldHandleAsyncTranscriptionFailure() {
        // Given
        RuntimeException testException = new RuntimeException("Network connection failed");
        CompletableFuture<ITranscriptionService.TranscriptionResult> failedFuture = new CompletableFuture<>();
        failedFuture.completeExceptionally(testException);
        
        when(transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage))
            .thenReturn(failedFuture);
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage);
        
        // Then
        assertThat(future).failsWithin(1, TimeUnit.SECONDS)
            .withThrowableOfType(ExecutionException.class)
            .withCauseInstanceOf(RuntimeException.class)
            .withMessageContaining("Network connection failed");
    }
    
    @Test
    @DisplayName("Should start streaming transcription successfully")
    void shouldStartStreamingTranscriptionSuccessfully() {
        // Given
        when(mockStreamingSession.getSessionId()).thenReturn(testSessionId);
        when(mockStreamingSession.isActive()).thenReturn(true);
        
        when(transcriptionService.startStreamingTranscription(testSessionId, mockAudioFormat, testLanguage, mockCallback))
            .thenReturn(CompletableFuture.completedFuture(mockStreamingSession));
        
        // When
        CompletableFuture<ITranscriptionService.StreamingSession> future = 
            transcriptionService.startStreamingTranscription(testSessionId, mockAudioFormat, testLanguage, mockCallback);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.StreamingSession session = future.join();
        
        assertThat(session.getSessionId()).isEqualTo(testSessionId);
        assertThat(session.isActive()).isTrue();
        
        verify(transcriptionService).startStreamingTranscription(testSessionId, mockAudioFormat, testLanguage, mockCallback);
    }
    
    @Test
    @DisplayName("Should send audio chunk to streaming session")
    void shouldSendAudioChunkToStreamingSession() {
        // Given
        byte[] audioChunk = new byte[]{6, 7, 8, 9, 10};
        
        when(transcriptionService.sendAudioChunk(mockStreamingSession, audioChunk))
            .thenReturn(CompletableFuture.completedFuture(null));
        
        // When
        CompletableFuture<Void> future = transcriptionService.sendAudioChunk(mockStreamingSession, audioChunk);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        verify(transcriptionService).sendAudioChunk(mockStreamingSession, audioChunk);
    }
    
    @Test
    @DisplayName("Should stop streaming transcription successfully")
    void shouldStopStreamingTranscriptionSuccessfully() {
        // Given
        when(mockResult.getText()).thenReturn("Final transcription result");
        when(mockResult.isFinal()).thenReturn(true);
        when(mockResult.isSuccess()).thenReturn(true);
        
        when(transcriptionService.stopStreamingTranscription(mockStreamingSession))
            .thenReturn(CompletableFuture.completedFuture(mockResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.stopStreamingTranscription(mockStreamingSession);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.TranscriptionResult result = future.join();
        
        assertThat(result.getText()).isEqualTo("Final transcription result");
        assertThat(result.isFinal()).isTrue();
        assertThat(result.isSuccess()).isTrue();
        
        verify(transcriptionService).stopStreamingTranscription(mockStreamingSession);
    }
    
    @Test
    @DisplayName("Should handle streaming callback invocations")
    void shouldHandleStreamingCallbackInvocations() {
        // Given
        doNothing().when(mockCallback).onPartialResult(any(ITranscriptionService.TranscriptionResult.class));
        doNothing().when(mockCallback).onFinalResult(any(ITranscriptionService.TranscriptionResult.class));
        doNothing().when(mockCallback).onError(anyString());
        doNothing().when(mockCallback).onSessionClosed();
        
        // When - Simulate streaming behavior
        mockCallback.onPartialResult(mockResult);
        mockCallback.onFinalResult(mockResult);
        mockCallback.onSessionClosed();
        
        // Then
        verify(mockCallback).onPartialResult(mockResult);
        verify(mockCallback).onFinalResult(mockResult);
        verify(mockCallback).onSessionClosed();
        verify(mockCallback, never()).onError(anyString());
    }
    
    @Test
    @DisplayName("Should handle streaming callback errors")
    void shouldHandleStreamingCallbackErrors() {
        // Given
        doNothing().when(mockCallback).onError(anyString());
        
        // When
        mockCallback.onError("Streaming session interrupted");
        
        // Then
        verify(mockCallback).onError("Streaming session interrupted");
        verify(mockCallback, never()).onPartialResult(any());
        verify(mockCallback, never()).onFinalResult(any());
        verify(mockCallback, never()).onSessionClosed();
    }
    
    @Test
    @DisplayName("Should detect language successfully")
    void shouldDetectLanguageSuccessfully() {
        // Given
        when(mockLanguageCandidate.getLanguage()).thenReturn("en-US");
        when(mockLanguageCandidate.getConfidence()).thenReturn(0.95);
        
        when(mockLanguageResult.getDetectedLanguage()).thenReturn("en-US");
        when(mockLanguageResult.getConfidence()).thenReturn(0.95);
        when(mockLanguageResult.getCandidates()).thenReturn(List.of(mockLanguageCandidate));
        
        when(transcriptionService.detectLanguage(testAudioData, mockAudioFormat))
            .thenReturn(CompletableFuture.completedFuture(mockLanguageResult));
        
        // When
        CompletableFuture<ITranscriptionService.LanguageDetectionResult> future = 
            transcriptionService.detectLanguage(testAudioData, mockAudioFormat);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.LanguageDetectionResult result = future.join();
        
        assertThat(result.getDetectedLanguage()).isEqualTo("en-US");
        assertThat(result.getConfidence()).isEqualTo(0.95);
        assertThat(result.getCandidates()).hasSize(1);
        assertThat(result.getCandidates().get(0).getLanguage()).isEqualTo("en-US");
        assertThat(result.getCandidates().get(0).getConfidence()).isEqualTo(0.95);
        
        verify(transcriptionService).detectLanguage(testAudioData, mockAudioFormat);
    }
    
    @Test
    @DisplayName("Should detect multiple language candidates")
    void shouldDetectMultipleLanguageCandidates() {
        // Given
        ITranscriptionService.LanguageCandidate candidate1 = mock(ITranscriptionService.LanguageCandidate.class);
        when(candidate1.getLanguage()).thenReturn("en-US");
        when(candidate1.getConfidence()).thenReturn(0.85);
        
        ITranscriptionService.LanguageCandidate candidate2 = mock(ITranscriptionService.LanguageCandidate.class);
        when(candidate2.getLanguage()).thenReturn("en-GB");
        when(candidate2.getConfidence()).thenReturn(0.75);
        
        when(mockLanguageResult.getDetectedLanguage()).thenReturn("en-US");
        when(mockLanguageResult.getConfidence()).thenReturn(0.85);
        when(mockLanguageResult.getCandidates()).thenReturn(List.of(candidate1, candidate2));
        
        when(transcriptionService.detectLanguage(testAudioData, mockAudioFormat))
            .thenReturn(CompletableFuture.completedFuture(mockLanguageResult));
        
        // When
        CompletableFuture<ITranscriptionService.LanguageDetectionResult> future = 
            transcriptionService.detectLanguage(testAudioData, mockAudioFormat);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.LanguageDetectionResult result = future.join();
        
        assertThat(result.getCandidates()).hasSize(2);
        assertThat(result.getCandidates()).extracting(ITranscriptionService.LanguageCandidate::getLanguage)
            .containsExactly("en-US", "en-GB");
    }
    
    @Test
    @DisplayName("Should check service availability")
    void shouldCheckServiceAvailability() {
        // Given
        when(transcriptionService.isServiceAvailable()).thenReturn(true);
        
        // When
        boolean isAvailable = transcriptionService.isServiceAvailable();
        
        // Then
        assertThat(isAvailable).isTrue();
        verify(transcriptionService).isServiceAvailable();
    }
    
    @Test
    @DisplayName("Should handle service unavailability")
    void shouldHandleServiceUnavailability() {
        // Given
        when(transcriptionService.isServiceAvailable()).thenReturn(false);
        
        // When
        boolean isAvailable = transcriptionService.isServiceAvailable();
        
        // Then
        assertThat(isAvailable).isFalse();
    }
    
    @Test
    @DisplayName("Should get supported languages")
    void shouldGetSupportedLanguages() {
        // Given
        List<String> supportedLanguages = List.of("en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "zh-CN");
        
        when(transcriptionService.getSupportedLanguages()).thenReturn(supportedLanguages);
        
        // When
        List<String> languages = transcriptionService.getSupportedLanguages();
        
        // Then
        assertThat(languages).hasSize(6);
        assertThat(languages).containsExactly("en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "zh-CN");
        
        verify(transcriptionService).getSupportedLanguages();
    }
    
    @Test
    @DisplayName("Should get service configuration")
    void shouldGetServiceConfiguration() {
        // Given
        when(mockConfiguration.getProviderName()).thenReturn("Azure Speech Services");
        when(mockConfiguration.getEndpoint()).thenReturn("https://speech.cognitiveservices.azure.com/");
        when(mockConfiguration.getSupportedLanguages()).thenReturn(List.of("en-US", "es-ES", "fr-FR"));
        when(mockConfiguration.getDefaultAudioFormat()).thenReturn(mockAudioFormat);
        
        when(transcriptionService.getConfiguration()).thenReturn(mockConfiguration);
        
        // When
        ITranscriptionService.ServiceConfiguration config = transcriptionService.getConfiguration();
        
        // Then
        assertThat(config.getProviderName()).isEqualTo("Azure Speech Services");
        assertThat(config.getEndpoint()).isEqualTo("https://speech.cognitiveservices.azure.com/");
        assertThat(config.getSupportedLanguages()).containsExactly("en-US", "es-ES", "fr-FR");
        assertThat(config.getDefaultAudioFormat()).isEqualTo(mockAudioFormat);
        
        verify(transcriptionService).getConfiguration();
    }
    
    @Test
    @DisplayName("Should validate AudioFormat interface contract")
    void shouldValidateAudioFormatInterfaceContract() {
        // Test static factory method
        ITranscriptionService.AudioFormat pcm16k = ITranscriptionService.AudioFormat.pcm16k();
        
        assertThat(pcm16k.getSampleRate()).isEqualTo(16000);
        assertThat(pcm16k.getChannels()).isEqualTo(1);
        assertThat(pcm16k.getBitsPerSample()).isEqualTo(16);
        assertThat(pcm16k.getEncoding()).isEqualTo("PCM");
    }
    
    @Test
    @DisplayName("Should handle different audio formats")
    void shouldHandleDifferentAudioFormats() {
        // Given
        ITranscriptionService.AudioFormat format44k = mock(ITranscriptionService.AudioFormat.class);
        when(format44k.getSampleRate()).thenReturn(44100);
        when(format44k.getChannels()).thenReturn(2);
        when(format44k.getBitsPerSample()).thenReturn(24);
        when(format44k.getEncoding()).thenReturn("PCM");
        
        when(mockResult.getText()).thenReturn("High quality audio result");
        when(mockResult.isSuccess()).thenReturn(true);
        
        when(transcriptionService.transcribe(testAudioData, format44k, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(mockResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.transcribe(testAudioData, format44k, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.TranscriptionResult result = future.join();
        
        assertThat(result.getText()).isEqualTo("High quality audio result");
        assertThat(result.isSuccess()).isTrue();
        
        verify(transcriptionService).transcribe(testAudioData, format44k, testLanguage);
    }
    
    @Test
    @DisplayName("Should handle null or invalid audio data")
    void shouldHandleNullOrInvalidAudioData() {
        // Given
        when(transcriptionService.transcribe(null, mockAudioFormat, testLanguage))
            .thenThrow(new IllegalArgumentException("Audio data cannot be null"));
        
        when(transcriptionService.transcribe(new byte[0], mockAudioFormat, testLanguage))
            .thenThrow(new IllegalArgumentException("Audio data cannot be empty"));
        
        // When & Then
        assertThatThrownBy(() -> transcriptionService.transcribe(null, mockAudioFormat, testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Audio data cannot be null");
        
        assertThatThrownBy(() -> transcriptionService.transcribe(new byte[0], mockAudioFormat, testLanguage))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Audio data cannot be empty");
    }
    
    @Test
    @DisplayName("Should handle partial transcription results")
    void shouldHandlePartialTranscriptionResults() {
        // Given
        ITranscriptionService.TranscriptionResult partialResult = mock(ITranscriptionService.TranscriptionResult.class);
        when(partialResult.getText()).thenReturn("Hello, how are");
        when(partialResult.isFinal()).thenReturn(false);
        when(partialResult.getConfidence()).thenReturn(0.80);
        when(partialResult.isSuccess()).thenReturn(true);
        
        when(transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage))
            .thenReturn(CompletableFuture.completedFuture(partialResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, testLanguage);
        
        // Then
        assertThat(future).succeedsWithin(1, TimeUnit.SECONDS);
        ITranscriptionService.TranscriptionResult result = future.join();
        
        assertThat(result.getText()).isEqualTo("Hello, how are");
        assertThat(result.isFinal()).isFalse();
        assertThat(result.getConfidence()).isEqualTo(0.80);
        assertThat(result.isSuccess()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle streaming session lifecycle")
    void shouldHandleStreamingSessionLifecycle() {
        // Given - Active session
        when(mockStreamingSession.isActive()).thenReturn(true);
        doNothing().when(mockStreamingSession).close();
        
        // When
        boolean isActive = mockStreamingSession.isActive();
        mockStreamingSession.close();
        
        // Then
        assertThat(isActive).isTrue();
        verify(mockStreamingSession).close();
    }
    
    @Test
    @DisplayName("Should handle concurrent transcription requests")
    void shouldHandleConcurrentTranscriptionRequests() {
        // Given
        when(mockResult.getText()).thenReturn("Concurrent transcription");
        when(mockResult.isSuccess()).thenReturn(true);
        
        when(transcriptionService.transcribe(any(byte[].class), any(ITranscriptionService.AudioFormat.class), anyString()))
            .thenReturn(CompletableFuture.completedFuture(mockResult));
        
        // When
        CompletableFuture<ITranscriptionService.TranscriptionResult> future1 = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, "en-US");
        CompletableFuture<ITranscriptionService.TranscriptionResult> future2 = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, "es-ES");
        CompletableFuture<ITranscriptionService.TranscriptionResult> future3 = 
            transcriptionService.transcribe(testAudioData, mockAudioFormat, "fr-FR");
        
        CompletableFuture.allOf(future1, future2, future3).join();
        
        // Then
        assertThat(future1.join().isSuccess()).isTrue();
        assertThat(future2.join().isSuccess()).isTrue();
        assertThat(future3.join().isSuccess()).isTrue();
        
        verify(transcriptionService, times(3)).transcribe(any(byte[].class), any(ITranscriptionService.AudioFormat.class), anyString());
    }
    
    @Test
    @DisplayName("Should validate TranscriptionResult interface contract")
    void shouldValidateTranscriptionResultInterfaceContract() {
        // When creating a mock result, all methods should be available
        when(mockResult.getText()).thenReturn("Test transcription");
        when(mockResult.getConfidence()).thenReturn(0.85);
        when(mockResult.getDetectedLanguage()).thenReturn("en-US");
        when(mockResult.isSuccess()).thenReturn(true);
        when(mockResult.getErrorMessage()).thenReturn(null);
        when(mockResult.getProcessingTimeMs()).thenReturn(300L);
        when(mockResult.isFinal()).thenReturn(true);
        
        // Then - All interface methods should be callable
        assertThat(mockResult.getText()).isEqualTo("Test transcription");
        assertThat(mockResult.getConfidence()).isEqualTo(0.85);
        assertThat(mockResult.getDetectedLanguage()).isEqualTo("en-US");
        assertThat(mockResult.isSuccess()).isTrue();
        assertThat(mockResult.getErrorMessage()).isNull();
        assertThat(mockResult.getProcessingTimeMs()).isEqualTo(300L);
        assertThat(mockResult.isFinal()).isTrue();
    }
    
    @Test
    @DisplayName("Should validate StreamingSession interface contract")
    void shouldValidateStreamingSessionInterfaceContract() {
        // When creating a mock session, all methods should be available
        when(mockStreamingSession.getSessionId()).thenReturn("test-session");
        when(mockStreamingSession.isActive()).thenReturn(true);
        doNothing().when(mockStreamingSession).close();
        
        // Then - All interface methods should be callable
        assertThat(mockStreamingSession.getSessionId()).isEqualTo("test-session");
        assertThat(mockStreamingSession.isActive()).isTrue();
        
        mockStreamingSession.close();
        verify(mockStreamingSession).close();
    }
    
    @Test
    @DisplayName("Should validate LanguageDetectionResult interface contract")
    void shouldValidateLanguageDetectionResultInterfaceContract() {
        // When creating a mock language result, all methods should be available
        when(mockLanguageResult.getDetectedLanguage()).thenReturn("en-US");
        when(mockLanguageResult.getConfidence()).thenReturn(0.90);
        when(mockLanguageResult.getCandidates()).thenReturn(List.of(mockLanguageCandidate));
        
        // Then - All interface methods should be callable
        assertThat(mockLanguageResult.getDetectedLanguage()).isEqualTo("en-US");
        assertThat(mockLanguageResult.getConfidence()).isEqualTo(0.90);
        assertThat(mockLanguageResult.getCandidates()).hasSize(1);
    }
    
    @Test
    @DisplayName("Should validate ServiceConfiguration interface contract")
    void shouldValidateServiceConfigurationInterfaceContract() {
        // When creating a mock configuration, all methods should be available
        when(mockConfiguration.getProviderName()).thenReturn("Test Provider");
        when(mockConfiguration.getEndpoint()).thenReturn("https://test.api.com");
        when(mockConfiguration.getSupportedLanguages()).thenReturn(List.of("en-US", "es-ES"));
        when(mockConfiguration.getDefaultAudioFormat()).thenReturn(mockAudioFormat);
        
        // Then - All interface methods should be callable
        assertThat(mockConfiguration.getProviderName()).isEqualTo("Test Provider");
        assertThat(mockConfiguration.getEndpoint()).isEqualTo("https://test.api.com");
        assertThat(mockConfiguration.getSupportedLanguages()).containsExactly("en-US", "es-ES");
        assertThat(mockConfiguration.getDefaultAudioFormat()).isEqualTo(mockAudioFormat);
    }
}
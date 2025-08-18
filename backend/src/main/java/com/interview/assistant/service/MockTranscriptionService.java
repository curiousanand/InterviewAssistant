package com.interview.assistant.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Mock implementation of ITranscriptionService for development and testing
 * 
 * Why: Enables application startup without external service dependencies
 * Pattern: Mock Object - provides fake implementation for development
 * Rationale: Allows testing of application flow without Azure Speech Services
 */
@Service
@Profile("test")
public class MockTranscriptionService implements ITranscriptionService {
    
    @Override
    public CompletableFuture<TranscriptionResult> transcribe(byte[] audioData, AudioFormat audioFormat, String language) {
        return CompletableFuture.completedFuture(new MockTranscriptionResult(
            "Mock transcribed text from audio",
            0.85,
            language,
            true,
            null,
            200L,
            true
        ));
    }
    
    @Override
    public CompletableFuture<StreamingSession> startStreamingTranscription(String sessionId, AudioFormat audioFormat, 
                                                                          String language, StreamingTranscriptionCallback callback) {
        MockStreamingSession session = new MockStreamingSession(sessionId);
        return CompletableFuture.completedFuture(session);
    }
    
    @Override
    public CompletableFuture<Void> sendAudioChunk(StreamingSession session, byte[] audioChunk) {
        return CompletableFuture.completedFuture(null);
    }
    
    @Override
    public CompletableFuture<TranscriptionResult> stopStreamingTranscription(StreamingSession session) {
        return CompletableFuture.completedFuture(new MockTranscriptionResult(
            "Final streaming transcription result",
            0.90,
            "en-US",
            true,
            null,
            150L,
            true
        ));
    }
    
    @Override
    public CompletableFuture<LanguageDetectionResult> detectLanguage(byte[] audioData, AudioFormat audioFormat) {
        return CompletableFuture.completedFuture(new MockLanguageDetectionResult(
            "en-US",
            0.95,
            List.of(new MockLanguageCandidate("en-US", 0.95))
        ));
    }
    
    @Override
    public boolean isServiceAvailable() {
        return true;
    }
    
    @Override
    public List<String> getSupportedLanguages() {
        return List.of("en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "zh-CN");
    }
    
    @Override
    public ServiceConfiguration getConfiguration() {
        return new MockServiceConfiguration();
    }
    
    // Mock implementations of inner interfaces
    
    private static class MockTranscriptionResult implements TranscriptionResult {
        private final String text;
        private final double confidence;
        private final String detectedLanguage;
        private final boolean success;
        private final String errorMessage;
        private final long processingTimeMs;
        private final boolean isFinal;
        
        public MockTranscriptionResult(String text, double confidence, String detectedLanguage, 
                                     boolean success, String errorMessage, long processingTimeMs, boolean isFinal) {
            this.text = text;
            this.confidence = confidence;
            this.detectedLanguage = detectedLanguage;
            this.success = success;
            this.errorMessage = errorMessage;
            this.processingTimeMs = processingTimeMs;
            this.isFinal = isFinal;
        }
        
        @Override
        public String getText() { return text; }
        @Override
        public double getConfidence() { return confidence; }
        @Override
        public String getDetectedLanguage() { return detectedLanguage; }
        @Override
        public boolean isSuccess() { return success; }
        @Override
        public String getErrorMessage() { return errorMessage; }
        @Override
        public long getProcessingTimeMs() { return processingTimeMs; }
        @Override
        public boolean isFinal() { return isFinal; }
    }
    
    private static class MockStreamingSession implements StreamingSession {
        private final String sessionId;
        private boolean active = true;
        
        public MockStreamingSession(String sessionId) {
            this.sessionId = sessionId;
        }
        
        @Override
        public String getSessionId() { return sessionId; }
        @Override
        public boolean isActive() { return active; }
        @Override
        public void close() { active = false; }
    }
    
    private static class MockLanguageDetectionResult implements LanguageDetectionResult {
        private final String detectedLanguage;
        private final double confidence;
        private final List<LanguageCandidate> candidates;
        
        public MockLanguageDetectionResult(String detectedLanguage, double confidence, List<LanguageCandidate> candidates) {
            this.detectedLanguage = detectedLanguage;
            this.confidence = confidence;
            this.candidates = candidates;
        }
        
        @Override
        public String getDetectedLanguage() { return detectedLanguage; }
        @Override
        public double getConfidence() { return confidence; }
        @Override
        public List<LanguageCandidate> getCandidates() { return candidates; }
    }
    
    private static class MockLanguageCandidate implements LanguageCandidate {
        private final String language;
        private final double confidence;
        
        public MockLanguageCandidate(String language, double confidence) {
            this.language = language;
            this.confidence = confidence;
        }
        
        @Override
        public String getLanguage() { return language; }
        @Override
        public double getConfidence() { return confidence; }
    }
    
    private static class MockServiceConfiguration implements ServiceConfiguration {
        @Override
        public String getProviderName() { return "Mock Transcription Service"; }
        @Override
        public String getEndpoint() { return "http://mock-service"; }
        @Override
        public List<String> getSupportedLanguages() { 
            return List.of("en-US", "es-ES", "fr-FR", "de-DE", "ja-JP", "zh-CN"); 
        }
        @Override
        public AudioFormat getDefaultAudioFormat() { return AudioFormat.pcm16k(); }
    }
}
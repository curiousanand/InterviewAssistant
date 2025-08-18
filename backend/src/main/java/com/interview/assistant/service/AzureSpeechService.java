package com.interview.assistant.service;

import com.microsoft.cognitiveservices.speech.*;
import com.microsoft.cognitiveservices.speech.audio.AudioConfig;
import com.microsoft.cognitiveservices.speech.audio.PushAudioInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Azure Speech Services implementation for real-time transcription
 * 
 * Why: Provides low-latency, high-accuracy speech-to-text with Azure Cognitive Services
 * Pattern: Strategy Pattern - implements transcription service interface
 * Rationale: Leverages Azure's enterprise-grade speech recognition with streaming support
 */
@Service
@Profile("!test")
public class AzureSpeechService implements ITranscriptionService {
    
    private static final Logger logger = LoggerFactory.getLogger(AzureSpeechService.class);
    
    @Value("${azure.speech.key}")
    private String speechKey;
    
    @Value("${azure.speech.region}")
    private String speechRegion;
    
    @Value("${azure.speech.endpoint:}")
    private String speechEndpoint;
    
    @Value("${azure.speech.auto-detect.enabled:true}")
    private boolean autoDetectEnabled;
    
    @Value("${azure.speech.auto-detect.languages:en-US,hi-IN}")
    private List<String> autoDetectLanguages;
    
    private SpeechConfig speechConfig;
    private final Map<String, StreamingSessionImpl> activeSessions = new ConcurrentHashMap<>();
    
    @PostConstruct
    public void initialize() {
        try {
            // Initialize Azure Speech Config
            if (speechEndpoint != null && !speechEndpoint.isEmpty()) {
                logger.info("Initializing Azure Speech Service with custom endpoint: {}", speechEndpoint);
                speechConfig = SpeechConfig.fromEndpoint(
                    java.net.URI.create(speechEndpoint), 
                    speechKey
                );
            } else {
                logger.info("Initializing Azure Speech Service with region: {}", speechRegion);
                speechConfig = SpeechConfig.fromSubscription(speechKey, speechRegion);
            }
            
            // Configure speech settings for optimal real-time performance
            speechConfig.setServiceProperty("punctuation", "explicit", ServicePropertyChannel.UriQueryParameter);
            speechConfig.setServiceProperty("format", "simple", ServicePropertyChannel.UriQueryParameter);
            speechConfig.setServiceProperty("profanity", "masked", ServicePropertyChannel.UriQueryParameter);
            
            // Enable interim results for real-time transcription
            speechConfig.setProperty(PropertyId.SpeechServiceResponse_RequestDetailedResultTrueFalse, "true");
            speechConfig.setProperty(PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "true");
            
            logger.info("Azure Speech Service initialized successfully");
            
        } catch (Exception e) {
            logger.error("Failed to initialize Azure Speech Service", e);
            throw new RuntimeException("Azure Speech Service initialization failed", e);
        }
    }
    
    @PreDestroy
    public void cleanup() {
        // Close all active sessions
        activeSessions.values().forEach(session -> {
            try {
                session.close();
            } catch (Exception e) {
                logger.warn("Error closing session: {}", session.getSessionId(), e);
            }
        });
        activeSessions.clear();
        
        // Close speech config
        if (speechConfig != null) {
            speechConfig.close();
        }
    }
    
    @Override
    public CompletableFuture<TranscriptionResult> transcribe(byte[] audioData, AudioFormat audioFormat, String language) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            
            try {
                // Create audio configuration from byte array
                AudioConfig audioConfig = createAudioConfig(audioData, audioFormat);
                
                // Set up speech recognizer
                SpeechRecognizer recognizer = createRecognizer(language, audioConfig);
                
                try {
                    // Perform recognition
                    SpeechRecognitionResult result = recognizer.recognizeOnceAsync().get();
                    
                    long processingTime = System.currentTimeMillis() - startTime;
                    
                    return createTranscriptionResult(result, processingTime, true);
                    
                } finally {
                    recognizer.close();
                    audioConfig.close();
                }
                
            } catch (Exception e) {
                logger.error("Transcription failed", e);
                return createErrorResult("Transcription failed: " + e.getMessage(), 
                                       System.currentTimeMillis() - startTime);
            }
        });
    }
    
    @Override
    public CompletableFuture<StreamingSession> startStreamingTranscription(String sessionId, AudioFormat audioFormat, 
                                                                         String language, StreamingTranscriptionCallback callback) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                logger.info("Starting streaming transcription for session: {}", sessionId);
                
                // Create push audio input stream
                PushAudioInputStream pushStream = PushAudioInputStream.create(
                    com.microsoft.cognitiveservices.speech.audio.AudioStreamFormat.getWaveFormatPCM(
                        audioFormat.getSampleRate(),
                        (short)audioFormat.getBitsPerSample(),
                        (short)audioFormat.getChannels()
                    )
                );
                
                AudioConfig audioConfig = AudioConfig.fromStreamInput(pushStream);
                SpeechRecognizer recognizer = createRecognizer(language, audioConfig);
                
                // Create streaming session
                StreamingSessionImpl session = new StreamingSessionImpl(sessionId, recognizer, pushStream, callback);
                
                // Set up event handlers
                setupRecognizerEventHandlers(recognizer, callback, session);
                
                // Start continuous recognition
                recognizer.startContinuousRecognitionAsync().get();
                
                // Store active session
                activeSessions.put(sessionId, session);
                
                logger.info("Streaming transcription started for session: {}", sessionId);
                return session;
                
            } catch (Exception e) {
                logger.error("Failed to start streaming transcription for session: {}", sessionId, e);
                callback.onError("Failed to start transcription: " + e.getMessage());
                throw new RuntimeException("Streaming transcription failed", e);
            }
        });
    }
    
    @Override
    public CompletableFuture<Void> sendAudioChunk(StreamingSession session, byte[] audioChunk) {
        return CompletableFuture.runAsync(() -> {
            try {
                StreamingSessionImpl sessionImpl = (StreamingSessionImpl) session;
                if (sessionImpl.isActive()) {
                    sessionImpl.pushStream.write(audioChunk);
                }
            } catch (Exception e) {
                logger.error("Failed to send audio chunk for session: {}", session.getSessionId(), e);
                throw new RuntimeException("Failed to send audio chunk", e);
            }
        });
    }
    
    @Override
    public CompletableFuture<TranscriptionResult> stopStreamingTranscription(StreamingSession session) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                StreamingSessionImpl sessionImpl = (StreamingSessionImpl) session;
                logger.info("Stopping streaming transcription for session: {}", session.getSessionId());
                
                // Stop recognition
                sessionImpl.recognizer.stopContinuousRecognitionAsync().get();
                
                // Close resources
                sessionImpl.close();
                
                // Remove from active sessions
                activeSessions.remove(session.getSessionId());
                
                logger.info("Streaming transcription stopped for session: {}", session.getSessionId());
                
                return createSuccessResult("Session stopped successfully", 0, true);
                
            } catch (Exception e) {
                logger.error("Failed to stop streaming transcription for session: {}", session.getSessionId(), e);
                return createErrorResult("Failed to stop transcription: " + e.getMessage(), 0);
            }
        });
    }
    
    @Override
    public CompletableFuture<LanguageDetectionResult> detectLanguage(byte[] audioData, AudioFormat audioFormat) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                if (!autoDetectEnabled) {
                    return createLanguageDetectionResult("en-US", 1.0, Collections.emptyList());
                }
                
                // Create audio configuration
                AudioConfig audioConfig = createAudioConfig(audioData, audioFormat);
                
                // Create language detection config
                AutoDetectSourceLanguageConfig autoDetectConfig = 
                    AutoDetectSourceLanguageConfig.fromLanguages(autoDetectLanguages);
                
                // Create recognizer with language detection
                SpeechRecognizer recognizer = new SpeechRecognizer(speechConfig, autoDetectConfig, audioConfig);
                
                try {
                    // Perform recognition with language detection
                    SpeechRecognitionResult result = recognizer.recognizeOnceAsync().get();
                    
                    String detectedLanguage = AutoDetectSourceLanguageResult.fromResult(result).getLanguage();
                    
                    return createLanguageDetectionResult(
                        detectedLanguage != null ? detectedLanguage : "en-US",
                        0.9, // Azure doesn't provide confidence scores for language detection
                        Collections.emptyList()
                    );
                    
                } finally {
                    recognizer.close();
                    audioConfig.close();
                }
                
            } catch (Exception e) {
                logger.error("Language detection failed", e);
                return createLanguageDetectionResult("en-US", 0.5, Collections.emptyList());
            }
        });
    }
    
    @Override
    public boolean isServiceAvailable() {
        return speechConfig != null && speechKey != null && !speechKey.isEmpty();
    }
    
    @Override
    public List<String> getSupportedLanguages() {
        return Arrays.asList(
            "en-US", "en-GB", "en-AU", "en-CA", "en-IN",
            "hi-IN", "es-ES", "fr-FR", "de-DE", "it-IT",
            "ja-JP", "ko-KR", "zh-CN", "zh-HK", "ar-SA"
        );
    }
    
    @Override
    public ServiceConfiguration getConfiguration() {
        return new ServiceConfigurationImpl();
    }
    
    // Helper methods
    
    private AudioConfig createAudioConfig(byte[] audioData, AudioFormat audioFormat) {
        // Convert byte array to AudioInputStream
        PushAudioInputStream pushStream = PushAudioInputStream.create(
            com.microsoft.cognitiveservices.speech.audio.AudioStreamFormat.getWaveFormatPCM(
                audioFormat.getSampleRate(),
                (short)audioFormat.getBitsPerSample(),
                (short)audioFormat.getChannels()
            )
        );
        
        pushStream.write(audioData);
        pushStream.close();
        
        return AudioConfig.fromStreamInput(pushStream);
    }
    
    private SpeechRecognizer createRecognizer(String language, AudioConfig audioConfig) {
        SpeechConfig config = speechConfig;
        
        if (language != null && !language.isEmpty()) {
            config.setSpeechRecognitionLanguage(language);
        }
        
        return new SpeechRecognizer(config, audioConfig);
    }
    
    private void setupRecognizerEventHandlers(SpeechRecognizer recognizer, StreamingTranscriptionCallback callback, StreamingSessionImpl session) {
        // Partial results (real-time transcription)
        recognizer.recognizing.addEventListener((s, e) -> {
            if (session.isActive()) {
                TranscriptionResult result = createTranscriptionResult(e.getResult(), 0, false);
                callback.onPartialResult(result);
            }
        });
        
        // Final results
        recognizer.recognized.addEventListener((s, e) -> {
            if (session.isActive()) {
                TranscriptionResult result = createTranscriptionResult(e.getResult(), 0, true);
                callback.onFinalResult(result);
            }
        });
        
        // Error handling
        recognizer.canceled.addEventListener((s, e) -> {
            logger.warn("Recognition canceled for session: {} - Reason: {}", session.getSessionId(), e.getReason());
            if (e.getReason() == CancellationReason.Error) {
                callback.onError("Recognition error: " + e.getErrorDetails());
            }
        });
        
        // Session events
        recognizer.sessionStopped.addEventListener((s, e) -> {
            logger.info("Recognition session stopped for: {}", session.getSessionId());
            callback.onSessionClosed();
        });
    }
    
    private TranscriptionResult createTranscriptionResult(SpeechRecognitionResult result, long processingTime, boolean isFinal) {
        if (result.getReason() == ResultReason.RecognizedSpeech) {
            return createSuccessResult(result.getText(), processingTime, isFinal);
        } else if (result.getReason() == ResultReason.NoMatch) {
            return createSuccessResult("", processingTime, isFinal);
        } else {
            return createErrorResult("Recognition failed: " + result.getReason(), processingTime);
        }
    }
    
    private TranscriptionResult createSuccessResult(String text, long processingTime, boolean isFinal) {
        return new TranscriptionResultImpl(text, 0.9, null, true, null, processingTime, isFinal);
    }
    
    private TranscriptionResult createErrorResult(String error, long processingTime) {
        return new TranscriptionResultImpl("", 0.0, null, false, error, processingTime, true);
    }
    
    private LanguageDetectionResult createLanguageDetectionResult(String language, double confidence, List<LanguageCandidate> candidates) {
        return new LanguageDetectionResultImpl(language, confidence, candidates);
    }
    
    // Implementation classes
    
    private static class StreamingSessionImpl implements StreamingSession {
        private final String sessionId;
        private final SpeechRecognizer recognizer;
        private final PushAudioInputStream pushStream;
        private final StreamingTranscriptionCallback callback;
        private volatile boolean active = true;
        
        public StreamingSessionImpl(String sessionId, SpeechRecognizer recognizer, 
                                  PushAudioInputStream pushStream, StreamingTranscriptionCallback callback) {
            this.sessionId = sessionId;
            this.recognizer = recognizer;
            this.pushStream = pushStream;
            this.callback = callback;
        }
        
        @Override
        public String getSessionId() {
            return sessionId;
        }
        
        @Override
        public boolean isActive() {
            return active;
        }
        
        @Override
        public void close() {
            active = false;
            try {
                if (pushStream != null) {
                    pushStream.close();
                }
                if (recognizer != null) {
                    recognizer.close();
                }
            } catch (Exception e) {
                logger.warn("Error closing session resources for: {}", sessionId, e);
            }
        }
    }
    
    private static class TranscriptionResultImpl implements TranscriptionResult {
        private final String text;
        private final double confidence;
        private final String detectedLanguage;
        private final boolean success;
        private final String errorMessage;
        private final long processingTimeMs;
        private final boolean isFinal;
        
        public TranscriptionResultImpl(String text, double confidence, String detectedLanguage,
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
        public String getText() {
            return text;
        }
        
        @Override
        public double getConfidence() {
            return confidence;
        }
        
        @Override
        public String getDetectedLanguage() {
            return detectedLanguage;
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
        public long getProcessingTimeMs() {
            return processingTimeMs;
        }
        
        @Override
        public boolean isFinal() {
            return isFinal;
        }
    }
    
    private static class LanguageDetectionResultImpl implements LanguageDetectionResult {
        private final String detectedLanguage;
        private final double confidence;
        private final List<LanguageCandidate> candidates;
        
        public LanguageDetectionResultImpl(String detectedLanguage, double confidence, List<LanguageCandidate> candidates) {
            this.detectedLanguage = detectedLanguage;
            this.confidence = confidence;
            this.candidates = candidates;
        }
        
        @Override
        public String getDetectedLanguage() {
            return detectedLanguage;
        }
        
        @Override
        public double getConfidence() {
            return confidence;
        }
        
        @Override
        public List<LanguageCandidate> getCandidates() {
            return candidates;
        }
    }
    
    private class ServiceConfigurationImpl implements ServiceConfiguration {
        @Override
        public String getProviderName() {
            return "Azure Cognitive Services Speech";
        }
        
        @Override
        public String getEndpoint() {
            return speechEndpoint != null ? speechEndpoint : 
                   String.format("https://%s.api.cognitive.microsoft.com/", speechRegion);
        }
        
        @Override
        public List<String> getSupportedLanguages() {
            return AzureSpeechService.this.getSupportedLanguages();
        }
        
        @Override
        public AudioFormat getDefaultAudioFormat() {
            return AudioFormat.pcm16k();
        }
    }
}
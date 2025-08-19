package com.interview.assistant.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Azure Speech Services REST API implementation (alternative to WebSocket SDK)
 * 
 * This implementation uses Azure's REST API instead of the WebSocket SDK,
 * which avoids the WebSocket authentication issues while maintaining functionality.
 */
@Service
@Profile("!test") // Use this as the primary Azure Speech implementation
public class AzureRestSpeechService implements ITranscriptionService {

    private static final Logger logger = LoggerFactory.getLogger(AzureRestSpeechService.class);

    @Value("${azure.speech.key}")
    private String speechKey;

    @Value("${azure.speech.region}")
    private String speechRegion;

    private String speechToTextEndpoint;

    @PostConstruct
    public void initialize() {
        try {
            this.speechToTextEndpoint = "http://localhost:3001/transcribe";
            
            logger.info("Azure REST Speech Service initialized for region: {}", speechRegion);
            logger.info("Using endpoint: {}", speechToTextEndpoint);
        } catch (Exception e) {
            logger.error("Failed to initialize Azure REST Speech Service", e);
            throw new RuntimeException("Azure REST Speech Service initialization failed", e);
        }
    }

    @Override
    public CompletableFuture<TranscriptionResult> transcribe(byte[] audioData, AudioFormat audioFormat, String language) {
        return CompletableFuture.supplyAsync(() -> {
            long startTime = System.currentTimeMillis();
            
            try {
                // Create WAV format from PCM data
                byte[] wavData = createWavFormat(audioData, audioFormat);
                
                // Add language parameter
                String endpoint = speechToTextEndpoint;
                if (language != null && !language.isEmpty()) {
                    endpoint += "?language=" + language;
                } else {
                    endpoint += "?language=en-US";
                }
                
                logger.debug("Sending transcription request to Azure: {} bytes", wavData.length);
                
                // Make REST call to Node.js bridge service
                java.net.URL url = new java.net.URL(endpoint);
                java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
                
                // Configure connection
                connection.setRequestMethod("POST");
                connection.setDoOutput(true);
                connection.setDoInput(true);
                connection.setUseCaches(false);
                
                // Set headers for bridge service
                connection.setRequestProperty("Content-Type", "audio/wav");
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("Content-Length", String.valueOf(wavData.length));
                
                // Write data
                try (java.io.OutputStream os = connection.getOutputStream()) {
                    os.write(wavData);
                    os.flush();
                }
                
                // Get response
                int responseCode = connection.getResponseCode();
                String responseBody;
                
                try (java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(
                            responseCode == 200 ? connection.getInputStream() : connection.getErrorStream()))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    responseBody = sb.toString();
                }
                
                long processingTime = System.currentTimeMillis() - startTime;
                
                if (responseCode == 200) {
                    // Parse Azure response
                    logger.debug("Azure response: {}", responseBody);
                    
                    // Parse JSON response to extract text
                    ObjectMapper mapper = new ObjectMapper();
                    var responseMap = mapper.readValue(responseBody, java.util.Map.class);
                    
                    String recognitionStatus = (String) responseMap.get("RecognitionStatus");
                    String displayText = (String) responseMap.get("DisplayText");
                    
                    if ("Success".equals(recognitionStatus)) {
                        if (displayText != null && !displayText.trim().isEmpty()) {
                            logger.info("Transcription successful: '{}'", displayText);
                            return createSuccessResult(displayText, processingTime, true);
                        } else {
                            logger.debug("Transcription successful but empty (silence detected): status={}", recognitionStatus);
                            return createSuccessResult("", processingTime, true);
                        }
                    } else {
                        logger.warn("Transcription failed: status={}, text={}", recognitionStatus, displayText);
                        return createSuccessResult("", processingTime, true);
                    }
                } else {
                    logger.error("Azure REST API error: {} - {}", responseCode, responseBody);
                    return createErrorResult("Azure API error: " + responseCode, processingTime);
                }
                
            } catch (Exception e) {
                logger.error("Transcription failed", e);
                return createErrorResult("Transcription failed: " + e.getMessage(), 
                        System.currentTimeMillis() - startTime);
            }
        });
    }

    @Override
    public CompletableFuture<StreamingSession> startStreamingTranscription(String sessionId, AudioFormat audioFormat, String language, StreamingTranscriptionCallback callback) {
        // For REST API, we simulate streaming by creating a session that processes audio chunks
        return CompletableFuture.completedFuture(new RestStreamingSession(sessionId, audioFormat, language, callback));
    }

    @Override
    public CompletableFuture<Void> sendAudioChunk(StreamingSession session, byte[] audioChunk) {
        return CompletableFuture.runAsync(() -> {
            RestStreamingSession restSession = (RestStreamingSession) session;
            restSession.processAudioChunk(audioChunk);
        });
    }

    @Override
    public CompletableFuture<TranscriptionResult> stopStreamingTranscription(StreamingSession session) {
        return CompletableFuture.supplyAsync(() -> {
            RestStreamingSession restSession = (RestStreamingSession) session;
            return restSession.finalizeTranscription();
        });
    }

    @Override
    public CompletableFuture<LanguageDetectionResult> detectLanguage(byte[] audioData, AudioFormat audioFormat) {
        return CompletableFuture.completedFuture(
            new LanguageDetectionResultImpl("en-US", 0.9, Collections.emptyList())
        );
    }

    @Override
    public boolean isServiceAvailable() {
        return speechKey != null && !speechKey.isEmpty() && speechRegion != null && !speechRegion.isEmpty();
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

    // Helper method to create WAV format from PCM data
    private byte[] createWavFormat(byte[] pcmData, AudioFormat audioFormat) throws IOException {
        ByteArrayOutputStream wavStream = new ByteArrayOutputStream();
        
        // WAV header
        int sampleRate = audioFormat.getSampleRate();
        int channels = audioFormat.getChannels();
        int bitsPerSample = audioFormat.getBitsPerSample();
        int byteRate = sampleRate * channels * bitsPerSample / 8;
        int blockAlign = channels * bitsPerSample / 8;
        int dataSize = pcmData.length;
        int fileSize = 44 + dataSize;
        
        // Write WAV header
        wavStream.write("RIFF".getBytes());
        wavStream.write(intToByteArray(fileSize - 8, 4)); // File size - 8
        wavStream.write("WAVE".getBytes());
        wavStream.write("fmt ".getBytes());
        wavStream.write(intToByteArray(16, 4)); // Sub-chunk size
        wavStream.write(intToByteArray(1, 2)); // Audio format (PCM)
        wavStream.write(intToByteArray(channels, 2));
        wavStream.write(intToByteArray(sampleRate, 4));
        wavStream.write(intToByteArray(byteRate, 4));
        wavStream.write(intToByteArray(blockAlign, 2));
        wavStream.write(intToByteArray(bitsPerSample, 2));
        wavStream.write("data".getBytes());
        wavStream.write(intToByteArray(dataSize, 4));
        wavStream.write(pcmData);
        
        return wavStream.toByteArray();
    }
    
    private byte[] intToByteArray(int value, int bytes) {
        byte[] result = new byte[bytes];
        for (int i = 0; i < bytes; i++) {
            result[i] = (byte) (value >> (i * 8));
        }
        return result;
    }

    // Streaming session implementation that accumulates audio chunks
    private class RestStreamingSession implements StreamingSession {
        private final String sessionId;
        private final AudioFormat audioFormat;
        private final String language;
        private final StreamingTranscriptionCallback callback;
        private final ByteArrayOutputStream audioBuffer = new ByteArrayOutputStream();
        private volatile boolean active = true;
        private long lastProcessTime = 0;

        public RestStreamingSession(String sessionId, AudioFormat audioFormat, String language, StreamingTranscriptionCallback callback) {
            this.sessionId = sessionId;
            this.audioFormat = audioFormat;
            this.language = language;
            this.callback = callback;
        }

        public void processAudioChunk(byte[] audioChunk) {
            if (!active) return;
            
            try {
                audioBuffer.write(audioChunk);
                
                // Process accumulated audio every 500ms for more responsive transcription
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastProcessTime > 500 && audioBuffer.size() > 2000) {
                    byte[] accumulatedAudio = audioBuffer.toByteArray();
                    audioBuffer.reset();
                    lastProcessTime = currentTime;
                    
                    // Transcribe the accumulated audio
                    transcribe(accumulatedAudio, audioFormat, language)
                        .thenAccept(result -> {
                            if (result.isSuccess()) {
                                if (!result.getText().trim().isEmpty()) {
                                    // Send actual transcription results
                                    callback.onFinalResult(result);
                                    logger.info("Sent transcription to frontend: '{}'", result.getText());
                                } else {
                                    // Send empty result for debugging visibility
                                    logger.debug("Successful transcription but empty text (silence)");
                                    callback.onFinalResult(result);
                                }
                            } else {
                                callback.onError("Transcription failed: " + result.getErrorMessage());
                            }
                        })
                        .exceptionally(throwable -> {
                            callback.onError("Transcription error: " + throwable.getMessage());
                            return null;
                        });
                }
            } catch (IOException e) {
                callback.onError("Audio processing error: " + e.getMessage());
            }
        }

        public TranscriptionResult finalizeTranscription() {
            active = false;
            
            if (audioBuffer.size() > 0) {
                try {
                    byte[] finalAudio = audioBuffer.toByteArray();
                    return transcribe(finalAudio, audioFormat, language).get();
                } catch (Exception e) {
                    return createErrorResult("Final transcription failed: " + e.getMessage(), 0);
                }
            }
            
            return createSuccessResult("", 0, true);
        }

        @Override
        public String getSessionId() { return sessionId; }
        
        @Override
        public boolean isActive() { return active; }
        
        @Override
        public void close() { active = false; }
    }

    // Helper methods for creating results
    private TranscriptionResult createSuccessResult(String text, long processingTime, boolean isFinal) {
        return new TranscriptionResultImpl(text, 0.9, null, true, null, processingTime, isFinal);
    }

    private TranscriptionResult createErrorResult(String error, long processingTime) {
        return new TranscriptionResultImpl("", 0.0, null, false, error, processingTime, true);
    }

    // Implementation classes (reuse from AzureSpeechService)
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

        @Override public String getText() { return text; }
        @Override public double getConfidence() { return confidence; }
        @Override public String getDetectedLanguage() { return detectedLanguage; }
        @Override public boolean isSuccess() { return success; }
        @Override public String getErrorMessage() { return errorMessage; }
        @Override public long getProcessingTimeMs() { return processingTimeMs; }
        @Override public boolean isFinal() { return isFinal; }
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

        @Override public String getDetectedLanguage() { return detectedLanguage; }
        @Override public double getConfidence() { return confidence; }
        @Override public List<LanguageCandidate> getCandidates() { return candidates; }
    }

    private class ServiceConfigurationImpl implements ServiceConfiguration {
        @Override public String getProviderName() { return "Azure Cognitive Services Speech (REST)"; }
        @Override public String getEndpoint() { return speechToTextEndpoint; }
        @Override public List<String> getSupportedLanguages() { return AzureRestSpeechService.this.getSupportedLanguages(); }
        @Override public AudioFormat getDefaultAudioFormat() { return AudioFormat.pcm16k(); }
    }
}
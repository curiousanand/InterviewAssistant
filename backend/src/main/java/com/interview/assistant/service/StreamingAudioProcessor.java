package com.interview.assistant.service;

import com.interview.assistant.event.*;
import com.interview.assistant.model.AudioChunk;
import com.interview.assistant.model.AudioSession;
import com.interview.assistant.model.SilenceDetectionResult;
import com.interview.assistant.model.VADResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Continuous audio stream processor for real-time conversation orchestration
 * <p>
 * Why: Manages sliding window audio buffers and silence detection for conversation flow
 * Pattern: Event-driven processing - emits domain events for conversation orchestration
 * Rationale: Core component for real-time multimodal conversation pipeline
 */
@Service
public class StreamingAudioProcessor {

    private static final Logger logger = LoggerFactory.getLogger(StreamingAudioProcessor.class);
    // Audio processing configuration
    private static final int SAMPLE_RATE = 16000; // 16kHz
    private static final int CHANNELS = 1; // Mono
    private static final int CHUNK_DURATION_MS = 100; // 100ms chunks
    private static final int SILENCE_THRESHOLD_MS = 800; // 800ms silence detection
    private static final int MAX_BUFFER_DURATION_MS = 30000; // 30s max buffer
    private static final double ENERGY_THRESHOLD = 0.01; // VAD energy threshold
    // Session management
    private final Map<String, AudioSession> activeSessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final ExecutorService asyncProcessor = Executors.newFixedThreadPool(8);
    // Performance monitoring
    private final AtomicLong totalChunksProcessed = new AtomicLong(0);
    private final AtomicLong totalSessionsCreated = new AtomicLong(0);
    @Autowired
    private ApplicationEventPublisher eventPublisher;
    @Autowired
    private ITranscriptionService transcriptionService;

    /**
     * Initialize streaming session for a user
     */
    public CompletableFuture<String> initializeSession(String sessionId, AudioSessionConfig config) {
        logger.info("Initializing streaming audio session: {}", sessionId);

        return CompletableFuture.supplyAsync(() -> {
            AudioSession session = new AudioSession(sessionId, config);
            activeSessions.put(sessionId, session);
            totalSessionsCreated.incrementAndGet();

            // Start silence detection monitoring for this session
            startSilenceMonitoring(session);

            // Emit session initialized event
            eventPublisher.publishEvent(new AudioSessionInitializedEvent(sessionId));

            logger.info("Audio session initialized: {} with config: {}", sessionId, config);
            return sessionId;
        }, asyncProcessor);
    }

    /**
     * Process continuous audio stream chunk
     */
    public CompletableFuture<AudioProcessingResult> processAudioChunk(String sessionId, byte[] audioData) {
        AudioSession session = activeSessions.get(sessionId);
        if (session == null) {
            return CompletableFuture.completedFuture(
                    AudioProcessingResult.error("Session not found: " + sessionId));
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                totalChunksProcessed.incrementAndGet();

                // Add chunk to sliding window buffer
                AudioChunk chunk = new AudioChunk(audioData, System.currentTimeMillis());
                session.addAudioChunk(chunk);

                // Perform voice activity detection
                VADResult vadResult = performVAD(chunk);
                session.updateVADState(vadResult);

                // Check for silence/speech transitions
                SilenceDetectionResult silenceResult = detectSilenceTransition(session);

                // Emit appropriate events based on state transitions
                if (silenceResult.hasStateChanged()) {
                    if (silenceResult.isSpeech()) {
                        eventPublisher.publishEvent(new SpeechDetectedEvent(sessionId, silenceResult));
                    } else {
                        eventPublisher.publishEvent(new SilenceDetectedEvent(sessionId, silenceResult));
                    }
                }

                // If we have accumulated enough speech data, trigger transcription
                if (session.shouldTriggerTranscription()) {
                    triggerStreamingTranscription(session);
                }

                return AudioProcessingResult.success(sessionId, vadResult, silenceResult);

            } catch (Exception e) {
                logger.error("Error processing audio chunk for session: {}", sessionId, e);
                return AudioProcessingResult.error("Processing failed: " + e.getMessage());
            }
        }, asyncProcessor);
    }

    /**
     * Finalize session and cleanup resources
     */
    public CompletableFuture<Void> finalizeSession(String sessionId) {
        logger.info("Finalizing audio session: {}", sessionId);

        return CompletableFuture.runAsync(() -> {
            AudioSession session = activeSessions.remove(sessionId);
            if (session != null) {
                // Process any remaining audio data
                if (session.hasUnprocessedAudio()) {
                    triggerFinalTranscription(session);
                }

                // Cleanup session resources
                session.cleanup();

                // Emit session finalized event
                eventPublisher.publishEvent(new AudioSessionFinalizedEvent(sessionId));

                logger.info("Audio session finalized: {}", sessionId);
            }
        }, asyncProcessor);
    }

    /**
     * Perform voice activity detection on audio chunk
     */
    private VADResult performVAD(AudioChunk chunk) {
        // Convert byte array to float array for processing
        float[] samples = convertBytesToFloats(chunk.getData());

        // Calculate RMS energy
        double energy = calculateRMSEnergy(samples);

        // Simple energy-based VAD
        boolean hasSpeech = energy > ENERGY_THRESHOLD;
        double confidence = Math.min(energy / ENERGY_THRESHOLD, 1.0);

        return new VADResult(hasSpeech, energy, confidence, chunk.getTimestamp());
    }

    /**
     * Detect silence/speech transitions
     */
    private SilenceDetectionResult detectSilenceTransition(AudioSession session) {
        List<VADResult> recentResults = session.getRecentVADResults(SILENCE_THRESHOLD_MS);

        if (recentResults.isEmpty()) {
            return new SilenceDetectionResult(false, false, 0);
        }

        // Check current state
        boolean currentlySpeaking = recentResults.get(recentResults.size() - 1).hasSpeech();

        // Check for consistent silence or speech over threshold duration
        long currentTime = System.currentTimeMillis();
        boolean stateChanged = false;

        if (currentlySpeaking && !session.isCurrentlySpeaking()) {
            // Transition from silence to speech
            session.setSpeechState(true, currentTime);
            stateChanged = true;
            logger.debug("Speech detected in session: {}", session.getSessionId());

        } else if (!currentlySpeaking && session.isCurrentlySpeaking()) {
            // Check if silence has been consistent for threshold duration
            long silenceStartTime = findSilenceStartTime(recentResults);
            long silenceDuration = currentTime - silenceStartTime;

            if (silenceDuration >= SILENCE_THRESHOLD_MS) {
                session.setSpeechState(false, currentTime);
                stateChanged = true;
                logger.debug("Silence detected in session: {} ({}ms)", session.getSessionId(), silenceDuration);
            }
        }

        return new SilenceDetectionResult(stateChanged, currentlySpeaking,
                currentlySpeaking ? 0 : getSilenceDuration(session));
    }

    /**
     * Trigger streaming transcription for accumulated audio
     */
    private void triggerStreamingTranscription(AudioSession session) {
        byte[] audioBuffer = session.getAudioBufferForTranscription();

        if (audioBuffer.length == 0) {
            return;
        }

        logger.debug("Triggering transcription for session: {} ({} bytes)",
                session.getSessionId(), audioBuffer.length);

        // Async transcription to avoid blocking audio stream
        CompletableFuture.runAsync(() -> {
            try {
                ITranscriptionService.AudioFormat format = ITranscriptionService.AudioFormat.pcm16k();

                transcriptionService.transcribe(audioBuffer, format, "auto")
                        .thenAccept(result -> {
                            if (result.isSuccess()) {
                                // Emit transcription events
                                if (result.getText() != null && !result.getText().trim().isEmpty()) {
                                    if (result.isFinal()) {
                                        eventPublisher.publishEvent(new TranscriptionFinalEvent(
                                                session.getSessionId(), result));
                                    } else {
                                        eventPublisher.publishEvent(new TranscriptionPartialEvent(
                                                session.getSessionId(), result));
                                    }
                                }
                            } else {
                                logger.warn("Transcription failed for session: {} - {}",
                                        session.getSessionId(), result.getErrorMessage());
                            }
                        })
                        .exceptionally(throwable -> {
                            logger.error("Transcription error for session: {}", session.getSessionId(), throwable);
                            return null;
                        });

            } catch (Exception e) {
                logger.error("Error triggering transcription for session: {}", session.getSessionId(), e);
            }
        }, asyncProcessor);

        // Mark audio as processed
        session.markAudioAsProcessed();
    }

    /**
     * Trigger final transcription for remaining audio
     */
    private void triggerFinalTranscription(AudioSession session) {
        logger.debug("Triggering final transcription for session: {}", session.getSessionId());

        byte[] remainingAudio = session.getRemainingAudioBuffer();
        if (remainingAudio.length > 0) {
            // Process final chunk synchronously
            try {
                ITranscriptionService.AudioFormat format = ITranscriptionService.AudioFormat.pcm16k();

                CompletableFuture<ITranscriptionService.TranscriptionResult> future =
                        transcriptionService.transcribe(remainingAudio, format, "auto");

                ITranscriptionService.TranscriptionResult result = future.get(5, TimeUnit.SECONDS);

                if (result.isSuccess() && result.getText() != null && !result.getText().trim().isEmpty()) {
                    eventPublisher.publishEvent(new TranscriptionFinalEvent(session.getSessionId(), result));
                }

            } catch (Exception e) {
                logger.warn("Final transcription failed for session: {}", session.getSessionId(), e);
            }
        }
    }

    /**
     * Start silence monitoring for a session
     */
    private void startSilenceMonitoring(AudioSession session) {
        scheduler.scheduleAtFixedRate(() -> {
            try {
                if (activeSessions.containsKey(session.getSessionId())) {
                    // Check for extended silence or inactivity
                    long lastActivity = session.getLastActivityTime();
                    long inactivityDuration = System.currentTimeMillis() - lastActivity;

                    if (inactivityDuration > MAX_BUFFER_DURATION_MS) {
                        logger.info("Session {} inactive for {}ms, triggering cleanup",
                                session.getSessionId(), inactivityDuration);
                        finalizeSession(session.getSessionId());
                    }
                }
            } catch (Exception e) {
                logger.error("Error in silence monitoring for session: {}", session.getSessionId(), e);
            }
        }, 1, 1, TimeUnit.SECONDS);
    }

    // Utility methods

    private float[] convertBytesToFloats(byte[] bytes) {
        // Convert 16-bit PCM bytes to float array
        float[] floats = new float[bytes.length / 2];
        for (int i = 0; i < floats.length; i++) {
            short sample = (short) ((bytes[i * 2 + 1] << 8) | (bytes[i * 2] & 0xFF));
            floats[i] = sample / 32768.0f; // Normalize to [-1, 1]
        }
        return floats;
    }

    private double calculateRMSEnergy(float[] samples) {
        double sum = 0.0;
        for (float sample : samples) {
            sum += sample * sample;
        }
        return Math.sqrt(sum / samples.length);
    }

    private long findSilenceStartTime(List<VADResult> results) {
        for (int i = results.size() - 1; i >= 0; i--) {
            if (results.get(i).hasSpeech()) {
                return i < results.size() - 1 ? results.get(i + 1).getTimestamp() : System.currentTimeMillis();
            }
        }
        return results.isEmpty() ? System.currentTimeMillis() : results.get(0).getTimestamp();
    }

    private long getSilenceDuration(AudioSession session) {
        if (session.isCurrentlySpeaking()) {
            return 0;
        }
        return System.currentTimeMillis() - session.getLastSpeechTime();
    }

    // Public getters for monitoring

    public int getActiveSessionsCount() {
        return activeSessions.size();
    }

    public long getTotalChunksProcessed() {
        return totalChunksProcessed.get();
    }

    public long getTotalSessionsCreated() {
        return totalSessionsCreated.get();
    }

    public Map<String, Object> getSessionStats(String sessionId) {
        AudioSession session = activeSessions.get(sessionId);
        if (session == null) {
            return Map.of("error", "Session not found");
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("sessionId", sessionId);
        stats.put("isActive", true);
        stats.put("chunksReceived", session.getChunksReceived());
        stats.put("bufferSize", session.getBufferSize());
        stats.put("isCurrentlySpeaking", session.isCurrentlySpeaking());
        stats.put("lastActivity", session.getLastActivityTime());
        stats.put("processingLatency", session.getAverageProcessingLatency());
        return stats;
    }

    /**
     * Cleanup all resources
     */
    public void shutdown() {
        logger.info("Shutting down StreamingAudioProcessor...");

        // Finalize all active sessions
        Set<String> sessionIds = new HashSet<>(activeSessions.keySet());
        List<CompletableFuture<Void>> finalizationTasks = sessionIds.stream()
                .map(this::finalizeSession)
                .toList();

        // Wait for all sessions to finalize
        CompletableFuture.allOf(finalizationTasks.toArray(new CompletableFuture[0]))
                .thenRun(() -> {
                    scheduler.shutdown();
                    asyncProcessor.shutdown();
                    logger.info("StreamingAudioProcessor shutdown complete");
                });
    }

    // Inner classes for data structures

    public static class AudioSessionConfig {
        private final int silenceThresholdMs;
        private final double energyThreshold;
        private final boolean adaptiveVAD;
        private final String language;

        public AudioSessionConfig(int silenceThresholdMs, double energyThreshold, boolean adaptiveVAD, String language) {
            this.silenceThresholdMs = silenceThresholdMs;
            this.energyThreshold = energyThreshold;
            this.adaptiveVAD = adaptiveVAD;
            this.language = language;
        }

        // Getters
        public int getSilenceThresholdMs() {
            return silenceThresholdMs;
        }

        public double getEnergyThreshold() {
            return energyThreshold;
        }

        public boolean isAdaptiveVAD() {
            return adaptiveVAD;
        }

        public String getLanguage() {
            return language;
        }

        @Override
        public String toString() {
            return String.format("AudioSessionConfig{silence=%dms, energy=%.3f, adaptive=%s, lang=%s}",
                    silenceThresholdMs, energyThreshold, adaptiveVAD, language);
        }
    }

    public static class AudioProcessingResult {
        private final boolean success;
        private final String sessionId;
        private final String errorMessage;
        private final VADResult vadResult;
        private final SilenceDetectionResult silenceResult;
        private final long timestamp;

        private AudioProcessingResult(boolean success, String sessionId, String errorMessage,
                                      VADResult vadResult, SilenceDetectionResult silenceResult) {
            this.success = success;
            this.sessionId = sessionId;
            this.errorMessage = errorMessage;
            this.vadResult = vadResult;
            this.silenceResult = silenceResult;
            this.timestamp = System.currentTimeMillis();
        }

        public static AudioProcessingResult success(String sessionId, VADResult vadResult, SilenceDetectionResult silenceResult) {
            return new AudioProcessingResult(true, sessionId, null, vadResult, silenceResult);
        }

        public static AudioProcessingResult error(String errorMessage) {
            return new AudioProcessingResult(false, null, errorMessage, null, null);
        }

        // Getters
        public boolean isSuccess() {
            return success;
        }

        public String getSessionId() {
            return sessionId;
        }

        public String getErrorMessage() {
            return errorMessage;
        }

        public VADResult getVadResult() {
            return vadResult;
        }

        public SilenceDetectionResult getSilenceResult() {
            return silenceResult;
        }

        public long getTimestamp() {
            return timestamp;
        }
    }
}
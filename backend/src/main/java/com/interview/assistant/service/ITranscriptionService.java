package com.interview.assistant.service;

import java.util.concurrent.CompletableFuture;

/**
 * Transcription Service interface for speech-to-text conversion
 * <p>
 * Why: Abstracts transcription service implementations for flexible provider switching
 * Pattern: Strategy pattern - allows different speech service providers
 * Rationale: Enables testing with mock implementations and provider independence
 */
public interface ITranscriptionService {

    /**
     * Transcribe audio data to text
     * Why: Primary speech-to-text conversion functionality
     *
     * @param audioData   Raw audio data
     * @param audioFormat Audio format specification
     * @param language    Target or detected language
     * @return Future containing transcription result
     */
    CompletableFuture<TranscriptionResult> transcribe(byte[] audioData, AudioFormat audioFormat, String language);

    /**
     * Start streaming transcription session
     * Why: Real-time transcription for live audio streams
     *
     * @param sessionId   Session identifier
     * @param audioFormat Audio format specification
     * @param language    Target or detected language
     * @param callback    Callback for streaming results
     * @return Future containing session handle
     */
    CompletableFuture<StreamingSession> startStreamingTranscription(String sessionId, AudioFormat audioFormat,
                                                                    String language, StreamingTranscriptionCallback callback);

    /**
     * Send audio chunk to streaming session
     * Why: Feed audio data to ongoing transcription
     *
     * @param session    Streaming session handle
     * @param audioChunk Audio data chunk
     * @return Future indicating processing status
     */
    CompletableFuture<Void> sendAudioChunk(StreamingSession session, byte[] audioChunk);

    /**
     * Stop streaming transcription session
     * Why: Clean session termination and final results
     *
     * @param session Streaming session handle
     * @return Future containing final transcription
     */
    CompletableFuture<TranscriptionResult> stopStreamingTranscription(StreamingSession session);

    /**
     * Detect language from audio
     * Why: Automatic language detection for multilingual support
     *
     * @param audioData   Raw audio data
     * @param audioFormat Audio format specification
     * @return Future containing detected language
     */
    CompletableFuture<LanguageDetectionResult> detectLanguage(byte[] audioData, AudioFormat audioFormat);

    /**
     * Check if service is available
     * Why: Health checking and failover support
     *
     * @return True if service is responsive
     */
    boolean isServiceAvailable();

    /**
     * Get supported languages
     * Why: Service capability discovery
     *
     * @return List of supported language codes
     */
    java.util.List<String> getSupportedLanguages();

    /**
     * Get service configuration
     * Why: Service introspection and monitoring
     *
     * @return Service configuration information
     */
    ServiceConfiguration getConfiguration();

    /**
     * Transcription result value object
     */
    interface TranscriptionResult {
        String getText();

        double getConfidence();

        String getDetectedLanguage();

        boolean isSuccess();

        String getErrorMessage();

        long getProcessingTimeMs();

        boolean isFinal();
    }

    /**
     * Audio format specification
     */
    interface AudioFormat {
        static AudioFormat pcm16k() {
            return new AudioFormat() {
                public int getSampleRate() {
                    return 16000;
                }

                public int getChannels() {
                    return 1;
                }

                public int getBitsPerSample() {
                    return 16;
                }

                public String getEncoding() {
                    return "PCM";
                }
            };
        }

        int getSampleRate();

        int getChannels();

        int getBitsPerSample();

        String getEncoding();
    }

    /**
     * Streaming session handle
     */
    interface StreamingSession {
        String getSessionId();

        boolean isActive();

        void close();
    }

    /**
     * Streaming transcription callback interface
     */
    interface StreamingTranscriptionCallback {
        void onPartialResult(TranscriptionResult result);

        void onFinalResult(TranscriptionResult result);

        void onError(String error);

        void onSessionClosed();
    }

    /**
     * Language detection result
     */
    interface LanguageDetectionResult {
        String getDetectedLanguage();

        double getConfidence();

        java.util.List<LanguageCandidate> getCandidates();
    }

    /**
     * Language detection candidate
     */
    interface LanguageCandidate {
        String getLanguage();

        double getConfidence();
    }

    /**
     * Service configuration value object
     */
    interface ServiceConfiguration {
        String getProviderName();

        String getEndpoint();

        java.util.List<String> getSupportedLanguages();

        AudioFormat getDefaultAudioFormat();
    }
}
package com.interview.assistant.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Voice Activity Detection service for real-time silence detection
 * <p>
 * Why: Implements smart pause detection for conversation orchestration
 * Pattern: State machine for tracking voice activity states
 * Rationale: Essential for triggering AI responses at natural conversation pauses
 */
@Service
public class VoiceActivityDetector {

    private static final Logger logger = LoggerFactory.getLogger(VoiceActivityDetector.class);

    // Pause detection thresholds (in milliseconds)
    private static final long SHORT_PAUSE_MS = 500;   // Natural gap, continue listening
    private static final long MEDIUM_PAUSE_MS = 1000; // End of thought, send to AI
    private static final long LONG_PAUSE_MS = 3000;   // User waiting, AI must reply now

    // Audio analysis parameters
    private static final double SILENCE_THRESHOLD = 0.01; // RMS threshold for silence
    private static final int SAMPLE_RATE = 16000;
    private static final int MIN_SPEECH_SAMPLES = 1600; // 100ms at 16kHz

    // Session state tracking
    private final Map<String, VoiceActivityState> sessionStates = new ConcurrentHashMap<>();

    /**
     * Process audio chunk and detect voice activity
     * 
     * @param sessionId Session identifier
     * @param audioData PCM audio data (16-bit, 16kHz, mono)
     * @return Voice activity detection result
     */
    public VoiceActivityResult processAudioChunk(String sessionId, byte[] audioData) {
        VoiceActivityState state = sessionStates.computeIfAbsent(sessionId, k -> new VoiceActivityState());
        
        // Calculate RMS energy for voice activity detection
        double rmsEnergy = calculateRMSEnergy(audioData);
        boolean hasVoice = rmsEnergy > SILENCE_THRESHOLD;
        
        Instant now = Instant.now();
        VoiceActivityResult result = updateVoiceActivityState(state, hasVoice, now);
        
        logger.debug("VAD for session {}: RMS={:.4f}, hasVoice={}, state={}", 
                    sessionId, rmsEnergy, hasVoice, state.currentState);
        
        return result;
    }

    /**
     * Update voice activity state machine
     */
    private VoiceActivityResult updateVoiceActivityState(VoiceActivityState state, boolean hasVoice, Instant now) {
        VoiceActivityResult.Builder resultBuilder = VoiceActivityResult.builder()
                .hasVoice(hasVoice)
                .timestamp(now);

        switch (state.currentState) {
            case LISTENING -> {
                if (hasVoice) {
                    // Start of speech detected
                    state.transitionTo(ActivityState.SPEAKING, now);
                    resultBuilder.event(VoiceActivityEvent.SPEECH_STARTED);
                } else {
                    // Continue listening for speech
                    resultBuilder.event(VoiceActivityEvent.LISTENING);
                }
            }
            
            case SPEAKING -> {
                if (hasVoice) {
                    // Continue speaking
                    state.lastVoiceAt = now;
                    resultBuilder.event(VoiceActivityEvent.SPEECH_CONTINUING);
                } else {
                    // Potential pause detected
                    state.transitionTo(ActivityState.PAUSING, now);
                    resultBuilder.event(VoiceActivityEvent.PAUSE_STARTED);
                }
            }
            
            case PAUSING -> {
                if (hasVoice) {
                    // False alarm - speech resumed
                    state.transitionTo(ActivityState.SPEAKING, now);
                    resultBuilder.event(VoiceActivityEvent.SPEECH_RESUMED);
                } else {
                    // Check pause duration
                    long pauseDuration = java.time.Duration.between(state.stateStartedAt, now).toMillis();
                    PauseType pauseType = classifyPause(pauseDuration);
                    
                    resultBuilder.pauseDuration(pauseDuration).pauseType(pauseType);
                    
                    if (pauseDuration >= MEDIUM_PAUSE_MS) {
                        // Significant pause - trigger AI processing
                        state.transitionTo(ActivityState.WAITING_FOR_AI, now);
                        resultBuilder.event(VoiceActivityEvent.SIGNIFICANT_PAUSE);
                    } else {
                        // Short pause - continue monitoring
                        resultBuilder.event(VoiceActivityEvent.SHORT_PAUSE);
                    }
                }
            }
            
            case WAITING_FOR_AI -> {
                if (hasVoice) {
                    // User interrupted AI - resume listening
                    state.transitionTo(ActivityState.SPEAKING, now);
                    resultBuilder.event(VoiceActivityEvent.USER_INTERRUPTED);
                } else {
                    // Continue waiting for AI response
                    resultBuilder.event(VoiceActivityEvent.WAITING);
                }
            }
            
            case AI_RESPONDING -> {
                if (hasVoice) {
                    // User interrupted AI response
                    state.transitionTo(ActivityState.SPEAKING, now);
                    resultBuilder.event(VoiceActivityEvent.AI_INTERRUPTED);
                } else {
                    // AI continues responding
                    resultBuilder.event(VoiceActivityEvent.AI_SPEAKING);
                }
            }
        }

        return resultBuilder.build();
    }

    /**
     * Classify pause duration into categories
     */
    private PauseType classifyPause(long pauseDurationMs) {
        if (pauseDurationMs < SHORT_PAUSE_MS) {
            return PauseType.NATURAL_GAP;
        } else if (pauseDurationMs < MEDIUM_PAUSE_MS) {
            return PauseType.SHORT_PAUSE;
        } else if (pauseDurationMs < LONG_PAUSE_MS) {
            return PauseType.END_OF_THOUGHT;
        } else {
            return PauseType.USER_WAITING;
        }
    }

    /**
     * Calculate RMS energy for voice activity detection
     */
    private double calculateRMSEnergy(byte[] audioData) {
        if (audioData.length < 2) return 0.0;
        
        long sum = 0;
        int sampleCount = audioData.length / 2; // 16-bit samples
        
        for (int i = 0; i < audioData.length - 1; i += 2) {
            // Convert bytes to 16-bit sample
            short sample = (short) ((audioData[i + 1] << 8) | (audioData[i] & 0xFF));
            sum += sample * sample;
        }
        
        return Math.sqrt((double) sum / sampleCount) / 32768.0; // Normalize to 0-1
    }

    /**
     * Notify VAD that AI has started responding
     */
    public void onAIResponseStarted(String sessionId) {
        VoiceActivityState state = sessionStates.get(sessionId);
        if (state != null) {
            state.transitionTo(ActivityState.AI_RESPONDING, Instant.now());
            logger.debug("VAD state updated: AI started responding for session {}", sessionId);
        }
    }

    /**
     * Notify VAD that AI has finished responding
     */
    public void onAIResponseFinished(String sessionId) {
        VoiceActivityState state = sessionStates.get(sessionId);
        if (state != null) {
            state.transitionTo(ActivityState.LISTENING, Instant.now());
            logger.debug("VAD state updated: AI finished responding for session {}", sessionId);
        }
    }

    /**
     * Clean up session state
     */
    public void cleanupSession(String sessionId) {
        sessionStates.remove(sessionId);
        logger.debug("VAD session state cleaned up for session {}", sessionId);
    }

    /**
     * Voice activity state for a session
     */
    private static class VoiceActivityState {
        ActivityState currentState = ActivityState.LISTENING;
        Instant stateStartedAt = Instant.now();
        Instant lastVoiceAt = null;
        
        void transitionTo(ActivityState newState, Instant timestamp) {
            this.currentState = newState;
            this.stateStartedAt = timestamp;
            if (newState == ActivityState.SPEAKING) {
                this.lastVoiceAt = timestamp;
            }
        }
    }

    /**
     * Voice activity states
     */
    public enum ActivityState {
        LISTENING,        // Waiting for speech to start
        SPEAKING,         // User is actively speaking
        PAUSING,          // Potential pause detected
        WAITING_FOR_AI,   // Waiting for AI to respond
        AI_RESPONDING     // AI is currently responding
    }

    /**
     * Voice activity events
     */
    public enum VoiceActivityEvent {
        LISTENING,           // Listening for speech
        SPEECH_STARTED,      // Speech detected after silence
        SPEECH_CONTINUING,   // Ongoing speech
        SPEECH_RESUMED,      // Speech resumed after brief pause
        PAUSE_STARTED,       // Potential pause detected
        SHORT_PAUSE,         // Brief pause, continue listening
        SIGNIFICANT_PAUSE,   // Meaningful pause, trigger AI
        USER_INTERRUPTED,    // User started speaking while waiting for AI
        AI_INTERRUPTED,      // User interrupted AI response
        WAITING,             // Waiting for AI response
        AI_SPEAKING          // AI is responding
    }

    /**
     * Pause classification
     */
    public enum PauseType {
        NATURAL_GAP,     // <500ms - natural speech gap
        SHORT_PAUSE,     // 500ms-1s - brief pause
        END_OF_THOUGHT,  // 1s-3s - end of thought, send to AI
        USER_WAITING     // >3s - user is waiting, AI must reply
    }

    /**
     * Voice activity detection result
     */
    public static class VoiceActivityResult {
        private final boolean hasVoice;
        private final VoiceActivityEvent event;
        private final PauseType pauseType;
        private final long pauseDuration;
        private final Instant timestamp;

        private VoiceActivityResult(Builder builder) {
            this.hasVoice = builder.hasVoice;
            this.event = builder.event;
            this.pauseType = builder.pauseType;
            this.pauseDuration = builder.pauseDuration;
            this.timestamp = builder.timestamp;
        }

        public static Builder builder() {
            return new Builder();
        }

        // Getters
        public boolean hasVoice() { return hasVoice; }
        public VoiceActivityEvent getEvent() { return event; }
        public PauseType getPauseType() { return pauseType; }
        public long getPauseDuration() { return pauseDuration; }
        public Instant getTimestamp() { return timestamp; }

        public boolean shouldTriggerAI() {
            return event == VoiceActivityEvent.SIGNIFICANT_PAUSE;
        }

        public boolean shouldInterruptAI() {
            return event == VoiceActivityEvent.AI_INTERRUPTED;
        }

        public static class Builder {
            private boolean hasVoice;
            private VoiceActivityEvent event;
            private PauseType pauseType;
            private long pauseDuration;
            private Instant timestamp;

            public Builder hasVoice(boolean hasVoice) {
                this.hasVoice = hasVoice;
                return this;
            }

            public Builder event(VoiceActivityEvent event) {
                this.event = event;
                return this;
            }

            public Builder pauseType(PauseType pauseType) {
                this.pauseType = pauseType;
                return this;
            }

            public Builder pauseDuration(long pauseDuration) {
                this.pauseDuration = pauseDuration;
                return this;
            }

            public Builder timestamp(Instant timestamp) {
                this.timestamp = timestamp;
                return this;
            }

            public VoiceActivityResult build() {
                return new VoiceActivityResult(this);
            }
        }
    }
}
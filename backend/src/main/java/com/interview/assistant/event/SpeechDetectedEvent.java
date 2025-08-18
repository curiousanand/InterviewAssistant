package com.interview.assistant.event;

import com.interview.assistant.model.SilenceDetectionResult;
import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when speech is detected in an audio session
 * 
 * Why: Notifies conversation orchestrator and other components about speech detection
 * Pattern: Domain Event - represents speech activity in conversation flow
 * Rationale: Enables reactive handling of speech detection for conversation management
 */
public class SpeechDetectedEvent extends ApplicationEvent {
    
    private final String sessionId;
    private final SilenceDetectionResult silenceResult;
    private final long timestamp;
    
    public SpeechDetectedEvent(String sessionId, SilenceDetectionResult silenceResult) {
        super(sessionId);
        this.sessionId = sessionId;
        this.silenceResult = silenceResult;
        this.timestamp = System.currentTimeMillis();
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public SilenceDetectionResult getSilenceResult() {
        return silenceResult;
    }
    
    public long getEventTimestamp() {
        return timestamp;
    }
    
    public long getSpeechDuration() {
        return silenceResult != null ? silenceResult.getSpeechDuration() : 0;
    }
    
    public boolean isStateTransition() {
        return silenceResult != null && silenceResult.hasStateChanged();
    }
    
    public String getEventDescription() {
        return String.format("SpeechDetectedEvent{sessionId='%s', speechDuration=%dms, timestamp=%d}", 
            sessionId, getSpeechDuration(), timestamp);
    }
}
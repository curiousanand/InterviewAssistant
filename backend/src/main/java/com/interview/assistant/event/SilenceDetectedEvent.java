package com.interview.assistant.event;

import com.interview.assistant.model.SilenceDetectionResult;
import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when silence is detected in an audio session
 * 
 * Why: Notifies conversation orchestrator about silence patterns for pause classification
 * Pattern: Domain Event - represents silence activity in conversation flow
 * Rationale: Enables intelligent conversation processing based on silence duration and type
 */
public class SilenceDetectedEvent extends ApplicationEvent {
    
    private final String sessionId;
    private final SilenceDetectionResult silenceResult;
    private final long timestamp;
    
    public SilenceDetectedEvent(String sessionId, SilenceDetectionResult silenceResult) {
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
    
    public long getSilenceDuration() {
        return silenceResult != null ? silenceResult.getSilenceDuration() : 0;
    }
    
    public boolean shouldTriggerProcessing() {
        return silenceResult != null && silenceResult.shouldTriggerProcessing();
    }
    
    public boolean isStateTransition() {
        return silenceResult != null && silenceResult.hasStateChanged();
    }
    
    public SilenceDetectionResult.SilenceType getSilenceType() {
        return silenceResult != null ? silenceResult.getSilenceType() : SilenceDetectionResult.SilenceType.NONE;
    }
    
    public int getProcessingPriority() {
        return silenceResult != null ? silenceResult.getProcessingPriority() : 0;
    }
    
    public String getEventDescription() {
        return String.format("SilenceDetectedEvent{sessionId='%s', duration=%dms, type=%s, timestamp=%d}", 
            sessionId, getSilenceDuration(), getSilenceType(), timestamp);
    }
}
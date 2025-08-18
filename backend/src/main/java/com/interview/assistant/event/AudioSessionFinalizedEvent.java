package com.interview.assistant.event;

import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when an audio session is finalized and cleaned up
 * 
 * Why: Notifies other components that an audio processing session has ended
 * Pattern: Domain Event - represents session lifecycle completion in conversation orchestration
 * Rationale: Enables cleanup and archival processes in event-driven architecture
 */
public class AudioSessionFinalizedEvent extends ApplicationEvent {
    
    private final String sessionId;
    private final long timestamp;
    private final long sessionDuration;
    
    public AudioSessionFinalizedEvent(String sessionId) {
        this(sessionId, 0);
    }
    
    public AudioSessionFinalizedEvent(String sessionId, long sessionDuration) {
        super(sessionId);
        this.sessionId = sessionId;
        this.sessionDuration = sessionDuration;
        this.timestamp = System.currentTimeMillis();
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public long getEventTimestamp() {
        return timestamp;
    }
    
    public long getSessionDuration() {
        return sessionDuration;
    }
    
    public String getEventDescription() {
        return String.format("AudioSessionFinalizedEvent{sessionId='%s', duration=%dms, timestamp=%d}", 
            sessionId, sessionDuration, timestamp);
    }
}
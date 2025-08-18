package com.interview.assistant.event;

import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when an audio session is initialized
 * <p>
 * Why: Notifies other components that a new audio processing session has started
 * Pattern: Domain Event - represents significant business event in conversation orchestration
 * Rationale: Enables decoupled handling of session lifecycle in event-driven architecture
 */
public class AudioSessionInitializedEvent extends ApplicationEvent {

    private final String sessionId;
    private final long timestamp;

    public AudioSessionInitializedEvent(String sessionId) {
        super(sessionId);
        this.sessionId = sessionId;
        this.timestamp = System.currentTimeMillis();
    }

    public String getSessionId() {
        return sessionId;
    }

    public long getEventTimestamp() {
        return timestamp;
    }

    public String getEventDescription() {
        return String.format("AudioSessionInitializedEvent{sessionId='%s', timestamp=%d}",
                sessionId, timestamp);
    }
}
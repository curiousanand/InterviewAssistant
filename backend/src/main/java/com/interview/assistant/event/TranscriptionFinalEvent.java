package com.interview.assistant.event;

import com.interview.assistant.service.ITranscriptionService;
import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when final transcription results are received
 * 
 * Why: Notifies conversation orchestrator about completed transcription for AI processing
 * Pattern: Domain Event - represents finalized user input for conversation processing
 * Rationale: Triggers conversation context analysis and AI response generation
 */
public class TranscriptionFinalEvent extends ApplicationEvent {
    
    private final String sessionId;
    private final ITranscriptionService.TranscriptionResult transcriptionResult;
    private final long timestamp;
    
    public TranscriptionFinalEvent(String sessionId, ITranscriptionService.TranscriptionResult transcriptionResult) {
        super(sessionId);
        this.sessionId = sessionId;
        this.transcriptionResult = transcriptionResult;
        this.timestamp = System.currentTimeMillis();
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public ITranscriptionService.TranscriptionResult getTranscriptionResult() {
        return transcriptionResult;
    }
    
    public long getEventTimestamp() {
        return timestamp;
    }
    
    public String getText() {
        return transcriptionResult != null ? transcriptionResult.getText() : "";
    }
    
    public double getConfidence() {
        return transcriptionResult != null ? transcriptionResult.getConfidence() : 0.0;
    }
    
    public boolean isFinal() {
        return transcriptionResult != null && transcriptionResult.isFinal();
    }
    
    public boolean shouldTriggerAI() {
        return isFinal() && !getText().trim().isEmpty() && getConfidence() > 0.5;
    }
    
    public String getEventDescription() {
        return String.format("TranscriptionFinalEvent{sessionId='%s', text='%s', confidence=%.2f, timestamp=%d}", 
            sessionId, getText(), getConfidence(), timestamp);
    }
}
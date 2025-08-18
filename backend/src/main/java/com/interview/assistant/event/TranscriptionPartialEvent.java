package com.interview.assistant.event;

import com.interview.assistant.service.ITranscriptionService;
import org.springframework.context.ApplicationEvent;

/**
 * Event emitted when partial transcription results are received
 * 
 * Why: Notifies UI and conversation components about interim transcription results
 * Pattern: Domain Event - represents real-time transcription progress
 * Rationale: Enables live transcription display and conversation flow management
 */
public class TranscriptionPartialEvent extends ApplicationEvent {
    
    private final String sessionId;
    private final ITranscriptionService.TranscriptionResult transcriptionResult;
    private final long timestamp;
    
    public TranscriptionPartialEvent(String sessionId, ITranscriptionService.TranscriptionResult transcriptionResult) {
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
    
    public String getLanguage() {
        // Note: Language detection would be available through transcription service
        return "auto-detected";
    }
    
    public boolean isPartial() {
        return transcriptionResult == null || !transcriptionResult.isFinal();
    }
    
    public String getEventDescription() {
        return String.format("TranscriptionPartialEvent{sessionId='%s', text='%s', confidence=%.2f, timestamp=%d}", 
            sessionId, getText(), getConfidence(), timestamp);
    }
}
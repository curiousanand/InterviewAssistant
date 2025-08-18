package com.interview.assistant.websocket;

/**
 * WebSocket message type enumeration for conversation orchestration
 * 
 * Why: Defines message types for WebSocket communication protocol
 * Pattern: Type Safety Enum - provides compile-time type checking for message types
 * Rationale: Essential for proper WebSocket message handling and routing
 */
public enum MessageType {
    
    // Session management
    SESSION_START,          // Initialize new conversation session
    SESSION_READY,          // Session initialized and ready
    SESSION_END,            // End conversation session
    SESSION_CLOSED,         // Session cleanup completed
    
    // Audio processing
    AUDIO_DATA,             // Raw audio data for processing
    AUDIO_START,            // Audio capture started
    AUDIO_STOP,             // Audio capture stopped
    
    // Transcription results
    TRANSCRIPT_PARTIAL,     // Interim transcription result
    TRANSCRIPT_FINAL,       // Final transcription result
    TRANSCRIPT_ERROR,       // Transcription processing error
    
    // AI responses
    ASSISTANT_DELTA,        // Streaming AI response token
    ASSISTANT_DONE,         // AI response completed
    ASSISTANT_ERROR,        // AI processing error
    
    // Voice Activity Detection
    VAD_SPEECH_START,       // Speech detected
    VAD_SPEECH_END,         // Speech ended
    VAD_SILENCE,            // Silence detected
    
    // System messages
    HEARTBEAT,              // Keep-alive ping
    PONG,                   // Heartbeat response
    ACK,                    // Acknowledgment
    ERROR,                  // General error message
    
    // Conversation orchestration
    CONTEXT_UPDATE,         // Conversation context updated
    PROCESSING_START,       // AI processing started
    PROCESSING_COMPLETE,    // AI processing finished
    
    // Debug and monitoring
    DEBUG_INFO,             // Debug information
    STATS_UPDATE,           // Performance statistics
    SYSTEM_STATUS;          // System status update
    
    /**
     * Check if this message type represents an error
     */
    public boolean isError() {
        return this == ERROR || 
               this == TRANSCRIPT_ERROR || 
               this == ASSISTANT_ERROR;
    }
    
    /**
     * Check if this message type is for session management
     */
    public boolean isSessionMessage() {
        return this == SESSION_START || 
               this == SESSION_READY || 
               this == SESSION_END || 
               this == SESSION_CLOSED;
    }
    
    /**
     * Check if this message type is for audio processing
     */
    public boolean isAudioMessage() {
        return this == AUDIO_DATA || 
               this == AUDIO_START || 
               this == AUDIO_STOP;
    }
    
    /**
     * Check if this message type is for transcription
     */
    public boolean isTranscriptionMessage() {
        return this == TRANSCRIPT_PARTIAL || 
               this == TRANSCRIPT_FINAL || 
               this == TRANSCRIPT_ERROR;
    }
    
    /**
     * Check if this message type is for AI responses
     */
    public boolean isAIMessage() {
        return this == ASSISTANT_DELTA || 
               this == ASSISTANT_DONE || 
               this == ASSISTANT_ERROR;
    }
    
    /**
     * Check if this message type is for Voice Activity Detection
     */
    public boolean isVADMessage() {
        return this == VAD_SPEECH_START || 
               this == VAD_SPEECH_END || 
               this == VAD_SILENCE;
    }
    
    /**
     * Check if this message type is for system/control purposes
     */
    public boolean isSystemMessage() {
        return this == HEARTBEAT || 
               this == PONG || 
               this == ACK || 
               this == ERROR ||
               this == DEBUG_INFO || 
               this == STATS_UPDATE || 
               this == SYSTEM_STATUS;
    }
    
    /**
     * Check if this message type requires immediate processing
     */
    public boolean isHighPriority() {
        return this == ERROR || 
               this == TRANSCRIPT_ERROR || 
               this == ASSISTANT_ERROR || 
               this == SESSION_END ||
               this == AUDIO_STOP;
    }
    
    /**
     * Check if this message type supports streaming
     */
    public boolean supportsStreaming() {
        return this == ASSISTANT_DELTA || 
               this == TRANSCRIPT_PARTIAL || 
               this == AUDIO_DATA;
    }
    
    /**
     * Get the expected response type for this message type
     */
    public MessageType getExpectedResponse() {
        switch (this) {
            case SESSION_START:
                return SESSION_READY;
            case SESSION_END:
                return SESSION_CLOSED;
            case HEARTBEAT:
                return PONG;
            case AUDIO_DATA:
                return TRANSCRIPT_PARTIAL; // or TRANSCRIPT_FINAL
            case TRANSCRIPT_FINAL:
                return ASSISTANT_DELTA; // Start of AI response
            default:
                return ACK; // Default acknowledgment
        }
    }
    
    /**
     * Get processing priority (higher = more urgent)
     */
    public int getProcessingPriority() {
        if (isError()) return 10;
        if (this == SESSION_END) return 8;
        if (this == AUDIO_STOP) return 7;
        if (this == TRANSCRIPT_FINAL) return 6;
        if (this == SESSION_START) return 5;
        if (this == AUDIO_DATA) return 4;
        if (this == TRANSCRIPT_PARTIAL) return 3;
        if (this == ASSISTANT_DELTA) return 2;
        return 1; // Default priority
    }
    
    /**
     * Get human-readable description
     */
    public String getDescription() {
        switch (this) {
            case SESSION_START: return "Initialize conversation session";
            case SESSION_READY: return "Session ready for interaction";
            case SESSION_END: return "End conversation session";
            case SESSION_CLOSED: return "Session cleanup completed";
            case AUDIO_DATA: return "Raw audio data chunk";
            case AUDIO_START: return "Audio capture started";
            case AUDIO_STOP: return "Audio capture stopped";
            case TRANSCRIPT_PARTIAL: return "Interim transcription result";
            case TRANSCRIPT_FINAL: return "Final transcription result";
            case TRANSCRIPT_ERROR: return "Transcription failed";
            case ASSISTANT_DELTA: return "Streaming AI response token";
            case ASSISTANT_DONE: return "AI response completed";
            case ASSISTANT_ERROR: return "AI processing failed";
            case VAD_SPEECH_START: return "Speech activity detected";
            case VAD_SPEECH_END: return "Speech activity ended";
            case VAD_SILENCE: return "Silence detected";
            case HEARTBEAT: return "Connection keep-alive";
            case PONG: return "Heartbeat acknowledgment";
            case ACK: return "Message acknowledged";
            case ERROR: return "General error occurred";
            case CONTEXT_UPDATE: return "Conversation context updated";
            case PROCESSING_START: return "AI processing initiated";
            case PROCESSING_COMPLETE: return "AI processing finished";
            case DEBUG_INFO: return "Debug information";
            case STATS_UPDATE: return "Performance statistics";
            case SYSTEM_STATUS: return "System status information";
            default: return "Unknown message type";
        }
    }
    
    @Override
    public String toString() {
        return name().toLowerCase().replace('_', '.');
    }
}
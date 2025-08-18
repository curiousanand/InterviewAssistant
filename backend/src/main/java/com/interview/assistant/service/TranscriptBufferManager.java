package com.interview.assistant.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Manages dual-buffer transcript system for real-time conversation
 * <p>
 * Why: Separates live (interim) transcripts from confirmed (final) transcripts
 * Pattern: Buffer management with live/confirmed state separation
 * Rationale: Essential for natural conversation flow - shows live feedback while building confirmed context
 */
@Service
public class TranscriptBufferManager {

    private static final Logger logger = LoggerFactory.getLogger(TranscriptBufferManager.class);

    // Session buffers
    private final Map<String, SessionTranscriptBuffers> sessionBuffers = new ConcurrentHashMap<>();

    /**
     * Update live buffer with interim transcript
     * 
     * @param sessionId Session identifier
     * @param interimText Partial transcript text
     * @param confidence Recognition confidence
     * @param timestamp When transcript was generated
     */
    public void updateLiveBuffer(String sessionId, String interimText, double confidence, Instant timestamp) {
        SessionTranscriptBuffers buffers = getOrCreateBuffers(sessionId);
        
        synchronized (buffers) {
            buffers.liveBuffer.updateText(interimText, confidence, timestamp);
            logger.debug("Live buffer updated for session {}: '{}'", sessionId, truncate(interimText, 50));
        }
    }

    /**
     * Confirm live buffer content and move to confirmed buffer
     * 
     * @param sessionId Session identifier
     * @param finalText Final confirmed transcript
     * @param confidence Final confidence score
     * @param timestamp When transcript was finalized
     * @return The confirmed transcript content
     */
    public TranscriptSegment confirmBuffer(String sessionId, String finalText, double confidence, Instant timestamp) {
        SessionTranscriptBuffers buffers = getOrCreateBuffers(sessionId);
        
        synchronized (buffers) {
            // Create confirmed segment
            TranscriptSegment confirmedSegment = new TranscriptSegment(
                    buffers.segmentIdGenerator.incrementAndGet(),
                    finalText,
                    confidence,
                    timestamp,
                    true
            );
            
            // Add to confirmed buffer
            buffers.confirmedBuffer.addSegment(confirmedSegment);
            
            // Clear live buffer
            buffers.liveBuffer.clear();
            
            logger.info("Buffer confirmed for session {}: '{}'", sessionId, truncate(finalText, 100));
            return confirmedSegment;
        }
    }

    /**
     * Get current live buffer content
     */
    public TranscriptSegment getCurrentLiveBuffer(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers == null) return null;
        
        synchronized (buffers) {
            return buffers.liveBuffer.isEmpty() ? null : 
                new TranscriptSegment(
                    0, // Live buffer doesn't have permanent ID
                    buffers.liveBuffer.text,
                    buffers.liveBuffer.confidence,
                    buffers.liveBuffer.lastUpdated,
                    false
                );
        }
    }

    /**
     * Get all confirmed transcript segments for context
     */
    public ConfirmedTranscript getConfirmedTranscript(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers == null) return ConfirmedTranscript.empty();
        
        synchronized (buffers) {
            return buffers.confirmedBuffer.toConfirmedTranscript();
        }
    }

    /**
     * Get conversation context (confirmed + live) for AI processing
     */
    public ConversationContext getConversationContext(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers == null) return ConversationContext.empty();
        
        synchronized (buffers) {
            ConfirmedTranscript confirmed = buffers.confirmedBuffer.toConfirmedTranscript();
            TranscriptSegment live = buffers.liveBuffer.isEmpty() ? null :
                new TranscriptSegment(0, buffers.liveBuffer.text, buffers.liveBuffer.confidence, 
                                    buffers.liveBuffer.lastUpdated, false);
            
            return new ConversationContext(confirmed, live);
        }
    }

    /**
     * Clear live buffer (e.g., when user stops speaking)
     */
    public void clearLiveBuffer(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers != null) {
            synchronized (buffers) {
                buffers.liveBuffer.clear();
                logger.debug("Live buffer cleared for session {}", sessionId);
            }
        }
    }

    /**
     * Reset all buffers for session
     */
    public void resetSession(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers != null) {
            synchronized (buffers) {
                buffers.liveBuffer.clear();
                buffers.confirmedBuffer.clear();
                logger.info("All buffers reset for session {}", sessionId);
            }
        }
    }

    /**
     * Clean up session resources
     */
    public void cleanupSession(String sessionId) {
        SessionTranscriptBuffers removed = sessionBuffers.remove(sessionId);
        if (removed != null) {
            logger.info("Transcript buffers cleaned up for session {}", sessionId);
        }
    }

    /**
     * Get buffer statistics for monitoring
     */
    public BufferStats getBufferStats(String sessionId) {
        SessionTranscriptBuffers buffers = sessionBuffers.get(sessionId);
        if (buffers == null) return BufferStats.empty();
        
        synchronized (buffers) {
            return new BufferStats(
                    sessionId,
                    buffers.liveBuffer.isEmpty() ? 0 : buffers.liveBuffer.text.length(),
                    buffers.confirmedBuffer.segments.size(),
                    buffers.confirmedBuffer.getTotalLength(),
                    buffers.segmentIdGenerator.get()
            );
        }
    }

    private SessionTranscriptBuffers getOrCreateBuffers(String sessionId) {
        return sessionBuffers.computeIfAbsent(sessionId, k -> new SessionTranscriptBuffers());
    }

    private String truncate(String text, int maxLength) {
        return text.length() <= maxLength ? text : text.substring(0, maxLength) + "...";
    }

    /**
     * Session-specific transcript buffers
     */
    private static class SessionTranscriptBuffers {
        final LiveTranscriptBuffer liveBuffer = new LiveTranscriptBuffer();
        final ConfirmedTranscriptBuffer confirmedBuffer = new ConfirmedTranscriptBuffer();
        final AtomicLong segmentIdGenerator = new AtomicLong(0);
    }

    /**
     * Live (interim) transcript buffer
     */
    private static class LiveTranscriptBuffer {
        String text = "";
        double confidence = 0.0;
        Instant lastUpdated = Instant.now();

        void updateText(String newText, double newConfidence, Instant timestamp) {
            this.text = newText;
            this.confidence = newConfidence;
            this.lastUpdated = timestamp;
        }

        void clear() {
            this.text = "";
            this.confidence = 0.0;
            this.lastUpdated = Instant.now();
        }

        boolean isEmpty() {
            return text.trim().isEmpty();
        }
    }

    /**
     * Confirmed transcript buffer
     */
    private static class ConfirmedTranscriptBuffer {
        private final java.util.List<TranscriptSegment> segments = new java.util.ArrayList<>();
        private static final int MAX_SEGMENTS = 50; // Limit for memory management

        void addSegment(TranscriptSegment segment) {
            segments.add(segment);
            
            // Trim old segments if needed
            if (segments.size() > MAX_SEGMENTS) {
                segments.remove(0);
            }
        }

        void clear() {
            segments.clear();
        }

        ConfirmedTranscript toConfirmedTranscript() {
            return new ConfirmedTranscript(new java.util.ArrayList<>(segments));
        }

        int getTotalLength() {
            return segments.stream().mapToInt(s -> s.getText().length()).sum();
        }
    }

    /**
     * Individual transcript segment
     */
    public static class TranscriptSegment {
        private final long id;
        private final String text;
        private final double confidence;
        private final Instant timestamp;
        private final boolean isFinal;

        public TranscriptSegment(long id, String text, double confidence, Instant timestamp, boolean isFinal) {
            this.id = id;
            this.text = text;
            this.confidence = confidence;
            this.timestamp = timestamp;
            this.isFinal = isFinal;
        }

        // Getters
        public long getId() { return id; }
        public String getText() { return text; }
        public double getConfidence() { return confidence; }
        public Instant getTimestamp() { return timestamp; }
        public boolean isFinal() { return isFinal; }

        @Override
        public String toString() {
            return String.format("TranscriptSegment{id=%d, text='%s', confidence=%.2f, final=%s}", 
                               id, text, confidence, isFinal);
        }
    }

    /**
     * Confirmed transcript containing all finalized segments
     */
    public static class ConfirmedTranscript {
        private final java.util.List<TranscriptSegment> segments;

        public ConfirmedTranscript(java.util.List<TranscriptSegment> segments) {
            this.segments = segments;
        }

        public static ConfirmedTranscript empty() {
            return new ConfirmedTranscript(java.util.Collections.emptyList());
        }

        public java.util.List<TranscriptSegment> getSegments() { return segments; }

        public String getFullText() {
            return segments.stream()
                    .map(TranscriptSegment::getText)
                    .collect(java.util.stream.Collectors.joining(" "));
        }

        public boolean isEmpty() { return segments.isEmpty(); }

        public int size() { return segments.size(); }
    }

    /**
     * Combined conversation context for AI processing
     */
    public static class ConversationContext {
        private final ConfirmedTranscript confirmedTranscript;
        private final TranscriptSegment liveSegment;

        public ConversationContext(ConfirmedTranscript confirmedTranscript, TranscriptSegment liveSegment) {
            this.confirmedTranscript = confirmedTranscript;
            this.liveSegment = liveSegment;
        }

        public static ConversationContext empty() {
            return new ConversationContext(ConfirmedTranscript.empty(), null);
        }

        public ConfirmedTranscript getConfirmedTranscript() { return confirmedTranscript; }
        public TranscriptSegment getLiveSegment() { return liveSegment; }

        public String getFullContextText() {
            StringBuilder context = new StringBuilder();
            
            if (!confirmedTranscript.isEmpty()) {
                context.append(confirmedTranscript.getFullText());
            }
            
            if (liveSegment != null && !liveSegment.getText().trim().isEmpty()) {
                if (context.length() > 0) context.append(" ");
                context.append(liveSegment.getText());
            }
            
            return context.toString();
        }

        public boolean hasContent() {
            return !confirmedTranscript.isEmpty() || (liveSegment != null && !liveSegment.getText().trim().isEmpty());
        }
    }

    /**
     * Buffer statistics for monitoring
     */
    public static class BufferStats {
        private final String sessionId;
        private final int liveBufferLength;
        private final int confirmedSegmentCount;
        private final int totalConfirmedLength;
        private final long segmentCounter;

        public BufferStats(String sessionId, int liveBufferLength, int confirmedSegmentCount, 
                          int totalConfirmedLength, long segmentCounter) {
            this.sessionId = sessionId;
            this.liveBufferLength = liveBufferLength;
            this.confirmedSegmentCount = confirmedSegmentCount;
            this.totalConfirmedLength = totalConfirmedLength;
            this.segmentCounter = segmentCounter;
        }

        public static BufferStats empty() {
            return new BufferStats("", 0, 0, 0, 0);
        }

        // Getters
        public String getSessionId() { return sessionId; }
        public int getLiveBufferLength() { return liveBufferLength; }
        public int getConfirmedSegmentCount() { return confirmedSegmentCount; }
        public int getTotalConfirmedLength() { return totalConfirmedLength; }
        public long getSegmentCounter() { return segmentCounter; }

        @Override
        public String toString() {
            return String.format("BufferStats{session='%s', live=%d, confirmed=%d segments (%d chars)}", 
                               sessionId, liveBufferLength, confirmedSegmentCount, totalConfirmedLength);
        }
    }
}
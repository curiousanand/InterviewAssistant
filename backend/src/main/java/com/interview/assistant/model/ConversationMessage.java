package com.interview.assistant.model;

import java.util.Objects;

/**
 * Conversation message model for AI processing
 * <p>
 * Why: Represents individual messages in conversation context
 * Pattern: Value Object - immutable message data for conversation processing
 * Rationale: Standard format for messages passed to AI services
 */
public class ConversationMessage {

    private final String role;
    private final String content;
    private final double confidence;
    private final long timestamp;

    public ConversationMessage(String role, String content, double confidence) {
        this(role, content, confidence, System.currentTimeMillis());
    }

    public ConversationMessage(String role, String content, double confidence, long timestamp) {
        this.role = role != null ? role : "user";
        this.content = content != null ? content : "";
        this.confidence = Math.max(0.0, Math.min(1.0, confidence)); // Clamp to [0,1]
        this.timestamp = timestamp;
    }

    /**
     * Create user message
     */
    public static ConversationMessage user(String content, double confidence) {
        return new ConversationMessage("user", content, confidence);
    }

    /**
     * Create assistant message
     */
    public static ConversationMessage assistant(String content) {
        return new ConversationMessage("assistant", content, 1.0);
    }

    /**
     * Create system message
     */
    public static ConversationMessage system(String content) {
        return new ConversationMessage("system", content, 1.0);
    }

    /**
     * Check if message is from user
     */
    public boolean isUser() {
        return "user".equals(role);
    }

    /**
     * Check if message is from assistant
     */
    public boolean isAssistant() {
        return "assistant".equals(role);
    }

    /**
     * Check if message is system message
     */
    public boolean isSystem() {
        return "system".equals(role);
    }

    /**
     * Check if message is empty or whitespace only
     */
    public boolean isEmpty() {
        return content.trim().isEmpty();
    }

    /**
     * Check if message meets confidence threshold
     */
    public boolean meetsConfidenceThreshold(double threshold) {
        return confidence >= threshold;
    }

    /**
     * Get word count
     */
    public int getWordCount() {
        if (isEmpty()) {
            return 0;
        }
        return content.trim().split("\\s+").length;
    }

    /**
     * Get character count
     */
    public int getCharacterCount() {
        return content.length();
    }

    /**
     * Create a copy with different content
     */
    public ConversationMessage withContent(String newContent) {
        return new ConversationMessage(role, newContent, confidence, timestamp);
    }

    /**
     * Create a copy with different confidence
     */
    public ConversationMessage withConfidence(double newConfidence) {
        return new ConversationMessage(role, content, newConfidence, timestamp);
    }

    /**
     * Create a copy with different role
     */
    public ConversationMessage withRole(String newRole) {
        return new ConversationMessage(newRole, content, confidence, timestamp);
    }

    /**
     * Get truncated content for display
     */
    public String getTruncatedContent(int maxLength) {
        if (content.length() <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength - 3) + "...";
    }

    // Getters

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public double getConfidence() {
        return confidence;
    }

    public long getTimestamp() {
        return timestamp;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;

        ConversationMessage that = (ConversationMessage) obj;
        return Double.compare(that.confidence, confidence) == 0 &&
                timestamp == that.timestamp &&
                Objects.equals(role, that.role) &&
                Objects.equals(content, that.content);
    }

    @Override
    public int hashCode() {
        return Objects.hash(role, content, confidence, timestamp);
    }

    @Override
    public String toString() {
        return String.format("ConversationMessage{role='%s', content='%s', confidence=%.2f, words=%d}",
                role, getTruncatedContent(50), confidence, getWordCount());
    }

    /**
     * Get message statistics
     */
    public MessageStatistics getStatistics() {
        return new MessageStatistics(
                role,
                getWordCount(),
                getCharacterCount(),
                confidence,
                timestamp,
                isEmpty()
        );
    }

    /**
     * Inner class for message statistics
     */
    public static class MessageStatistics {
        private final String role;
        private final int wordCount;
        private final int characterCount;
        private final double confidence;
        private final long timestamp;
        private final boolean isEmpty;

        public MessageStatistics(String role, int wordCount, int characterCount,
                                 double confidence, long timestamp, boolean isEmpty) {
            this.role = role;
            this.wordCount = wordCount;
            this.characterCount = characterCount;
            this.confidence = confidence;
            this.timestamp = timestamp;
            this.isEmpty = isEmpty;
        }

        // Getters
        public String getRole() {
            return role;
        }

        public int getWordCount() {
            return wordCount;
        }

        public int getCharacterCount() {
            return characterCount;
        }

        public double getConfidence() {
            return confidence;
        }

        public long getTimestamp() {
            return timestamp;
        }

        public boolean isEmpty() {
            return isEmpty;
        }

        @Override
        public String toString() {
            return String.format("MessageStats{role=%s, words=%d, chars=%d, conf=%.2f}",
                    role, wordCount, characterCount, confidence);
        }
    }
}
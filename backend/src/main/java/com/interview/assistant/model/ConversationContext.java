package com.interview.assistant.model;

import java.util.*;

/**
 * Conversation context model for AI processing
 * <p>
 * Why: Encapsulates conversation history and context for AI processing
 * Pattern: Value Object - immutable context data for conversation processing
 * Rationale: Provides structured context to AI services with metadata and history
 */
public class ConversationContext {

    private final List<ConversationMessage> messages;
    private final String systemPrompt;
    private final String sessionId;
    private final Map<String, Object> metadata;
    private final long createdAt;

    public ConversationContext(List<ConversationMessage> messages, String systemPrompt,
                               String sessionId, Map<String, Object> metadata) {
        this.messages = new ArrayList<>(messages != null ? messages : Collections.emptyList());
        this.systemPrompt = systemPrompt != null ? systemPrompt : "";
        this.sessionId = sessionId != null ? sessionId : "";
        this.metadata = new HashMap<>(metadata != null ? metadata : Collections.emptyMap());
        this.createdAt = System.currentTimeMillis();
    }

    /**
     * Check if context is empty (no messages)
     */
    public boolean isEmpty() {
        return messages.isEmpty();
    }

    /**
     * Get number of messages
     */
    public int getMessageCount() {
        return messages.size();
    }

    /**
     * Get messages of a specific role
     */
    public List<ConversationMessage> getMessagesByRole(String role) {
        return messages.stream()
                .filter(msg -> role.equals(msg.getRole()))
                .toList();
    }

    /**
     * Get user messages only
     */
    public List<ConversationMessage> getUserMessages() {
        return getMessagesByRole("user");
    }

    /**
     * Get assistant messages only
     */
    public List<ConversationMessage> getAssistantMessages() {
        return getMessagesByRole("assistant");
    }

    /**
     * Get the most recent message
     */
    public Optional<ConversationMessage> getLatestMessage() {
        if (messages.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(messages.get(messages.size() - 1));
    }

    /**
     * Get the most recent user message
     */
    public Optional<ConversationMessage> getLatestUserMessage() {
        return messages.stream()
                .filter(msg -> "user".equals(msg.getRole()))
                .reduce((first, second) -> second);
    }

    /**
     * Get messages within confidence threshold
     */
    public List<ConversationMessage> getHighConfidenceMessages(double minConfidence) {
        return messages.stream()
                .filter(msg -> msg.getConfidence() >= minConfidence)
                .toList();
    }

    /**
     * Get conversation summary
     */
    public String getSummary() {
        if (isEmpty()) {
            return "No conversation content";
        }

        int userCount = getUserMessages().size();
        int assistantCount = getAssistantMessages().size();

        return String.format("Conversation with %d user messages and %d assistant messages",
                userCount, assistantCount);
    }

    /**
     * Get total text length
     */
    public int getTotalTextLength() {
        return messages.stream()
                .mapToInt(msg -> msg.getContent().length())
                .sum();
    }

    /**
     * Get average confidence score
     */
    public double getAverageConfidence() {
        if (messages.isEmpty()) {
            return 0.0;
        }

        return messages.stream()
                .mapToDouble(ConversationMessage::getConfidence)
                .average()
                .orElse(0.0);
    }

    /**
     * Create a copy with additional message
     */
    public ConversationContext withMessage(ConversationMessage message) {
        List<ConversationMessage> newMessages = new ArrayList<>(this.messages);
        newMessages.add(message);

        return new ConversationContext(newMessages, systemPrompt, sessionId, metadata);
    }

    /**
     * Create a copy with filtered messages
     */
    public ConversationContext withMessagesFiltered(double minConfidence) {
        List<ConversationMessage> filteredMessages = getHighConfidenceMessages(minConfidence);
        return new ConversationContext(filteredMessages, systemPrompt, sessionId, metadata);
    }

    /**
     * Create a copy with limited message history
     */
    public ConversationContext withMessageLimit(int maxMessages) {
        List<ConversationMessage> limitedMessages = messages.size() <= maxMessages ?
                messages : messages.subList(messages.size() - maxMessages, messages.size());

        return new ConversationContext(limitedMessages, systemPrompt, sessionId, metadata);
    }

    // Getters

    public List<ConversationMessage> getMessages() {
        return new ArrayList<>(messages);
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public String getSessionId() {
        return sessionId;
    }

    public Map<String, Object> getMetadata() {
        return new HashMap<>(metadata);
    }

    public long getCreatedAt() {
        return createdAt;
    }

    /**
     * Get metadata value by key
     */
    public Object getMetadata(String key) {
        return metadata.get(key);
    }

    /**
     * Get metadata value with default
     */
    @SuppressWarnings("unchecked")
    public <T> T getMetadata(String key, T defaultValue) {
        Object value = metadata.get(key);
        if (value == null) {
            return defaultValue;
        }
        try {
            return (T) value;
        } catch (ClassCastException e) {
            return defaultValue;
        }
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (obj == null || getClass() != obj.getClass()) return false;

        ConversationContext that = (ConversationContext) obj;
        return Objects.equals(messages, that.messages) &&
                Objects.equals(systemPrompt, that.systemPrompt) &&
                Objects.equals(sessionId, that.sessionId) &&
                Objects.equals(metadata, that.metadata);
    }

    @Override
    public int hashCode() {
        return Objects.hash(messages, systemPrompt, sessionId, metadata);
    }

    @Override
    public String toString() {
        return String.format("ConversationContext{sessionId='%s', messages=%d, avgConf=%.2f, totalChars=%d}",
                sessionId, getMessageCount(), getAverageConfidence(), getTotalTextLength());
    }

    /**
     * Get detailed statistics
     */
    public ConversationContextStatistics getStatistics() {
        return new ConversationContextStatistics(
                getMessageCount(),
                getUserMessages().size(),
                getAssistantMessages().size(),
                getTotalTextLength(),
                getAverageConfidence(),
                createdAt,
                !isEmpty()
        );
    }

    /**
     * Inner class for conversation statistics
     */
    public static class ConversationContextStatistics {
        private final int totalMessages;
        private final int userMessages;
        private final int assistantMessages;
        private final int totalTextLength;
        private final double averageConfidence;
        private final long createdAt;
        private final boolean hasContent;

        public ConversationContextStatistics(int totalMessages, int userMessages, int assistantMessages,
                                             int totalTextLength, double averageConfidence,
                                             long createdAt, boolean hasContent) {
            this.totalMessages = totalMessages;
            this.userMessages = userMessages;
            this.assistantMessages = assistantMessages;
            this.totalTextLength = totalTextLength;
            this.averageConfidence = averageConfidence;
            this.createdAt = createdAt;
            this.hasContent = hasContent;
        }

        // Getters
        public int getTotalMessages() {
            return totalMessages;
        }

        public int getUserMessages() {
            return userMessages;
        }

        public int getAssistantMessages() {
            return assistantMessages;
        }

        public int getTotalTextLength() {
            return totalTextLength;
        }

        public double getAverageConfidence() {
            return averageConfidence;
        }

        public long getCreatedAt() {
            return createdAt;
        }

        public boolean hasContent() {
            return hasContent;
        }

        @Override
        public String toString() {
            return String.format("Stats{total=%d, user=%d, assistant=%d, chars=%d, conf=%.2f}",
                    totalMessages, userMessages, assistantMessages, totalTextLength, averageConfidence);
        }
    }
}
package com.interview.assistant.util;

import com.interview.assistant.model.Message;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ConversationContext value object managing conversation state and metadata
 * 
 * Why: Encapsulates conversation context for AI processing
 * Pattern: DDD Value Object with complex state management
 * Rationale: Context is essential for maintaining conversation coherence
 */
public class ConversationContext {
    
    private String summary;
    private int totalTokens;
    private int messageCount;
    private String primaryLanguage;
    private Map<String, Integer> languageFrequency;
    private List<String> topics;
    private Instant lastSummarizedAt;
    private boolean isClosed;
    
    // Constructor
    public ConversationContext() {}
    
    public ConversationContext(String summary, int totalTokens, int messageCount, 
                              String primaryLanguage, Map<String, Integer> languageFrequency,
                              List<String> topics, boolean isClosed) {
        this.summary = summary;
        this.totalTokens = totalTokens;
        this.messageCount = messageCount;
        this.primaryLanguage = primaryLanguage;
        this.languageFrequency = languageFrequency;
        this.topics = topics;
        this.isClosed = isClosed;
    }
    
    // Builder pattern
    public static ConversationContextBuilder builder() {
        return new ConversationContextBuilder();
    }
    
    public static class ConversationContextBuilder {
        private String summary;
        private int totalTokens;
        private int messageCount;
        private String primaryLanguage;
        private Map<String, Integer> languageFrequency;
        private List<String> topics;
        private boolean isClosed;
        
        public ConversationContextBuilder summary(String summary) {
            this.summary = summary;
            return this;
        }
        
        public ConversationContextBuilder totalTokens(int totalTokens) {
            this.totalTokens = totalTokens;
            return this;
        }
        
        public ConversationContextBuilder messageCount(int messageCount) {
            this.messageCount = messageCount;
            return this;
        }
        
        public ConversationContextBuilder primaryLanguage(String primaryLanguage) {
            this.primaryLanguage = primaryLanguage;
            return this;
        }
        
        public ConversationContextBuilder languageFrequency(Map<String, Integer> languageFrequency) {
            this.languageFrequency = languageFrequency;
            return this;
        }
        
        public ConversationContextBuilder topics(List<String> topics) {
            this.topics = topics;
            return this;
        }
        
        public ConversationContextBuilder isClosed(boolean isClosed) {
            this.isClosed = isClosed;
            return this;
        }
        
        public ConversationContext build() {
            return new ConversationContext(summary, totalTokens, messageCount, primaryLanguage, 
                                         languageFrequency, topics, isClosed);
        }
    }
    
    // Getters and setters
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public int getTotalTokens() { return totalTokens; }
    public void setTotalTokens(int totalTokens) { this.totalTokens = totalTokens; }
    public int getMessageCount() { return messageCount; }
    public void setMessageCount(int messageCount) { this.messageCount = messageCount; }
    public String getPrimaryLanguage() { return primaryLanguage; }
    public void setPrimaryLanguage(String primaryLanguage) { this.primaryLanguage = primaryLanguage; }
    public Map<String, Integer> getLanguageFrequency() { return languageFrequency; }
    public void setLanguageFrequency(Map<String, Integer> languageFrequency) { this.languageFrequency = languageFrequency; }
    public List<String> getTopics() { return topics; }
    public void setTopics(List<String> topics) { this.topics = topics; }
    public Instant getLastSummarizedAt() { return lastSummarizedAt; }
    public void setLastSummarizedAt(Instant lastSummarizedAt) { this.lastSummarizedAt = lastSummarizedAt; }
    public boolean isClosed() { return isClosed; }
    public void setClosed(boolean closed) { isClosed = closed; }
    
    // Context management constants
    private static final int MAX_TOPICS = 10;
    private static final int TOKEN_SUMMARY_THRESHOLD = 8000;
    
    /**
     * Create empty conversation context
     * Why: Factory method for new conversations
     */
    public static ConversationContext create() {
        return ConversationContext.builder()
            .summary("")
            .totalTokens(0)
            .messageCount(0)
            .primaryLanguage("en-US")
            .languageFrequency(new HashMap<>())
            .topics(new ArrayList<>())
            .isClosed(false)
            .build();
    }
    
    /**
     * Create context from existing messages
     * Why: Reconstruct context from persisted data
     */
    public static ConversationContext fromMessages(List<Message> messages) {
        ConversationContext context = create();
        
        for (Message message : messages) {
            if (message.isFromUser()) {
                context.addUserInput(message.getContent(), message.getDetectedLanguage());
            } else if (message.isFromAssistant()) {
                context.addAssistantResponse(message.getContent(), message.getTokensUsed());
            }
        }
        
        return context;
    }
    
    /**
     * Add user input to context
     * Why: Track user contributions and language patterns
     */
    public void addUserInput(String content, String language) {
        messageCount++;
        
        // Update language tracking
        if (language != null) {
            updateLanguageFrequency(language);
        }
        
        // Extract and add topics
        List<String> extractedTopics = extractTopics(content);
        addTopics(extractedTopics);
    }
    
    /**
     * Add assistant response to context
     * Why: Track AI contributions and token usage
     */
    public void addAssistantResponse(String content, Integer tokensUsed) {
        messageCount++;
        
        if (tokensUsed != null) {
            totalTokens += tokensUsed;
        }
        
        // Extract topics from assistant response
        List<String> extractedTopics = extractTopics(content);
        addTopics(extractedTopics);
    }
    
    /**
     * Apply conversation summary
     * Why: Reduce context size while preserving important information
     */
    public void applySummary(String newSummary) {
        this.summary = newSummary;
        this.lastSummarizedAt = Instant.now();
        
        // Reset token count as we're starting fresh context
        this.totalTokens = estimateTokensInSummary(newSummary);
    }
    
    /**
     * Check if context needs summarization
     * Why: Prevent context from growing too large
     */
    public boolean needsSummarization() {
        return totalTokens > TOKEN_SUMMARY_THRESHOLD || 
               messageCount > 30;
    }
    
    /**
     * Get formatted context for AI processing
     * Why: Provide structured context for language models
     */
    public String getFormattedContext() {
        StringBuilder context = new StringBuilder();
        
        // Add summary if available
        if (summary != null && !summary.isEmpty()) {
            context.append("Conversation Summary: ").append(summary).append("\n\n");
        }
        
        // Add conversation metadata
        context.append("Context Information:\n");
        context.append("- Primary Language: ").append(primaryLanguage).append("\n");
        context.append("- Message Count: ").append(messageCount).append("\n");
        
        if (!topics.isEmpty()) {
            context.append("- Topics Discussed: ").append(String.join(", ", topics)).append("\n");
        }
        
        context.append("\n");
        
        return context.toString();
    }
    
    /**
     * Mark context as closed
     * Why: Finalize context when conversation ends
     */
    public void markAsClosed() {
        this.isClosed = true;
    }
    
    /**
     * Get context quality score
     * Why: Assess context richness for AI processing
     */
    public double getQualityScore() {
        double score = 0.0;
        
        // Score based on message count (more messages = better context)
        score += Math.min(messageCount / 10.0, 1.0) * 0.3;
        
        // Score based on topic diversity
        score += Math.min(topics.size() / 5.0, 1.0) * 0.3;
        
        // Score based on language consistency
        if (primaryLanguage != null && languageFrequency.containsKey(primaryLanguage)) {
            double languageRatio = languageFrequency.get(primaryLanguage) / (double) messageCount;
            score += languageRatio * 0.2;
        }
        
        // Score based on summary availability
        if (summary != null && !summary.isEmpty()) {
            score += 0.2;
        }
        
        return Math.min(score, 1.0);
    }
    
    /**
     * Get estimated context length in characters
     * Why: Estimate context size for processing limits
     */
    public int getEstimatedLength() {
        int length = 0;
        
        if (summary != null) {
            length += summary.length();
        }
        
        // Estimate additional context overhead
        length += 200; // Metadata and formatting
        
        return length;
    }
    
    private void updateLanguageFrequency(String language) {
        languageFrequency.merge(language, 1, Integer::sum);
        
        // Update primary language based on frequency
        primaryLanguage = languageFrequency.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse("en-US");
    }
    
    private List<String> extractTopics(String content) {
        // Simplified topic extraction - in real implementation, 
        // this could use NLP libraries or AI services
        List<String> topics = new ArrayList<>();
        
        String lowercaseContent = content.toLowerCase();
        
        // Simple keyword-based topic detection
        Map<String, String> topicKeywords = Map.of(
            "technology", "tech|software|computer|programming|ai|machine learning",
            "business", "business|company|market|sales|revenue|profit",
            "education", "education|school|university|learning|study|course",
            "health", "health|medical|doctor|hospital|medicine|treatment",
            "travel", "travel|trip|vacation|flight|hotel|destination",
            "food", "food|restaurant|cooking|recipe|cuisine|meal",
            "sports", "sports|game|team|player|match|competition",
            "entertainment", "movie|music|book|show|entertainment|art"
        );
        
        for (Map.Entry<String, String> entry : topicKeywords.entrySet()) {
            if (lowercaseContent.matches(".*(" + entry.getValue() + ").*")) {
                topics.add(entry.getKey());
            }
        }
        
        return topics;
    }
    
    private void addTopics(List<String> newTopics) {
        for (String topic : newTopics) {
            if (!topics.contains(topic) && topics.size() < MAX_TOPICS) {
                topics.add(topic);
            }
        }
    }
    
    private int estimateTokensInSummary(String summary) {
        // Rough estimation: 1 token ≈ 0.75 words ≈ 4 characters
        return summary.length() / 4;
    }
}
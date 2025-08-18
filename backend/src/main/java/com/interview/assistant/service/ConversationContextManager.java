package com.interview.assistant.service;

import com.interview.assistant.model.*;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Advanced conversation context management service
 * 
 * Why: Provides intelligent conversation context optimization and memory management
 * Pattern: Service Layer - manages complex context operations across sessions
 * Rationale: Essential for maintaining conversation quality while managing token limits
 */
@Service
public class ConversationContextManager {
    
    private static final Logger logger = LoggerFactory.getLogger(ConversationContextManager.class);
    
    // Session context storage
    private final Map<String, SessionContextData> sessionContexts = new ConcurrentHashMap<>();
    
    // Configuration
    private static final int MAX_CONTEXT_TOKENS = 3000;
    private static final int MAX_MESSAGES_PER_CONTEXT = 15;
    private static final double MIN_RELEVANCE_SCORE = 0.3;
    private static final long CONTEXT_TTL_MS = 1800000; // 30 minutes
    
    /**
     * Build optimized context for AI processing
     */
    public ConversationContext buildOptimizedContext(String sessionId, List<ConversationMessage> recentMessages, 
                                                   String systemPrompt) {
        logger.debug("Building optimized context for session: {}", sessionId);
        
        SessionContextData sessionData = getOrCreateSessionContext(sessionId);
        
        // Merge recent messages with session history
        List<ConversationMessage> allMessages = mergeMessageHistory(sessionData, recentMessages);
        
        // Apply context optimization strategies
        List<ConversationMessage> optimizedMessages = optimizeContext(allMessages, sessionData);
        
        // Extract entities and topics
        Map<String, Object> contextMetadata = buildContextMetadata(sessionData, optimizedMessages);
        
        // Update session context
        sessionData.updateWithMessages(optimizedMessages);
        
        return new ConversationContext(optimizedMessages, systemPrompt, sessionId, contextMetadata);
    }
    
    /**
     * Add conversation turn to session context
     */
    public void addConversationTurn(String sessionId, String userMessage, String assistantResponse) {
        SessionContextData sessionData = getOrCreateSessionContext(sessionId);
        
        // Create conversation turn
        ConversationTurn turn = new ConversationTurn(
            userMessage, 
            assistantResponse, 
            System.currentTimeMillis()
        );
        
        // Add to session history
        sessionData.addConversationTurn(turn);
        
        // Update context metadata
        updateContextMetadata(sessionData, userMessage, assistantResponse);
        
        logger.debug("Added conversation turn to session: {} (total turns: {})", 
            sessionId, sessionData.getConversationTurns().size());
    }
    
    /**
     * Extract and track entities from conversation
     */
    public Set<String> extractEntities(String text) {
        Set<String> entities = new HashSet<>();
        
        // Simple entity extraction (could be enhanced with NLP libraries)
        // Extract potential names (capitalized words)
        String[] words = text.split("\\s+");
        for (String word : words) {
            String cleaned = word.replaceAll("[^A-Za-z]", "");
            if (cleaned.length() > 2 && Character.isUpperCase(cleaned.charAt(0))) {
                entities.add(cleaned);
            }
        }
        
        return entities;
    }
    
    /**
     * Determine conversation topics
     */
    public Set<String> extractTopics(List<ConversationMessage> messages) {
        Set<String> topics = new HashSet<>();
        
        // Extract key topics from conversation content
        Map<String, Integer> wordFrequency = new HashMap<>();
        
        for (ConversationMessage message : messages) {
            String[] words = message.getContent().toLowerCase()
                .replaceAll("[^a-zA-Z\\s]", "")
                .split("\\s+");
                
            for (String word : words) {
                if (word.length() > 3 && !isStopWord(word)) {
                    wordFrequency.put(word, wordFrequency.getOrDefault(word, 0) + 1);
                }
            }
        }
        
        // Get most frequent words as topics
        topics.addAll(wordFrequency.entrySet().stream()
            .filter(entry -> entry.getValue() >= 2)
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .limit(5)
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet()));
        
        return topics;
    }
    
    /**
     * Calculate message relevance score
     */
    public double calculateRelevanceScore(ConversationMessage message, SessionContextData context) {
        double score = 1.0; // Base relevance
        
        // Recent messages are more relevant
        long messageAge = System.currentTimeMillis() - message.getTimestamp();
        double ageScore = Math.max(0.1, 1.0 - (messageAge / (double) CONTEXT_TTL_MS));
        
        // Messages with entities are more relevant
        Set<String> messageEntities = extractEntities(message.getContent());
        double entityOverlap = calculateEntityOverlap(messageEntities, context.getEntities());
        double entityScore = 1.0 + (entityOverlap * 0.5);
        
        // Topic relevance
        Set<String> messageTopics = extractTopics(List.of(message));
        double topicOverlap = calculateTopicOverlap(messageTopics, context.getTopics());
        double topicScore = 1.0 + (topicOverlap * 0.3);
        
        // Confidence impact
        double confidenceScore = Math.max(0.5, message.getConfidence());
        
        return score * ageScore * entityScore * topicScore * confidenceScore;
    }
    
    /**
     * Optimize context by removing less relevant messages
     */
    private List<ConversationMessage> optimizeContext(List<ConversationMessage> messages, 
                                                    SessionContextData sessionData) {
        if (messages.size() <= MAX_MESSAGES_PER_CONTEXT) {
            return messages;
        }
        
        logger.debug("Optimizing context: {} messages -> max {}", messages.size(), MAX_MESSAGES_PER_CONTEXT);
        
        // Calculate relevance scores for all messages
        List<MessageWithScore> scoredMessages = messages.stream()
            .map(msg -> new MessageWithScore(msg, calculateRelevanceScore(msg, sessionData)))
            .collect(Collectors.toList());
        
        // Keep the most recent messages and highest scored messages
        List<ConversationMessage> optimized = new ArrayList<>();
        
        // Always keep the most recent few messages
        int recentCount = Math.min(5, messages.size());
        optimized.addAll(messages.subList(messages.size() - recentCount, messages.size()));
        
        // Fill remaining slots with highest scored messages
        int remainingSlots = MAX_MESSAGES_PER_CONTEXT - recentCount;
        if (remainingSlots > 0) {
            scoredMessages.stream()
                .filter(mws -> mws.score >= MIN_RELEVANCE_SCORE)
                .filter(mws -> !optimized.contains(mws.message))
                .sorted((a, b) -> Double.compare(b.score, a.score))
                .limit(remainingSlots)
                .forEach(mws -> optimized.add(mws.message));
        }
        
        // Sort by timestamp to maintain conversation order
        optimized.sort(Comparator.comparing(ConversationMessage::getTimestamp));
        
        logger.debug("Context optimized: {} messages retained", optimized.size());
        return optimized;
    }
    
    /**
     * Merge session history with recent messages
     */
    private List<ConversationMessage> mergeMessageHistory(SessionContextData sessionData, 
                                                        List<ConversationMessage> recentMessages) {
        List<ConversationMessage> allMessages = new ArrayList<>();
        
        // Add historical messages from session turns
        for (ConversationTurn turn : sessionData.getConversationTurns()) {
            if (!turn.getUserMessage().trim().isEmpty()) {
                allMessages.add(ConversationMessage.user(turn.getUserMessage(), 0.9));
            }
            if (!turn.getAssistantResponse().trim().isEmpty()) {
                allMessages.add(ConversationMessage.assistant(turn.getAssistantResponse()));
            }
        }
        
        // Add recent messages
        allMessages.addAll(recentMessages);
        
        // Remove duplicates and sort by timestamp
        return allMessages.stream()
            .distinct()
            .sorted(Comparator.comparing(ConversationMessage::getTimestamp))
            .collect(Collectors.toList());
    }
    
    /**
     * Build context metadata
     */
    private Map<String, Object> buildContextMetadata(SessionContextData sessionData, 
                                                   List<ConversationMessage> messages) {
        Map<String, Object> metadata = new HashMap<>();
        
        // Basic conversation stats
        metadata.put("sessionId", sessionData.getSessionId());
        metadata.put("totalTurns", sessionData.getConversationTurns().size());
        metadata.put("contextMessages", messages.size());
        metadata.put("lastActivity", sessionData.getLastActivityTime());
        
        // Conversation topics and entities
        Set<String> currentTopics = extractTopics(messages);
        metadata.put("topics", new ArrayList<>(currentTopics));
        metadata.put("entities", new ArrayList<>(sessionData.getEntities()));
        
        // Conversation characteristics
        double avgConfidence = messages.stream()
            .mapToDouble(ConversationMessage::getConfidence)
            .average().orElse(0.0);
        metadata.put("averageConfidence", avgConfidence);
        
        int totalWords = messages.stream()
            .mapToInt(ConversationMessage::getWordCount)
            .sum();
        metadata.put("totalWords", totalWords);
        metadata.put("estimatedTokens", totalWords / 4); // Rough token estimation
        
        return metadata;
    }
    
    /**
     * Update context metadata with new conversation turn
     */
    private void updateContextMetadata(SessionContextData sessionData, String userMessage, 
                                     String assistantResponse) {
        // Update entities
        sessionData.addEntities(extractEntities(userMessage));
        sessionData.addEntities(extractEntities(assistantResponse));
        
        // Update topics
        List<ConversationMessage> recentMessages = List.of(
            ConversationMessage.user(userMessage, 0.9),
            ConversationMessage.assistant(assistantResponse)
        );
        sessionData.addTopics(extractTopics(recentMessages));
        
        // Update activity time
        sessionData.setLastActivityTime(System.currentTimeMillis());
    }
    
    /**
     * Get or create session context data
     */
    private SessionContextData getOrCreateSessionContext(String sessionId) {
        return sessionContexts.computeIfAbsent(sessionId, id -> {
            logger.info("Creating new session context: {}", id);
            return new SessionContextData(id, System.currentTimeMillis());
        });
    }
    
    /**
     * Calculate entity overlap between two sets
     */
    private double calculateEntityOverlap(Set<String> entities1, Set<String> entities2) {
        if (entities1.isEmpty() || entities2.isEmpty()) {
            return 0.0;
        }
        
        Set<String> intersection = new HashSet<>(entities1);
        intersection.retainAll(entities2);
        
        return (double) intersection.size() / Math.max(entities1.size(), entities2.size());
    }
    
    /**
     * Calculate topic overlap between two sets
     */
    private double calculateTopicOverlap(Set<String> topics1, Set<String> topics2) {
        if (topics1.isEmpty() || topics2.isEmpty()) {
            return 0.0;
        }
        
        Set<String> intersection = new HashSet<>(topics1);
        intersection.retainAll(topics2);
        
        return (double) intersection.size() / Math.max(topics1.size(), topics2.size());
    }
    
    /**
     * Check if word is a stop word
     */
    private boolean isStopWord(String word) {
        Set<String> stopWords = Set.of(
            "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
            "this", "that", "these", "those", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
            "may", "might", "must", "can", "cannot", "not", "no", "yes", "please", "thank"
        );
        return stopWords.contains(word.toLowerCase());
    }
    
    /**
     * Cleanup expired session contexts
     */
    public void cleanupExpiredContexts() {
        long now = System.currentTimeMillis();
        List<String> expiredSessions = sessionContexts.entrySet().stream()
            .filter(entry -> (now - entry.getValue().getLastActivityTime()) > CONTEXT_TTL_MS)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
        
        expiredSessions.forEach(sessionContexts::remove);
        
        if (!expiredSessions.isEmpty()) {
            logger.info("Cleaned up {} expired session contexts", expiredSessions.size());
        }
    }
    
    /**
     * Get context statistics
     */
    public Map<String, Object> getContextStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeContexts", sessionContexts.size());
        stats.put("totalConversationTurns", sessionContexts.values().stream()
            .mapToInt(ctx -> ctx.getConversationTurns().size())
            .sum());
        stats.put("averageTurnsPerSession", sessionContexts.isEmpty() ? 0 :
            sessionContexts.values().stream()
                .mapToInt(ctx -> ctx.getConversationTurns().size())
                .average().orElse(0.0));
        
        return stats;
    }
    
    // Inner classes
    
    private static class MessageWithScore {
        final ConversationMessage message;
        final double score;
        
        MessageWithScore(ConversationMessage message, double score) {
            this.message = message;
            this.score = score;
        }
    }
    
    /**
     * Session context data container
     */
    public static class SessionContextData {
        private final String sessionId;
        private final long createdAt;
        private volatile long lastActivityTime;
        
        private final List<ConversationTurn> conversationTurns = Collections.synchronizedList(new ArrayList<>());
        private final Set<String> entities = Collections.synchronizedSet(new HashSet<>());
        private final Set<String> topics = Collections.synchronizedSet(new HashSet<>());
        
        public SessionContextData(String sessionId, long createdAt) {
            this.sessionId = sessionId;
            this.createdAt = createdAt;
            this.lastActivityTime = createdAt;
        }
        
        public void addConversationTurn(ConversationTurn turn) {
            conversationTurns.add(turn);
            lastActivityTime = System.currentTimeMillis();
        }
        
        public void addEntities(Set<String> newEntities) {
            entities.addAll(newEntities);
        }
        
        public void addTopics(Set<String> newTopics) {
            topics.addAll(newTopics);
        }
        
        public void updateWithMessages(List<ConversationMessage> messages) {
            lastActivityTime = System.currentTimeMillis();
        }
        
        // Getters
        public String getSessionId() { return sessionId; }
        public long getCreatedAt() { return createdAt; }
        public long getLastActivityTime() { return lastActivityTime; }
        public List<ConversationTurn> getConversationTurns() { return new ArrayList<>(conversationTurns); }
        public Set<String> getEntities() { return new HashSet<>(entities); }
        public Set<String> getTopics() { return new HashSet<>(topics); }
        
        public void setLastActivityTime(long time) {
            this.lastActivityTime = time;
        }
    }
    
    /**
     * Conversation turn data model
     */
    public static class ConversationTurn {
        private final String userMessage;
        private final String assistantResponse;
        private final long timestamp;
        
        public ConversationTurn(String userMessage, String assistantResponse, long timestamp) {
            this.userMessage = userMessage != null ? userMessage : "";
            this.assistantResponse = assistantResponse != null ? assistantResponse : "";
            this.timestamp = timestamp;
        }
        
        public String getUserMessage() { return userMessage; }
        public String getAssistantResponse() { return assistantResponse; }
        public long getTimestamp() { return timestamp; }
        
        @Override
        public String toString() {
            return String.format("ConversationTurn{user='%s', assistant='%s', timestamp=%d}", 
                userMessage.length() > 50 ? userMessage.substring(0, 50) + "..." : userMessage,
                assistantResponse.length() > 50 ? assistantResponse.substring(0, 50) + "..." : assistantResponse,
                timestamp);
        }
    }
}
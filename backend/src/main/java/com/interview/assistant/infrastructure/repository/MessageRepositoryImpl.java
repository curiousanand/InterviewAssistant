package com.interview.assistant.infrastructure.repository;

import com.interview.assistant.domain.entity.Message;
import com.interview.assistant.domain.repository.IMessageRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory implementation of IMessageRepository for production use
 * This is a temporary implementation until proper database integration is added
 * 
 * Why: Enables production mode to start without database dependencies
 * Pattern: Repository pattern implementation with in-memory storage
 */
@Repository
@Profile("!test")
public class MessageRepositoryImpl implements IMessageRepository {
    
    private final Map<String, Message> messages = new ConcurrentHashMap<>();
    
    @Override
    public Message save(Message message) {
        if (message.getId() == null) {
            message.setId(UUID.randomUUID().toString());
        }
        messages.put(message.getId(), message);
        return message;
    }
    
    @Override
    public CompletableFuture<Message> saveAsync(Message message) {
        return CompletableFuture.supplyAsync(() -> save(message));
    }
    
    @Override
    public Optional<Message> findById(String messageId) {
        return Optional.ofNullable(messages.get(messageId));
    }
    
    @Override
    public List<Message> findBySessionId(String sessionId) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()))
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public Page<Message> findBySessionId(String sessionId, Pageable pageable) {
        List<Message> filtered = findBySessionId(sessionId);
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtered.size());
        
        List<Message> pageContent = filtered.subList(start, end);
        return new PageImpl<>(pageContent, pageable, filtered.size());
    }
    
    @Override
    public List<Message> findRecentMessagesBySessionId(String sessionId, int limit) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()))
                .sorted(Comparator.comparing(Message::getCreatedAt).reversed())
                .limit(limit)
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findBySessionIdAndRole(String sessionId, Message.MessageRole role) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) && 
                        role.equals(message.getRole()))
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findBySessionIdAndStatus(String sessionId, Message.ProcessingStatus status) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) && 
                        status.equals(message.getStatus()))
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findLowConfidenceUserMessages(String sessionId, double confidenceThreshold) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        Message.MessageRole.USER.equals(message.getRole()) &&
                        message.getConfidence() != null &&
                        message.getConfidence() < confidenceThreshold)
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findBySessionIdAndCreatedAtBetween(String sessionId, Instant startTime, Instant endTime) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        message.getCreatedAt() != null &&
                        !message.getCreatedAt().isBefore(startTime) &&
                        !message.getCreatedAt().isAfter(endTime))
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findBySessionIdAndDetectedLanguage(String sessionId, String language) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        language.equals(message.getDetectedLanguage()))
                .sorted(Comparator.comparing(Message::getCreatedAt))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<Message> findFailedMessagesBySessionId(String sessionId) {
        return findBySessionIdAndStatus(sessionId, Message.ProcessingStatus.FAILED);
    }
    
    @Override
    public long countBySessionId(String sessionId) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()))
                .count();
    }
    
    @Override
    public long countBySessionIdAndRole(String sessionId, Message.MessageRole role) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) && 
                        role.equals(message.getRole()))
                .count();
    }
    
    @Override
    public long countBySessionIdAndStatus(String sessionId, Message.ProcessingStatus status) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) && 
                        status.equals(message.getStatus()))
                .count();
    }
    
    @Override
    public long getTotalTokensBySessionId(String sessionId) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        Message.MessageRole.ASSISTANT.equals(message.getRole()) &&
                        message.getTokensUsed() != null)
                .mapToLong(Message::getTokensUsed)
                .sum();
    }
    
    @Override
    public double getAverageConfidenceBySessionId(String sessionId) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        Message.MessageRole.USER.equals(message.getRole()) &&
                        message.getConfidence() != null)
                .mapToDouble(Message::getConfidence)
                .average()
                .orElse(0.0);
    }
    
    @Override
    public double getAverageProcessingTimeBySessionId(String sessionId) {
        return messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        Message.MessageRole.ASSISTANT.equals(message.getRole()) &&
                        message.getProcessingTimeMs() != null)
                .mapToDouble(Message::getProcessingTimeMs)
                .average()
                .orElse(0.0);
    }
    
    @Override
    public int updateMessageStatus(String messageId, Message.ProcessingStatus status) {
        Message message = messages.get(messageId);
        if (message != null) {
            message.setStatus(status);
            return 1;
        }
        return 0;
    }
    
    @Override
    public int updateMessageError(String messageId, Message.ProcessingStatus status, String errorMessage) {
        Message message = messages.get(messageId);
        if (message != null) {
            message.setStatus(status);
            message.setErrorMessage(errorMessage);
            return 1;
        }
        return 0;
    }
    
    @Override
    public int bulkUpdateMessageStatus(List<String> messageIds, Message.ProcessingStatus status) {
        int updated = 0;
        for (String messageId : messageIds) {
            updated += updateMessageStatus(messageId, status);
        }
        return updated;
    }
    
    @Override
    public boolean deleteById(String messageId) {
        return messages.remove(messageId) != null;
    }
    
    @Override
    public int deleteBySessionId(String sessionId) {
        List<String> toDelete = messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()))
                .map(Message::getId)
                .collect(Collectors.toList());
        
        toDelete.forEach(messages::remove);
        return toDelete.size();
    }
    
    @Override
    public int deleteOldMessagesBySessionId(String sessionId, Instant cutoffTime) {
        List<String> toDelete = messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        message.getCreatedAt() != null &&
                        message.getCreatedAt().isBefore(cutoffTime))
                .map(Message::getId)
                .collect(Collectors.toList());
        
        toDelete.forEach(messages::remove);
        return toDelete.size();
    }
    
    @Override
    public int deleteFailedMessagesBySessionId(String sessionId) {
        List<String> toDelete = messages.values().stream()
                .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                        Message.ProcessingStatus.FAILED.equals(message.getStatus()))
                .map(Message::getId)
                .collect(Collectors.toList());
        
        toDelete.forEach(messages::remove);
        return toDelete.size();
    }
    
    @Override
    public boolean existsById(String messageId) {
        return messages.containsKey(messageId);
    }
    
    @Override
    public List<Message> getConversationForExport(String sessionId) {
        return findBySessionId(sessionId);
    }
    
    @Override
    public MessageRepositoryStats getMessageStats(String sessionId) {
        return new MessageRepositoryStatsImpl(sessionId);
    }
    
    @Override
    public List<Message> saveAll(List<Message> messagesToSave) {
        return messagesToSave.stream()
                .map(this::save)
                .collect(Collectors.toList());
    }
    
    /**
     * Implementation of MessageRepositoryStats for in-memory storage
     */
    private class MessageRepositoryStatsImpl implements MessageRepositoryStats {
        
        private final String sessionId;
        
        public MessageRepositoryStatsImpl(String sessionId) {
            this.sessionId = sessionId;
        }
        
        @Override
        public long getTotalMessages() {
            return countBySessionId(sessionId);
        }
        
        @Override
        public long getUserMessages() {
            return countBySessionIdAndRole(sessionId, Message.MessageRole.USER);
        }
        
        @Override
        public long getAssistantMessages() {
            return countBySessionIdAndRole(sessionId, Message.MessageRole.ASSISTANT);
        }
        
        @Override
        public long getSystemMessages() {
            return countBySessionIdAndRole(sessionId, Message.MessageRole.SYSTEM);
        }
        
        @Override
        public long getPendingMessages() {
            return countBySessionIdAndStatus(sessionId, Message.ProcessingStatus.PENDING);
        }
        
        @Override
        public long getProcessingMessages() {
            return countBySessionIdAndStatus(sessionId, Message.ProcessingStatus.PROCESSING);
        }
        
        @Override
        public long getCompletedMessages() {
            return countBySessionIdAndStatus(sessionId, Message.ProcessingStatus.COMPLETED);
        }
        
        @Override
        public long getFailedMessages() {
            return countBySessionIdAndStatus(sessionId, Message.ProcessingStatus.FAILED);
        }
        
        @Override
        public double getAverageConfidence() {
            return getAverageConfidenceBySessionId(sessionId);
        }
        
        @Override
        public double getAverageProcessingTime() {
            return getAverageProcessingTimeBySessionId(sessionId);
        }
        
        @Override
        public long getTotalTokensUsed() {
            return getTotalTokensBySessionId(sessionId);
        }
        
        @Override
        public String getPrimaryLanguage() {
            Map<String, Long> languageCounts = messages.values().stream()
                    .filter(message -> message.getSession() != null && sessionId.equals(message.getSession().getId()) &&
                            message.getDetectedLanguage() != null)
                    .collect(Collectors.groupingBy(
                            Message::getDetectedLanguage,
                            Collectors.counting()
                    ));
            
            return languageCounts.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("unknown");
        }
    }
}
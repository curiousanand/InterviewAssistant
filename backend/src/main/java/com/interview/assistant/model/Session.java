package com.interview.assistant.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Session aggregate root representing a conversation session
 * 
 * Why: Central domain entity that maintains conversation state and enforces business rules
 * Pattern: DDD Aggregate Root - ensures consistency within the session boundary
 * Rationale: Sessions are the primary unit of work in our domain model
 */
@Entity
@Table(name = "sessions", indexes = {
    @Index(name = "idx_session_status", columnList = "status"),
    @Index(name = "idx_session_last_accessed", columnList = "lastAccessedAt")
})
public class Session {

    @Id
    @Column(length = 36)
    private String id;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private SessionStatus status;
    
    @Column(length = 10)
    private String targetLanguage;
    
    @Column
    private Boolean autoDetectLanguage;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private Instant lastAccessedAt;
    
    @Column
    private Instant closedAt;
    
    /**
     * Messages in this session
     * Why: Bidirectional relationship for easy navigation
     * Pattern: Cascade operations to maintain consistency
     */
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, 
               orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("createdAt ASC")
    private List<Message> messages = new ArrayList<>();
    
    @Column
    private Integer messageCount;
    
    @Column
    private Integer totalTokensUsed;
    
    /**
     * WebSocket connection metadata
     */
    @Column
    private String webSocketSessionId;
    
    @Column
    private String clientIpAddress;
    
    @Column
    private String userAgent;
    
    /**
     * Default constructor for JPA
     */
    public Session() {
        this.messages = new ArrayList<>();
    }
    
    /**
     * Create a new session with proper initialization
     * Why: Factory method ensures valid initial state
     * Pattern: Static factory method for controlled instantiation
     */
    public static Session create(String targetLanguage, boolean autoDetect) {
        Session session = new Session();
        session.id = UUID.randomUUID().toString();
        session.status = SessionStatus.ACTIVE;
        session.targetLanguage = targetLanguage;
        session.autoDetectLanguage = autoDetect;
        session.messageCount = 0;
        session.totalTokensUsed = 0;
        session.messages = new ArrayList<>();
        return session;
    }
    
    /**
     * Add a message to the session
     * Why: Encapsulates message addition with business rules
     * Pattern: Tell, Don't Ask - session manages its own state
     */
    public void addMessage(Message message) {
        if (status != SessionStatus.ACTIVE) {
            throw new IllegalStateException("Cannot add message to inactive session");
        }
        
        messages.add(message);
        message.setSession(this);
        messageCount = messages.size();
        
        if (message.getTokensUsed() != null) {
            totalTokensUsed = (totalTokensUsed == null ? 0 : totalTokensUsed) 
                            + message.getTokensUsed();
        }
        
        lastAccessedAt = Instant.now();
    }
    
    /**
     * Close the session
     * Why: Explicit lifecycle management with state validation
     */
    public void close() {
        if (status == SessionStatus.CLOSED) {
            return; // Idempotent operation
        }
        
        status = SessionStatus.CLOSED;
        closedAt = Instant.now();
    }
    
    /**
     * Check if session should be summarized
     * Why: Business rule for conversation summarization
     * Rationale: Prevents context from growing too large
     */
    public boolean shouldSummarize(int threshold) {
        return messageCount != null && messageCount > threshold;
    }
    
    /**
     * Mark session as expired
     * Why: Automatic cleanup of inactive sessions
     */
    public void expire() {
        if (status != SessionStatus.CLOSED) {
            status = SessionStatus.EXPIRED;
            closedAt = Instant.now();
        }
    }
    
    /**
     * Get session ID
     */
    public String getSessionId() {
        return this.id;
    }
    
    /**
     * Get language code
     */
    public String getLanguageCode() {
        return this.targetLanguage;
    }
    
    /**
     * Check if session is active
     */
    public boolean isActive() {
        return this.status == SessionStatus.ACTIVE;
    }
    
    /**
     * Session status enumeration
     */
    public enum SessionStatus {
        ACTIVE,    // Session is active and accepting messages
        CLOSED,    // Session was closed normally
        EXPIRED    // Session expired due to inactivity
    }
    
    // Manual getters to bypass Lombok issues
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public SessionStatus getStatus() { return status; }
    public void setStatus(SessionStatus status) { this.status = status; }
    
    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
    
    public Boolean getAutoDetectLanguage() { return autoDetectLanguage; }
    public void setAutoDetectLanguage(Boolean autoDetectLanguage) { this.autoDetectLanguage = autoDetectLanguage; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public Instant getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(Instant lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
    
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    
    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }
    
    public Integer getMessageCount() { return messageCount; }
    public void setMessageCount(Integer messageCount) { this.messageCount = messageCount; }
    
    public Integer getTotalTokensUsed() { return totalTokensUsed; }
    public void setTotalTokensUsed(Integer totalTokensUsed) { this.totalTokensUsed = totalTokensUsed; }
    
    public String getWebSocketSessionId() { return webSocketSessionId; }
    public void setWebSocketSessionId(String webSocketSessionId) { this.webSocketSessionId = webSocketSessionId; }
    
    public String getClientIpAddress() { return clientIpAddress; }
    public void setClientIpAddress(String clientIpAddress) { this.clientIpAddress = clientIpAddress; }
    
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
}
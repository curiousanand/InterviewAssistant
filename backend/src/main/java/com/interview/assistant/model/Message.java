package com.interview.assistant.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Message entity representing a single conversation message
 * 
 * Why: Encapsulates message data with validation and business rules
 * Pattern: DDD Entity - has identity and encapsulates behavior
 * Rationale: Messages are core domain objects that maintain conversation history
 */
@Entity
@Table(name = "messages", indexes = {
    @Index(name = "idx_message_session", columnList = "session_id"),
    @Index(name = "idx_message_created", columnList = "createdAt"),
    @Index(name = "idx_message_role", columnList = "role")
})
public class Message {

    @Id
    @Column(length = 36)
    private String id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private Session session;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MessageRole role;
    
    @Column(nullable = false, length = 10000)
    private String content;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    
    /**
     * Transcription metadata
     */
    @Column
    private Double confidence;
    
    @Column(length = 10)
    private String detectedLanguage;
    
    @Column
    private String originalAudioHash;
    
    /**
     * AI response metadata
     */
    @Column
    private Integer tokensUsed;
    
    @Column
    private Double processingTimeMs;
    
    @Column(length = 50)
    private String aiModel;
    
    @Column
    private String parentMessageId;
    
    /**
     * Processing status
     */
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ProcessingStatus status = ProcessingStatus.PENDING;
    
    @Column(length = 1000)
    private String errorMessage;
    
    /**
     * Default constructor for JPA
     */
    public Message() {}
    
    /**
     * Create a user message from transcription
     * Why: Factory method ensures proper initialization and validation
     * Pattern: Static factory method for controlled instantiation
     */
    public static Message createUserMessage(String content, Double confidence, String language) {
        validateContent(content);
        
        Message message = new Message();
        message.id = UUID.randomUUID().toString();
        message.role = MessageRole.USER;
        message.content = content.trim();
        message.confidence = confidence;
        message.detectedLanguage = language;
        message.status = ProcessingStatus.COMPLETED;
        message.createdAt = Instant.now();
        return message;
    }
    
    /**
     * Create an assistant message
     * Why: Factory method ensures proper initialization for AI responses
     */
    public static Message createAssistantMessage(String content, String aiModel, 
                                               Integer tokensUsed, Double processingTime) {
        validateContent(content);
        
        Message message = new Message();
        message.id = UUID.randomUUID().toString();
        message.role = MessageRole.ASSISTANT;
        message.content = content.trim();
        message.aiModel = aiModel;
        message.tokensUsed = tokensUsed;
        message.processingTimeMs = processingTime;
        message.status = ProcessingStatus.COMPLETED;
        message.createdAt = Instant.now();
        return message;
    }
    
    /**
     * Create a system message
     * Why: System messages for conversation management
     */
    public static Message createSystemMessage(String content) {
        validateContent(content);
        
        Message message = new Message();
        message.id = UUID.randomUUID().toString();
        message.role = MessageRole.SYSTEM;
        message.content = content.trim();
        message.status = ProcessingStatus.COMPLETED;
        message.createdAt = Instant.now();
        return message;
    }
    
    /**
     * Mark message as processing
     * Why: Track message processing lifecycle
     */
    public void markAsProcessing() {
        if (status != ProcessingStatus.PENDING) {
            throw new IllegalStateException("Can only process pending messages");
        }
        status = ProcessingStatus.PROCESSING;
    }
    
    /**
     * Mark message as completed
     * Why: Complete message processing lifecycle
     */
    public void markAsCompleted() {
        if (status != ProcessingStatus.PROCESSING) {
            throw new IllegalStateException("Can only complete processing messages");
        }
        status = ProcessingStatus.COMPLETED;
        errorMessage = null;
    }
    
    /**
     * Mark message as failed
     * Why: Handle processing failures with error information
     */
    public void markAsFailed(String error) {
        status = ProcessingStatus.FAILED;
        errorMessage = error;
    }
    
    /**
     * Check if message is from user
     * Why: Convenient business logic method
     */
    public boolean isFromUser() {
        return role == MessageRole.USER;
    }
    
    /**
     * Check if message is from assistant
     * Why: Convenient business logic method
     */
    public boolean isFromAssistant() {
        return role == MessageRole.ASSISTANT;
    }
    
    /**
     * Check if message processing was successful
     * Why: Status checking for business logic
     */
    public boolean isProcessingComplete() {
        return status == ProcessingStatus.COMPLETED;
    }
    
    /**
     * Get content preview for logging/display
     * Why: Safe content truncation for display purposes
     */
    public String getContentPreview(int maxLength) {
        if (content == null) return "";
        
        if (content.length() <= maxLength) {
            return content;
        }
        
        return content.substring(0, maxLength - 3) + "...";
    }
    
    /**
     * Calculate confidence level category
     * Why: Business logic for confidence interpretation
     */
    public ConfidenceLevel getConfidenceLevel() {
        if (confidence == null) return ConfidenceLevel.UNKNOWN;
        
        if (confidence >= 0.9) return ConfidenceLevel.HIGH;
        if (confidence >= 0.7) return ConfidenceLevel.MEDIUM;
        if (confidence >= 0.5) return ConfidenceLevel.LOW;
        return ConfidenceLevel.VERY_LOW;
    }
    
    private static void validateContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Message content cannot be null or empty");
        }
        
        if (content.length() > 10000) {
            throw new IllegalArgumentException("Message content exceeds maximum length");
        }
    }
    
    /**
     * Message role enumeration
     */
    public enum MessageRole {
        USER,       // Message from user (transcribed from audio)
        ASSISTANT,  // Message from AI assistant
        SYSTEM      // System message (conversation management)
    }
    
    /**
     * Processing status enumeration
     */
    public enum ProcessingStatus {
        PENDING,    // Message created but not processed
        PROCESSING, // Message currently being processed
        COMPLETED,  // Message processed successfully
        FAILED      // Message processing failed
    }
    
    /**
     * Confidence level enumeration
     */
    public enum ConfidenceLevel {
        VERY_LOW,   // < 0.5
        LOW,        // 0.5 - 0.7
        MEDIUM,     // 0.7 - 0.9
        HIGH,       // >= 0.9
        UNKNOWN     // No confidence score available
    }
    
    // Manual getters and setters to bypass Lombok issues
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    
    public MessageRole getRole() { return role; }
    public void setRole(MessageRole role) { this.role = role; }
    
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    
    public String getDetectedLanguage() { return detectedLanguage; }
    public void setDetectedLanguage(String detectedLanguage) { this.detectedLanguage = detectedLanguage; }
    
    public ProcessingStatus getStatus() { return status; }
    public void setStatus(ProcessingStatus status) { this.status = status; }
    
    public Integer getTokensUsed() { return tokensUsed; }
    public void setTokensUsed(Integer tokensUsed) { this.tokensUsed = tokensUsed; }
    
    public Double getProcessingTimeMs() { return processingTimeMs; }
    public void setProcessingTimeMs(Double processingTimeMs) { this.processingTimeMs = processingTimeMs; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public void setSession(Session session) { this.session = session; }
    public Session getSession() { return session; }
}
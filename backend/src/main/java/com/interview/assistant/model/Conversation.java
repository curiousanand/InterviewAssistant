package com.interview.assistant.model;

import com.interview.assistant.model.Session;
import com.interview.assistant.model.Message;

import java.time.Instant;
import java.util.List;

/**
 * Conversation aggregate root
 * 
 * Why: Represents a complete conversation with all messages and context
 * Pattern: DDD Aggregate Root - maintains consistency across conversation entities
 * Rationale: Encapsulates conversation business rules and state management
 */
public class Conversation {
    
    private final Session session;
    
    public Conversation(Session session) {
        this.session = session;
    }
    
    /**
     * Create new conversation
     * Why: Factory method for conversation creation
     */
    public static Conversation start(String targetLanguage, boolean autoDetect) {
        Session session = Session.create(targetLanguage, autoDetect);
        return new Conversation(session);
    }
    
    /**
     * Add message to conversation
     * Why: Encapsulate message addition with business rules
     */
    public void addMessage(Message message) {
        session.addMessage(message);
    }
    
    /**
     * Get conversation messages
     * Why: Access conversation history
     */
    public List<Message> getMessages() {
        return session.getMessages();
    }
    
    /**
     * Get session
     * Why: Access underlying session
     */
    public Session getSession() {
        return session;
    }
    
    /**
     * Close conversation
     * Why: Explicit conversation termination
     */
    public void close() {
        session.close();
    }
    
    /**
     * Check if conversation is active
     * Why: Conversation state checking
     */
    public boolean isActive() {
        return session.isActive();
    }
    
    /**
     * Get conversation duration
     * Why: Conversation analytics
     */
    public long getDurationMinutes() {
        if (session.getCreatedAt() == null) return 0;
        
        Instant endTime = session.getClosedAt() != null ? 
            session.getClosedAt() : Instant.now();
            
        return (endTime.toEpochMilli() - session.getCreatedAt().toEpochMilli()) / (1000 * 60);
    }
    
    /**
     * Get message count
     * Why: Conversation statistics
     */
    public int getMessageCount() {
        return session.getMessageCount() != null ? session.getMessageCount() : 0;
    }
}
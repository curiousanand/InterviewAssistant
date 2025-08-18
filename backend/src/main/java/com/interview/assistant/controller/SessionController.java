package com.interview.assistant.controller;

import com.interview.assistant.model.Session;
import com.interview.assistant.repository.ISessionRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.context.annotation.Profile;

import java.time.Instant;

/**
 * Production session management controller
 * Handles session lifecycle operations for the Interview Assistant
 */
@RestController
@RequestMapping("/api/v1/sessions")
@Profile("!test")
public class SessionController {
    
    private final ISessionRepository sessionRepository;
    
    public SessionController(ISessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }
    
    /**
     * Create a new interview session
     */
    @PostMapping
    public ResponseEntity<SessionResponse> createSession(@RequestBody CreateSessionRequest request) {
        try {
            Session session = Session.create(
                request.getTargetLanguage() != null ? request.getTargetLanguage() : "en-US",
                request.getAutoDetect() != null ? request.getAutoDetect() : true
            );
            
            // In a real implementation, this would save to database
            // Session savedSession = sessionRepository.save(session);
            
            SessionResponse response = SessionResponse.from(session);
            
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    /**
     * Get session by ID
     */
    @GetMapping("/{sessionId}")
    public ResponseEntity<SessionResponse> getSession(@PathVariable String sessionId) {
        try {
            // In a real implementation, this would fetch from database
            // Optional<Session> session = sessionRepository.findById(sessionId);
            
            // For now, return a mock response
            Session mockSession = Session.create("en-US", true);
            mockSession.setId(sessionId);
            
            SessionResponse response = SessionResponse.from(mockSession);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
    
    /**
     * Close session
     */
    @PostMapping("/{sessionId}/close")
    public ResponseEntity<Void> closeSession(@PathVariable String sessionId) {
        try {
            // In a real implementation, this would update the session in database
            // Optional<Session> session = sessionRepository.findById(sessionId);
            // session.ifPresent(s -> { s.close(); sessionRepository.save(s); });
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // DTOs
    public static class CreateSessionRequest {
        private String targetLanguage;
        private Boolean autoDetect;
        
        public CreateSessionRequest() {}
        
        public String getTargetLanguage() { return targetLanguage; }
        public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
        public Boolean getAutoDetect() { return autoDetect; }
        public void setAutoDetect(Boolean autoDetect) { this.autoDetect = autoDetect; }
    }
    
    public static class SessionResponse {
        private String id;
        private String status;
        private String targetLanguage;
        private Boolean autoDetectLanguage;
        private Instant createdAt;
        private Integer messageCount;
        
        public SessionResponse() {}
        
        public static SessionResponse from(Session session) {
            SessionResponse response = new SessionResponse();
            response.id = session.getId();
            response.status = session.getStatus() != null ? session.getStatus().toString() : "ACTIVE";
            response.targetLanguage = session.getTargetLanguage();
            response.autoDetectLanguage = session.getAutoDetectLanguage();
            response.createdAt = session.getCreatedAt();
            response.messageCount = session.getMessageCount();
            return response;
        }
        
        // Getters and setters
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getTargetLanguage() { return targetLanguage; }
        public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }
        public Boolean getAutoDetectLanguage() { return autoDetectLanguage; }
        public void setAutoDetectLanguage(Boolean autoDetectLanguage) { this.autoDetectLanguage = autoDetectLanguage; }
        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
        public Integer getMessageCount() { return messageCount; }
        public void setMessageCount(Integer messageCount) { this.messageCount = messageCount; }
    }
}
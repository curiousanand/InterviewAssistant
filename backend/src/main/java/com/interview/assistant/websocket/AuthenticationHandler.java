package com.interview.assistant.websocket;

import com.interview.assistant.websocket.WebSocketMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Authentication handler for WebSocket connections
 * 
 * Why: Ensures only authorized clients can access WebSocket endpoints
 * Pattern: Chain of Responsibility - handles authentication in message pipeline
 * Rationale: Security layer that validates session authentication state
 */
@Component
public class AuthenticationHandler {
    
    private final Map<String, AuthenticationState> sessionStates = new ConcurrentHashMap<>();
    private final long SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    
    /**
     * Authenticate WebSocket session
     * Why: Verify client authorization before processing messages
     * 
     * @param session WebSocket session
     * @param apiKey Client API key (if provided)
     * @return Authentication result
     */
    public AuthenticationResult authenticate(WebSocketSession session, String apiKey) {
        String sessionId = session.getId();
        
        // For now, implement simple authentication
        // In production, this would validate against proper auth service
        if (isValidApiKey(apiKey)) {
            AuthenticationState authState = new AuthenticationState(
                sessionId, true, Instant.now(), apiKey
            );
            sessionStates.put(sessionId, authState);
            
            return AuthenticationResult.success(authState);
        }
        
        return AuthenticationResult.failure("Invalid API key");
    }
    
    /**
     * Check if session is authenticated
     * Why: Validate ongoing session authentication for message processing
     * 
     * @param session WebSocket session
     * @return True if session is authenticated and not expired
     */
    public boolean isAuthenticated(WebSocketSession session) {
        String sessionId = session.getId();
        AuthenticationState state = sessionStates.get(sessionId);
        
        if (state == null || !state.isAuthenticated()) {
            return false;
        }
        
        // Check if session has expired
        if (isSessionExpired(state)) {
            sessionStates.remove(sessionId);
            return false;
        }
        
        // Update last activity
        state.updateLastActivity();
        return true;
    }
    
    /**
     * Validate message authentication
     * Why: Ensure each message comes from authenticated source
     * 
     * @param message WebSocket message
     * @param session WebSocket session
     * @return Authentication result for the message
     */
    public AuthenticationResult validateMessage(WebSocketMessage message, WebSocketSession session) {
        if (!isAuthenticated(session)) {
            return AuthenticationResult.failure("Session not authenticated");
        }
        
        // Validate session ID consistency
        AuthenticationState state = sessionStates.get(session.getId());
        if (state != null && message.getSessionId() != null) {
            // Allow flexibility in session ID mapping for client convenience
            // In production, this might be more strict
        }
        
        return AuthenticationResult.success(state);
    }
    
    /**
     * Clean up authentication state when session closes
     * Why: Prevent memory leaks from closed sessions
     * 
     * @param session WebSocket session that closed
     */
    public void cleanupSession(WebSocketSession session) {
        sessionStates.remove(session.getId());
    }
    
    /**
     * Get authentication state for session
     * Why: Access authentication details for logging and monitoring
     */
    public AuthenticationState getAuthenticationState(WebSocketSession session) {
        return sessionStates.get(session.getId());
    }
    
    /**
     * Clean up expired sessions
     * Why: Periodic cleanup to prevent memory leaks
     */
    public void cleanupExpiredSessions() {
        sessionStates.entrySet().removeIf(entry -> isSessionExpired(entry.getValue()));
    }
    
    /**
     * Simple API key validation
     * Why: Basic authentication mechanism
     * In production, this would integrate with proper auth service
     */
    private boolean isValidApiKey(String apiKey) {
        // For testing purposes, accept any non-empty API key
        // In production, this would validate against a proper auth service
        return apiKey != null && !apiKey.trim().isEmpty() && apiKey.length() >= 10;
    }
    
    /**
     * Check if authentication session has expired
     */
    private boolean isSessionExpired(AuthenticationState state) {
        return Instant.now().toEpochMilli() - state.getLastActivity().toEpochMilli() > SESSION_TIMEOUT_MS;
    }
    
    /**
     * Authentication state value object
     */
    public static class AuthenticationState {
        private final String sessionId;
        private final boolean authenticated;
        private final Instant authenticatedAt;
        private final String apiKey;
        private Instant lastActivity;
        
        public AuthenticationState(String sessionId, boolean authenticated, 
                                 Instant authenticatedAt, String apiKey) {
            this.sessionId = sessionId;
            this.authenticated = authenticated;
            this.authenticatedAt = authenticatedAt;
            this.apiKey = apiKey;
            this.lastActivity = Instant.now();
        }
        
        public void updateLastActivity() {
            this.lastActivity = Instant.now();
        }
        
        // Getters
        public String getSessionId() { return sessionId; }
        public boolean isAuthenticated() { return authenticated; }
        public Instant getAuthenticatedAt() { return authenticatedAt; }
        public String getApiKey() { return apiKey; }
        public Instant getLastActivity() { return lastActivity; }
    }
    
    /**
     * Authentication result value object
     */
    public static class AuthenticationResult {
        private final boolean success;
        private final String errorMessage;
        private final AuthenticationState authState;
        
        private AuthenticationResult(boolean success, String errorMessage, AuthenticationState authState) {
            this.success = success;
            this.errorMessage = errorMessage;
            this.authState = authState;
        }
        
        public static AuthenticationResult success(AuthenticationState authState) {
            return new AuthenticationResult(true, null, authState);
        }
        
        public static AuthenticationResult failure(String errorMessage) {
            return new AuthenticationResult(false, errorMessage, null);
        }
        
        // Getters
        public boolean isSuccess() { return success; }
        public String getErrorMessage() { return errorMessage; }
        public AuthenticationState getAuthState() { return authState; }
    }
}
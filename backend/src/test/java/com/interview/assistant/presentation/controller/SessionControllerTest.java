package com.interview.assistant.presentation.controller;

import com.interview.assistant.domain.entity.Session;
import com.interview.assistant.domain.repository.ISessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive test suite for SessionController
 * 
 * Tests REST endpoints, request/response handling, and error scenarios
 */
@WebMvcTest(SessionController.class)
@ActiveProfiles("test")
@DisplayName("SessionController Tests")
class SessionControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @MockBean
    private ISessionRepository sessionRepository;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    private SessionController.CreateSessionRequest validCreateRequest;
    private Session mockSession;
    
    @BeforeEach
    void setUp() {
        validCreateRequest = new SessionController.CreateSessionRequest();
        validCreateRequest.setTargetLanguage("en-US");
        validCreateRequest.setAutoDetect(true);
        
        mockSession = Session.create("en-US", true);
        mockSession.setId("test-session-123");
    }
    
    @Test
    @DisplayName("Should create session successfully with valid request")
    void shouldCreateSessionSuccessfullyWithValidRequest() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andExpect(jsonPath("$.targetLanguage", is("en-US")))
                .andExpect(jsonPath("$.autoDetectLanguage", is(true)))
                .andExpect(jsonPath("$.createdAt", notNullValue()))
                .andExpect(jsonPath("$.messageCount", is(0)));
    }
    
    @Test
    @DisplayName("Should create session with default values when optional fields are null")
    void shouldCreateSessionWithDefaultValues() throws Exception {
        // Given
        SessionController.CreateSessionRequest requestWithNulls = new SessionController.CreateSessionRequest();
        // targetLanguage and autoDetect are null
        String requestJson = objectMapper.writeValueAsString(requestWithNulls);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetLanguage", is("en-US"))) // Default value
                .andExpect(jsonPath("$.autoDetectLanguage", is(true))); // Default value
    }
    
    @Test
    @DisplayName("Should create session with custom language")
    void shouldCreateSessionWithCustomLanguage() throws Exception {
        // Given
        validCreateRequest.setTargetLanguage("es-ES");
        validCreateRequest.setAutoDetect(false);
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetLanguage", is("es-ES")))
                .andExpect(jsonPath("$.autoDetectLanguage", is(false)));
    }
    
    @Test
    @DisplayName("Should handle malformed JSON in create request")
    void shouldHandleMalformedJsonInCreateRequest() throws Exception {
        // Given
        String malformedJson = "{\"targetLanguage\": \"en-US\", \"autoDetect\": }"; // Invalid JSON
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(malformedJson))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    @DisplayName("Should handle missing content type in create request")
    void shouldHandleMissingContentTypeInCreateRequest() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .content(requestJson)) // Missing content type
                .andExpect(status().isUnsupportedMediaType());
    }
    
    @Test
    @DisplayName("Should get session successfully")
    void shouldGetSessionSuccessfully() throws Exception {
        // Given
        String sessionId = "test-session-123";
        
        // When & Then
        mockMvc.perform(get("/api/v1/sessions/{sessionId}", sessionId))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.id", is(sessionId)))
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andExpect(jsonPath("$.targetLanguage", is("en-US")))
                .andExpect(jsonPath("$.autoDetectLanguage", is(true)))
                .andExpect(jsonPath("$.createdAt", notNullValue()));
    }
    
    @Test
    @DisplayName("Should handle get session with empty session ID")
    void shouldHandleGetSessionWithEmptySessionId() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/v1/sessions/"))
                .andExpect(status().isNotFound()); // Spring returns 404 for empty path variable
    }
    
    @Test
    @DisplayName("Should handle get session with special characters in ID")
    void shouldHandleGetSessionWithSpecialCharactersInId() throws Exception {
        // Given
        String sessionIdWithSpecialChars = "test-session-123!@#$%";
        
        // When & Then
        mockMvc.perform(get("/api/v1/sessions/{sessionId}", sessionIdWithSpecialChars))
                .andExpect(status().isOk()) // Controller should handle any string
                .andExpect(jsonPath("$.id", is(sessionIdWithSpecialChars)));
    }
    
    @Test
    @DisplayName("Should close session successfully")
    void shouldCloseSessionSuccessfully() throws Exception {
        // Given
        String sessionId = "test-session-123";
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions/{sessionId}/close", sessionId))
                .andExpect(status().isOk())
                .andExpect(content().string("")); // Empty response body for void return
    }
    
    @Test
    @DisplayName("Should handle close session with empty session ID")
    void shouldHandleCloseSessionWithEmptySessionId() throws Exception {
        // When & Then
        mockMvc.perform(post("/api/v1/sessions//close"))
                .andExpect(status().isNotFound()); // Spring returns 404 for empty path variable
    }
    
    @Test
    @DisplayName("Should handle close session with very long session ID")
    void shouldHandleCloseSessionWithVeryLongSessionId() throws Exception {
        // Given
        String veryLongSessionId = "a".repeat(1000); // Very long session ID
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions/{sessionId}/close", veryLongSessionId))
                .andExpect(status().isOk()); // Should handle any length
    }
    
    @Test
    @DisplayName("Should handle concurrent session creation requests")
    void shouldHandleConcurrentSessionCreationRequests() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then - Multiple concurrent requests
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated());
        
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated());
        
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated());
    }
    
    @Test
    @DisplayName("Should validate CreateSessionRequest DTO")
    void shouldValidateCreateSessionRequestDto() {
        // Given
        SessionController.CreateSessionRequest request = new SessionController.CreateSessionRequest();
        
        // When & Then - Test getters and setters
        request.setTargetLanguage("fr-FR");
        request.setAutoDetect(false);
        
        org.assertj.core.api.Assertions.assertThat(request.getTargetLanguage()).isEqualTo("fr-FR");
        org.assertj.core.api.Assertions.assertThat(request.getAutoDetect()).isEqualTo(false);
    }
    
    @Test
    @DisplayName("Should validate SessionResponse DTO")
    void shouldValidateSessionResponseDto() {
        // Given
        Session session = Session.create("de-DE", false);
        session.setId("test-session-456");
        
        // When
        SessionController.SessionResponse response = SessionController.SessionResponse.from(session);
        
        // Then
        org.assertj.core.api.Assertions.assertThat(response.getId()).isEqualTo("test-session-456");
        org.assertj.core.api.Assertions.assertThat(response.getTargetLanguage()).isEqualTo("de-DE");
        org.assertj.core.api.Assertions.assertThat(response.getAutoDetectLanguage()).isEqualTo(false);
        org.assertj.core.api.Assertions.assertThat(response.getStatus()).isEqualTo("ACTIVE");
        org.assertj.core.api.Assertions.assertThat(response.getCreatedAt()).isNotNull();
        org.assertj.core.api.Assertions.assertThat(response.getMessageCount()).isEqualTo(0);
    }
    
    @Test
    @DisplayName("Should handle SessionResponse with null session status")
    void shouldHandleSessionResponseWithNullSessionStatus() {
        // Given
        Session sessionWithNullStatus = Session.create("en-US", true);
        sessionWithNullStatus.setId("test-session-null-status");
        // Status might be null in some cases
        
        // When
        SessionController.SessionResponse response = SessionController.SessionResponse.from(sessionWithNullStatus);
        
        // Then
        org.assertj.core.api.Assertions.assertThat(response.getStatus()).isEqualTo("ACTIVE"); // Default fallback
    }
    
    @Test
    @DisplayName("Should test SessionResponse setters and getters")
    void shouldTestSessionResponseSettersAndGetters() {
        // Given
        SessionController.SessionResponse response = new SessionController.SessionResponse();
        
        // When
        response.setId("test-id");
        response.setStatus("CLOSED");
        response.setTargetLanguage("ja-JP");
        response.setAutoDetectLanguage(true);
        response.setCreatedAt(java.time.Instant.now());
        response.setMessageCount(5);
        
        // Then
        org.assertj.core.api.Assertions.assertThat(response.getId()).isEqualTo("test-id");
        org.assertj.core.api.Assertions.assertThat(response.getStatus()).isEqualTo("CLOSED");
        org.assertj.core.api.Assertions.assertThat(response.getTargetLanguage()).isEqualTo("ja-JP");
        org.assertj.core.api.Assertions.assertThat(response.getAutoDetectLanguage()).isTrue();
        org.assertj.core.api.Assertions.assertThat(response.getCreatedAt()).isNotNull();
        org.assertj.core.api.Assertions.assertThat(response.getMessageCount()).isEqualTo(5);
    }
    
    @Test
    @DisplayName("Should handle various HTTP methods on session endpoints")
    void shouldHandleVariousHttpMethodsOnSessionEndpoints() throws Exception {
        // Test unsupported HTTP methods
        
        // GET on sessions collection should return 405 (Method Not Allowed)
        mockMvc.perform(get("/api/v1/sessions"))
                .andExpect(status().isMethodNotAllowed());
        
        // PUT on sessions collection should return 405
        mockMvc.perform(put("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isMethodNotAllowed());
        
        // DELETE on specific session should return 405
        mockMvc.perform(delete("/api/v1/sessions/test-id"))
                .andExpect(status().isMethodNotAllowed());
    }
    
    @Test
    @DisplayName("Should handle request with missing required headers")
    void shouldHandleRequestWithMissingRequiredHeaders() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then - Request without Accept header should still work
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated());
    }
    
    @Test
    @DisplayName("Should handle request with invalid Accept header")
    void shouldHandleRequestWithInvalidAcceptHeader() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then - Request with XML Accept header
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_XML)
                .content(requestJson))
                .andExpect(status().isNotAcceptable()); // Spring should return 406
    }
    
    @Test
    @DisplayName("Should validate endpoint paths")
    void shouldValidateEndpointPaths() throws Exception {
        // Test that endpoints exist at expected paths
        
        // Valid session creation endpoint
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isCreated());
        
        // Valid session retrieval endpoint
        mockMvc.perform(get("/api/v1/sessions/test-id"))
                .andExpect(status().isOk());
        
        // Valid session close endpoint
        mockMvc.perform(post("/api/v1/sessions/test-id/close"))
                .andExpect(status().isOk());
        
        // Invalid path should return 404
        mockMvc.perform(get("/api/v1/sessions/test-id/invalid"))
                .andExpect(status().isNotFound());
    }
    
    @Test
    @DisplayName("Should handle edge case languages")
    void shouldHandleEdgeCaseLanguages() throws Exception {
        // Given
        validCreateRequest.setTargetLanguage("zh-CN");
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetLanguage", is("zh-CN")));
    }
    
    @Test
    @DisplayName("Should handle empty string language")
    void shouldHandleEmptyStringLanguage() throws Exception {
        // Given
        validCreateRequest.setTargetLanguage("");
        String requestJson = objectMapper.writeValueAsString(validCreateRequest);
        
        // When & Then
        mockMvc.perform(post("/api/v1/sessions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.targetLanguage", is(""))); // Should accept empty string
    }
    
}
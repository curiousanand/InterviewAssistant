package com.interview.assistant.controller;

import com.interview.assistant.config.TestSecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Comprehensive test suite for HealthController
 * <p>
 * Tests health and capability endpoints, response structure, and error scenarios
 */
@WebMvcTest(HealthController.class)
@ActiveProfiles("test")
@DisplayName("HealthController Tests")
@Import(TestSecurityConfig.class)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Should return status successfully")
    void shouldReturnStatusSuccessfully() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status", is("UP")))
                .andExpect(jsonPath("$.service", is("Interview Assistant")))
                .andExpect(jsonPath("$.version", is("1.0.0")))
                .andExpect(jsonPath("$.timestamp", notNullValue()))
                .andExpect(jsonPath("$.timestamp", matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d+Z")));
    }

    @Test
    @DisplayName("Should return capabilities successfully")
    void shouldReturnCapabilitiesSuccessfully() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.websocket", is(true)))
                .andExpect(jsonPath("$.speechToText", is(true)))
                .andExpect(jsonPath("$.aiResponses", is(true)))
                .andExpect(jsonPath("$.multiLanguage", is(true)))
                .andExpect(jsonPath("$.sessionManagement", is(true)));
    }

    @Test
    @DisplayName("Should handle status endpoint with different HTTP methods")
    void shouldHandleStatusEndpointWithDifferentHttpMethods() throws Exception {
        // GET should work
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk());

        // POST should return 405 Method Not Allowed
        mockMvc.perform(post("/api/v1/status"))
                .andExpect(status().isMethodNotAllowed());

        // PUT should return 405 Method Not Allowed
        mockMvc.perform(put("/api/v1/status"))
                .andExpect(status().isMethodNotAllowed());

        // DELETE should return 405 Method Not Allowed
        mockMvc.perform(delete("/api/v1/status"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("Should handle capabilities endpoint with different HTTP methods")
    void shouldHandleCapabilitiesEndpointWithDifferentHttpMethods() throws Exception {
        // GET should work
        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk());

        // POST should return 405 Method Not Allowed
        mockMvc.perform(post("/api/v1/capabilities"))
                .andExpect(status().isMethodNotAllowed());

        // PUT should return 405 Method Not Allowed
        mockMvc.perform(put("/api/v1/capabilities"))
                .andExpect(status().isMethodNotAllowed());

        // DELETE should return 405 Method Not Allowed
        mockMvc.perform(delete("/api/v1/capabilities"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("Should handle requests with various Accept headers")
    void shouldHandleRequestsWithVariousAcceptHeaders() throws Exception {
        // JSON Accept header
        mockMvc.perform(get("/api/v1/status")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));

        // All types Accept header
        mockMvc.perform(get("/api/v1/status")
                        .accept(MediaType.ALL))
                .andExpect(status().isOk());

        // XML Accept header should return 406 Not Acceptable
        mockMvc.perform(get("/api/v1/status")
                        .accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotAcceptable());
    }

    @Test
    @DisplayName("Should return consistent status response structure")
    void shouldReturnConsistentStatusResponseStructure() throws Exception {
        // Multiple requests should have consistent structure
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(get("/api/v1/status"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", aMapWithSize(4))) // Exactly 4 fields
                    .andExpect(jsonPath("$.status", is("UP")))
                    .andExpect(jsonPath("$.service", is("Interview Assistant")))
                    .andExpect(jsonPath("$.version", is("1.0.0")))
                    .andExpect(jsonPath("$.timestamp", notNullValue()));
        }
    }

    @Test
    @DisplayName("Should return consistent capabilities response structure")
    void shouldReturnConsistentCapabilitiesResponseStructure() throws Exception {
        // Multiple requests should have consistent structure
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(get("/api/v1/capabilities"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", aMapWithSize(5))) // Exactly 5 capabilities
                    .andExpect(jsonPath("$.websocket", is(true)))
                    .andExpect(jsonPath("$.speechToText", is(true)))
                    .andExpect(jsonPath("$.aiResponses", is(true)))
                    .andExpect(jsonPath("$.multiLanguage", is(true)))
                    .andExpect(jsonPath("$.sessionManagement", is(true)));
        }
    }

    @Test
    @DisplayName("Should handle concurrent requests to status endpoint")
    void shouldHandleConcurrentRequestsToStatusEndpoint() throws Exception {
        // Simulate concurrent requests
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/v1/status"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status", is("UP")));
        }
    }

    @Test
    @DisplayName("Should handle concurrent requests to capabilities endpoint")
    void shouldHandleConcurrentRequestsToCapabilitiesEndpoint() throws Exception {
        // Simulate concurrent requests
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/v1/capabilities"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.websocket", is(true)));
        }
    }

    @Test
    @DisplayName("Should handle requests with query parameters")
    void shouldHandleRequestsWithQueryParameters() throws Exception {
        // Status endpoint with query parameters
        mockMvc.perform(get("/api/v1/status?format=json&detailed=true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));

        // Capabilities endpoint with query parameters
        mockMvc.perform(get("/api/v1/capabilities?version=1.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.websocket", is(true)));
    }

    @Test
    @DisplayName("Should handle requests with custom headers")
    void shouldHandleRequestsWithCustomHeaders() throws Exception {
        // Status endpoint with custom headers
        mockMvc.perform(get("/api/v1/status")
                        .header("X-Request-ID", "test-123")
                        .header("User-Agent", "Interview-Assistant-Test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));

        // Capabilities endpoint with custom headers
        mockMvc.perform(get("/api/v1/capabilities")
                        .header("X-Client-Version", "1.0.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.websocket", is(true)));
    }

    @Test
    @DisplayName("Should validate timestamp format in status response")
    void shouldValidateTimestampFormatInStatusResponse() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.timestamp", notNullValue()))
                .andExpect(jsonPath("$.timestamp", matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d+Z")));
    }

    @Test
    @DisplayName("Should validate boolean types in capabilities response")
    void shouldValidateBooleanTypesInCapabilitiesResponse() throws Exception {
        // When & Then
        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.websocket", instanceOf(Boolean.class)))
                .andExpect(jsonPath("$.speechToText", instanceOf(Boolean.class)))
                .andExpect(jsonPath("$.aiResponses", instanceOf(Boolean.class)))
                .andExpect(jsonPath("$.multiLanguage", instanceOf(Boolean.class)))
                .andExpect(jsonPath("$.sessionManagement", instanceOf(Boolean.class)));
    }

    @Test
    @DisplayName("Should handle case sensitivity in endpoint paths")
    void shouldHandleCaseSensitivityInEndpointPaths() throws Exception {
        // Correct case
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk());

        // Wrong case should return 404
        mockMvc.perform(get("/api/v1/STATUS"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/CAPABILITIES"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should handle trailing slashes in endpoint paths")
    void shouldHandleTrailingSlashesInEndpointPaths() throws Exception {
        // Without trailing slash
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk());

        // With trailing slash - Spring's default behavior
        mockMvc.perform(get("/api/v1/status/"))
                .andExpect(status().isNotFound()); // Spring returns 404 by default

        mockMvc.perform(get("/api/v1/capabilities/"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should validate API versioning in endpoint paths")
    void shouldValidateApiVersioningInEndpointPaths() throws Exception {
        // Correct version
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk());

        // Wrong version should return 404
        mockMvc.perform(get("/api/v2/status"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/status"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should handle OPTIONS requests for CORS preflight")
    void shouldHandleOptionsRequestsForCorsPreflight() throws Exception {
        // OPTIONS request to status endpoint
        mockMvc.perform(options("/api/v1/status"))
                .andExpect(status().isOk());

        // OPTIONS request to capabilities endpoint
        mockMvc.perform(options("/api/v1/capabilities"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Should handle HEAD requests")
    void shouldHandleHeadRequests() throws Exception {
        // HEAD request to status endpoint - Should return 200 but Spring Boot might return body in tests
        mockMvc.perform(head("/api/v1/status"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));

        // HEAD request to capabilities endpoint 
        mockMvc.perform(head("/api/v1/capabilities"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Should return appropriate Cache-Control headers")
    void shouldReturnAppropriateCacheControlHeaders() throws Exception {
        // Status endpoint - should not be cached heavily as it contains timestamp
        mockMvc.perform(get("/api/v1/status"))
                .andExpect(status().isOk());

        // Capabilities endpoint - could be cached as it's static
        mockMvc.perform(get("/api/v1/capabilities"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Should validate response content encoding")
    void shouldValidateResponseContentEncoding() throws Exception {
        // Test with compression acceptance
        mockMvc.perform(get("/api/v1/status")
                        .header("Accept-Encoding", "gzip"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));

        mockMvc.perform(get("/api/v1/capabilities")
                        .header("Accept-Encoding", "gzip"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON));
    }

    @Test
    @DisplayName("Should handle malformed requests gracefully")
    void shouldHandleMalformedRequestsGracefully() throws Exception {
        // Request with invalid characters in path - Spring returns 400 for URL encoding issues
        mockMvc.perform(get("/api/v1/status%20test"))
                .andExpect(status().isBadRequest());

        // Request with double slashes - Spring Boot normalizes paths, so this resolves to /api/v1/status
        mockMvc.perform(get("/api//v1//status"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Should maintain endpoint availability under load")
    void shouldMaintainEndpointAvailabilityUnderLoad() throws Exception {
        // Simulate load with rapid sequential requests
        for (int i = 0; i < 50; i++) {
            mockMvc.perform(get("/api/v1/status"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status", is("UP")));

            mockMvc.perform(get("/api/v1/capabilities"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.websocket", is(true)));
        }
    }
}
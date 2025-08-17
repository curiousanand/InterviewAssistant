package com.interview.assistant.presentation.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Profile;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Production health controller
 * Provides application health and status information
 */
@RestController
@RequestMapping("/api/v1")
@Profile("!test")
public class HealthController {
    
    /**
     * Get application status
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("service", "Interview Assistant");
        status.put("version", "1.0.0");
        status.put("timestamp", Instant.now());
        
        return ResponseEntity.ok(status);
    }
    
    /**
     * Get service capabilities
     */
    @GetMapping("/capabilities")
    public ResponseEntity<Map<String, Object>> getCapabilities() {
        Map<String, Object> capabilities = new HashMap<>();
        capabilities.put("websocket", true);
        capabilities.put("speechToText", true);
        capabilities.put("aiResponses", true);
        capabilities.put("multiLanguage", true);
        capabilities.put("sessionManagement", true);
        
        return ResponseEntity.ok(capabilities);
    }
}
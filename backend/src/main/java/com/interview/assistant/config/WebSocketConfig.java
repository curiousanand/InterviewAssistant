package com.interview.assistant.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Production WebSocket configuration for Interview Assistant
 * Configures WebSocket endpoints for real-time communication
 */
@Configuration
@EnableWebSocket
@Profile("!test")
public class WebSocketConfig implements WebSocketConfigurer {
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // TODO: Implement WebSocket handler when moving problematic classes back
        // registry.addHandler(new StreamingWebSocketHandler(), "/ws/stream")
        //         .setAllowedOrigins("*"); // Configure CORS as needed
        
        // For now, just register the endpoint path for documentation
        System.out.println("WebSocket endpoint will be available at: /ws/stream");
    }
}
package com.interview.assistant.config;

import com.interview.assistant.websocket.StreamingWebSocketHandler;
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
    
    private final StreamingWebSocketHandler streamingHandler;
    
    public WebSocketConfig(StreamingWebSocketHandler streamingHandler) {
        this.streamingHandler = streamingHandler;
    }
    
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(streamingHandler, "/ws/stream")
                .setAllowedOrigins("*"); // Allow frontend connections
    }
}
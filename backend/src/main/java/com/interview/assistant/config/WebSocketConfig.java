package com.interview.assistant.config;

import com.interview.assistant.websocket.RealTimeWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Production WebSocket configuration for Interview Assistant
 * Configures WebSocket endpoints for real-time multimodal conversation
 * 
 * Uses the enhanced RealTimeWebSocketHandler with full orchestration:
 * - Voice Activity Detection
 * - Dual-buffer transcript management
 * - Smart pause detection  
 * - AI response interruption
 * - Streaming AI responses
 */
@Configuration
@EnableWebSocket
@Profile("!test")
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealTimeWebSocketHandler realTimeHandler;

    public WebSocketConfig(RealTimeWebSocketHandler realTimeHandler) {
        this.realTimeHandler = realTimeHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Main real-time conversation endpoint
        registry.addHandler(realTimeHandler, "/ws/stream")
                .setAllowedOrigins("*"); // Allow frontend connections
    }
}
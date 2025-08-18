package com.interview.assistant.config;

import com.interview.assistant.websocket.StreamingWebSocketHandler;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Test WebSocket configuration for integration tests
 */
@TestConfiguration
@EnableWebSocket
@Profile("test")
public class TestWebSocketConfig implements WebSocketConfigurer {

    private final StreamingWebSocketHandler streamingHandler;

    public TestWebSocketConfig(StreamingWebSocketHandler streamingHandler) {
        this.streamingHandler = streamingHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(streamingHandler, "/ws/stream")
                .setAllowedOrigins("*");
    }
}
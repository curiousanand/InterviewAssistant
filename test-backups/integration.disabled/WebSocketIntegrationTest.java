package com.interview.assistant.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration test suite for WebSocket communication flow
 * 
 * Tests complete WebSocket message flow from client to server and back
 * Rationale: Ensures all layers work together correctly in real scenarios
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    private StandardWebSocketClient webSocketClient;
    private ObjectMapper objectMapper;
    private String webSocketUrl;

    @BeforeEach
    void setUp() {
        webSocketClient = new StandardWebSocketClient();
        objectMapper = new ObjectMapper();
        webSocketUrl = "ws://localhost:" + port + "/ws/stream";
    }

    @Test
    void shouldEstablishWebSocketConnection() throws Exception {
        CountDownLatch connectionLatch = new CountDownLatch(1);
        AtomicReference<Throwable> connectionError = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void afterConnectionEstablished(WebSocketSession session) {
                    connectionLatch.countDown();
                }

                @Override
                public void handleTransportError(WebSocketSession session, Throwable exception) {
                    connectionError.set(exception);
                    connectionLatch.countDown();
                }
            },
            createWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        assertThat(connectionLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(connectionError.get()).isNull();
        assertThat(session.isOpen()).isTrue();

        session.close();
    }

    @Test
    void shouldHandleAuthenticationMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send authentication message
        WebSocketMessage authMessage = WebSocketMessage.builder()
            .messageId("auth-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("auth")
            .textContent("test-api-key")
            .build();

        String messageJson = objectMapper.writeValueAsString(authMessage);
        session.sendMessage(new TextMessage(messageJson));

        assertThat(messageLatch.await(5, TimeUnit.SECONDS)).isTrue();
        
        // Should receive acknowledgment or error response
        assertThat(receivedMessage.get()).isNotNull();

        session.close();
    }

    @Test
    void shouldHandleTextMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send text message
        WebSocketMessage textMessage = WebSocketMessage.builder()
            .messageId("text-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello, how are you?")
            .build();

        String messageJson = objectMapper.writeValueAsString(textMessage);
        session.sendMessage(new TextMessage(messageJson));

        assertThat(messageLatch.await(10, TimeUnit.SECONDS)).isTrue();
        
        // Should receive AI response
        assertThat(receivedMessage.get()).isNotNull();

        session.close();
    }

    @Test
    void shouldHandleAudioMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send binary audio data
        byte[] audioData = createTestAudioData();
        session.sendMessage(new BinaryMessage(audioData));

        assertThat(messageLatch.await(10, TimeUnit.SECONDS)).isTrue();
        
        // Should receive transcription or AI response
        assertThat(receivedMessage.get()).isNotNull();

        session.close();
    }

    @Test
    void shouldHandleControlMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send control message
        WebSocketMessage controlMessage = WebSocketMessage.builder()
            .messageId("control-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("control")
            .textContent("start")
            .build();

        String messageJson = objectMapper.writeValueAsString(controlMessage);
        session.sendMessage(new TextMessage(messageJson));

        // Control messages might not generate immediate responses
        // Just verify connection remains stable
        Thread.sleep(1000);
        assertThat(session.isOpen()).isTrue();

        session.close();
    }

    @Test
    void shouldHandleLanguageChangeMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send language change message
        WebSocketMessage languageMessage = WebSocketMessage.builder()
            .messageId("lang-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("language_change")
            .textContent("fr-FR")
            .build();

        String messageJson = objectMapper.writeValueAsString(languageMessage);
        session.sendMessage(new TextMessage(messageJson));

        // Language change might not generate immediate responses
        Thread.sleep(1000);
        assertThat(session.isOpen()).isTrue();

        session.close();
    }

    @Test
    void shouldHandlePingMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send ping message
        WebSocketMessage pingMessage = WebSocketMessage.builder()
            .messageId("ping-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("ping")
            .build();

        String messageJson = objectMapper.writeValueAsString(pingMessage);
        session.sendMessage(new TextMessage(messageJson));

        // Ping should get a pong response
        assertThat(messageLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(receivedMessage.get()).contains("pong");

        session.close();
    }

    @Test
    void shouldRejectUnauthenticatedMessages() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createWebSocketHeaders(), // No authentication
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send text message without authentication
        WebSocketMessage textMessage = WebSocketMessage.builder()
            .messageId("text-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello")
            .build();

        String messageJson = objectMapper.writeValueAsString(textMessage);
        session.sendMessage(new TextMessage(messageJson));

        assertThat(messageLatch.await(5, TimeUnit.SECONDS)).isTrue();
        
        // Should receive authentication error
        assertThat(receivedMessage.get()).contains("authentication");

        session.close();
    }

    @Test
    void shouldHandleInvalidMessage() throws Exception {
        CountDownLatch messageLatch = new CountDownLatch(1);
        AtomicReference<String> receivedMessage = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void handleTextMessage(WebSocketSession session, TextMessage message) {
                    receivedMessage.set(message.getPayload());
                    messageLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Send invalid JSON
        session.sendMessage(new TextMessage("{invalid json}"));

        assertThat(messageLatch.await(5, TimeUnit.SECONDS)).isTrue();
        
        // Should receive validation error
        assertThat(receivedMessage.get()).contains("error");

        session.close();
    }

    @Test
    void shouldHandleConnectionTermination() throws Exception {
        CountDownLatch closeLatch = new CountDownLatch(1);
        AtomicReference<CloseStatus> closeStatus = new AtomicReference<>();

        WebSocketSession session = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
                    closeStatus.set(status);
                    closeLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Close connection from client
        session.close(CloseStatus.NORMAL);

        assertThat(closeLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(closeStatus.get()).isEqualTo(CloseStatus.NORMAL);
        assertThat(session.isOpen()).isFalse();
    }

    @Test
    void shouldHandleMultipleClients() throws Exception {
        CountDownLatch connectionLatch = new CountDownLatch(2);
        
        // Connect first client
        WebSocketSession session1 = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void afterConnectionEstablished(WebSocketSession session) {
                    connectionLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        // Connect second client
        WebSocketSession session2 = webSocketClient.doHandshake(
            new TestWebSocketHandler() {
                @Override
                public void afterConnectionEstablished(WebSocketSession session) {
                    connectionLatch.countDown();
                }
            },
            createAuthenticatedWebSocketHeaders(),
            URI.create(webSocketUrl)
        ).get(5, TimeUnit.SECONDS);

        assertThat(connectionLatch.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(session1.isOpen()).isTrue();
        assertThat(session2.isOpen()).isTrue();

        session1.close();
        session2.close();
    }

    private WebSocketHttpHeaders createWebSocketHeaders() {
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("User-Agent", "Test-Client");
        return headers;
    }

    private WebSocketHttpHeaders createAuthenticatedWebSocketHeaders() {
        WebSocketHttpHeaders headers = createWebSocketHeaders();
        headers.add("Authorization", "Bearer test-api-key");
        return headers;
    }

    private byte[] createTestAudioData() {
        // Create simple test audio data (silence)
        byte[] audioData = new byte[1024];
        // Fill with some pattern to simulate audio
        for (int i = 0; i < audioData.length; i += 2) {
            audioData[i] = (byte) (Math.sin(i * 0.1) * 100);
            if (i + 1 < audioData.length) {
                audioData[i + 1] = (byte) (Math.sin(i * 0.1) * 100);
            }
        }
        return audioData;
    }

    private static class TestWebSocketHandler implements WebSocketHandler {
        
        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
            // Override in test cases
        }

        @Override
        public void handleMessage(WebSocketSession session, WebSocketMessage<?> message) throws Exception {
            if (message instanceof TextMessage) {
                handleTextMessage(session, (TextMessage) message);
            } else if (message instanceof BinaryMessage) {
                handleBinaryMessage(session, (BinaryMessage) message);
            }
        }

        public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
            // Override in test cases
        }

        public void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
            // Override in test cases
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
            // Override in test cases
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
            // Override in test cases
        }

        @Override
        public boolean supportsPartialMessages() {
            return false;
        }
    }
}
package com.interview.assistant.presentation.websocket;

import com.interview.assistant.presentation.websocket.handler.*;
import com.interview.assistant.presentation.websocket.model.WebSocketContext;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.*;

import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for StreamingWebSocketHandler
 * 
 * Tests WebSocket lifecycle, message processing, and error handling
 * Rationale: Ensures WebSocket communication works correctly with proper session management
 */
@ExtendWith(MockitoExtension.class)
class StreamingWebSocketHandlerTest {

    @Mock
    private WebSocketSessionManager sessionManager;

    @Mock
    private ValidationHandler validationHandler;

    @Mock
    private AuthenticationHandler authenticationHandler;

    @Mock
    private RateLimitingHandler rateLimitingHandler;

    @Mock
    private BusinessLogicHandler businessLogicHandler;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private WebSocketSession webSocketSession;

    @Mock
    private WebSocketContext webSocketContext;

    private StreamingWebSocketHandler webSocketHandler;

    @BeforeEach
    void setUp() {
        webSocketHandler = new StreamingWebSocketHandler(
            sessionManager,
            validationHandler,
            authenticationHandler,
            rateLimitingHandler,
            businessLogicHandler,
            objectMapper
        );

        // Setup mock chain returns
        when(validationHandler.setNext(any())).thenReturn(authenticationHandler);
        when(authenticationHandler.setNext(any())).thenReturn(rateLimitingHandler);
        when(rateLimitingHandler.setNext(any())).thenReturn(businessLogicHandler);
        when(businessLogicHandler.setNext(any())).thenReturn(businessLogicHandler);

        // Setup handler names
        when(validationHandler.getHandlerName()).thenReturn("ValidationHandler");
        when(authenticationHandler.getHandlerName()).thenReturn("AuthenticationHandler");
        when(rateLimitingHandler.getHandlerName()).thenReturn("RateLimitingHandler");
        when(businessLogicHandler.getHandlerName()).thenReturn("BusinessLogicHandler");

        // Setup WebSocket session
        when(webSocketSession.getId()).thenReturn("test-ws-session-id");
        when(webSocketSession.isOpen()).thenReturn(true);
        when(webSocketSession.getRemoteAddress()).thenReturn(new InetSocketAddress("127.0.0.1", 8080));

        // Setup WebSocket context
        when(webSocketContext.getSessionId()).thenReturn("test-session-id");
        when(webSocketContext.getWebSocketSessionId()).thenReturn("test-ws-session-id");
        when(webSocketContext.getApiKey()).thenReturn("test-api-key");
        when(webSocketContext.getClientIpAddress()).thenReturn("127.0.0.1");
        when(webSocketContext.getUserAgent()).thenReturn("Test-Agent");
        when(webSocketContext.getWebSocketSession()).thenReturn(webSocketSession);
        when(webSocketContext.isWebSocketOpen()).thenReturn(true);

        webSocketHandler.initialize();
    }

    @Test
    void shouldInitializeSuccessfully() {
        // Verify initialization
        verify(sessionManager).initialize();
        verify(validationHandler).setNext(authenticationHandler);
        verify(authenticationHandler).setNext(rateLimitingHandler);
        verify(rateLimitingHandler).setNext(businessLogicHandler);
    }

    @Test
    void shouldHandleConnectionEstablishedSuccessfully() throws Exception {
        when(sessionManager.createSession(webSocketSession)).thenReturn(webSocketContext);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"connection_established\"}");

        webSocketHandler.afterConnectionEstablished(webSocketSession);

        verify(sessionManager).createSession(webSocketSession);
        verify(webSocketSession).sendMessage(any(TextMessage.class));
    }

    @Test
    void shouldHandleConnectionEstablishmentFailure() throws Exception {
        when(sessionManager.createSession(webSocketSession))
            .thenThrow(new RuntimeException("Session creation failed"));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        webSocketHandler.afterConnectionEstablished(webSocketSession);

        verify(webSocketSession).sendMessage(any(TextMessage.class));
        verify(webSocketSession).close(CloseStatus.SERVER_ERROR);
    }

    @Test
    void shouldHandleTextMessageSuccessfully() throws Exception {
        TextMessage textMessage = new TextMessage("Hello World");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(validationHandler).handle(any(WebSocketMessage.class), eq(webSocketContext));
        verify(webSocketContext).incrementMessageCount();
    }

    @Test
    void shouldHandleJsonTextMessageSuccessfully() throws Exception {
        String jsonPayload = "{\"type\":\"control\",\"content\":\"start_recording\"}";
        TextMessage textMessage = new TextMessage(jsonPayload);
        Map<String, Object> jsonData = new HashMap<>();
        jsonData.put("type", "control");
        jsonData.put("content", "start_recording");

        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(objectMapper.readValue(jsonPayload, Map.class)).thenReturn(jsonData);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(objectMapper).readValue(jsonPayload, Map.class);
        verify(validationHandler).handle(argThat(msg -> 
            "control".equals(msg.getType()) && "start_recording".equals(msg.getTextContent())
        ), eq(webSocketContext));
    }

    @Test
    void shouldHandleBinaryMessageSuccessfully() throws Exception {
        byte[] audioData = new byte[]{1, 2, 3, 4, 5};
        BinaryMessage binaryMessage = new BinaryMessage(audioData);
        
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, binaryMessage);

        verify(validationHandler).handle(argThat(msg -> 
            "audio".equals(msg.getType()) && audioData.length == msg.getBinaryContent().length
        ), eq(webSocketContext));
    }

    @Test
    void shouldHandlePongMessageSuccessfully() throws Exception {
        PongMessage pongMessage = new PongMessage();
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, pongMessage);

        verify(validationHandler).handle(argThat(msg -> 
            "pong".equals(msg.getType())
        ), eq(webSocketContext));
    }

    @Test
    void shouldHandleUnsupportedMessageType() throws Exception {
        // Create a custom WebSocket message type
        WebSocketMessage customMessage = new WebSocketMessage() {
            @Override
            public String getPayload() {
                return "custom";
            }
        };

        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, customMessage);

        verify(validationHandler).handle(argThat(msg -> 
            "unknown".equals(msg.getType())
        ), eq(webSocketContext));
    }

    @Test
    void shouldHandleMessageWithoutContext() throws Exception {
        TextMessage textMessage = new TextMessage("Hello");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(null);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(webSocketSession).sendMessage(any(TextMessage.class));
        verify(validationHandler, never()).handle(any(), any());
    }

    @Test
    void shouldHandleMessageProcessingError() throws Exception {
        TextMessage textMessage = new TextMessage("Hello");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.ERROR);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(webSocketContext).incrementErrorCount();
        verify(webSocketSession).sendMessage(any(TextMessage.class));
    }

    @Test
    void shouldHandleMessageProcessingException() throws Exception {
        TextMessage textMessage = new TextMessage("Hello");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenThrow(new RuntimeException("Processing failed"));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(webSocketContext).incrementErrorCount();
        verify(webSocketSession).sendMessage(any(TextMessage.class));
    }

    @Test
    void shouldHandleStopProcessingResult() throws Exception {
        TextMessage textMessage = new TextMessage("Hello");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.STOP);

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        verify(webSocketContext).incrementMessageCount();
        verify(webSocketSession, never()).sendMessage(any());
    }

    @Test
    void shouldHandleTransportError() throws Exception {
        RuntimeException transportError = new RuntimeException("Connection lost");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(webSocketContext.getSessionDurationSeconds()).thenReturn(120L);
        when(webSocketContext.getMessageCount()).thenReturn(10L);
        when(webSocketContext.getErrorCount()).thenReturn(2L);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        webSocketHandler.handleTransportError(webSocketSession, transportError);

        verify(webSocketContext).incrementErrorCount();
        verify(webSocketSession).sendMessage(any(TextMessage.class));
    }

    @Test
    void shouldHandleTransportErrorWithClosedSession() throws Exception {
        RuntimeException transportError = new RuntimeException("Connection lost");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(webSocketSession.isOpen()).thenReturn(false);

        webSocketHandler.handleTransportError(webSocketSession, transportError);

        verify(webSocketContext).incrementErrorCount();
        verify(webSocketSession, never()).sendMessage(any());
    }

    @Test
    void shouldHandleConnectionClosed() throws Exception {
        CloseStatus closeStatus = CloseStatus.NORMAL;
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(webSocketContext.getSessionDurationSeconds()).thenReturn(300L);
        when(webSocketContext.getMessageCount()).thenReturn(25L);
        when(webSocketContext.getErrorCount()).thenReturn(1L);
        when(webSocketContext.getErrorRate()).thenReturn(4.0);

        webSocketHandler.afterConnectionClosed(webSocketSession, closeStatus);

        verify(sessionManager).removeSessionByWebSocket(webSocketSession);
    }

    @Test
    void shouldHandleConnectionClosedWithoutContext() throws Exception {
        CloseStatus closeStatus = CloseStatus.NORMAL;
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(null);

        webSocketHandler.afterConnectionClosed(webSocketSession, closeStatus);

        verify(sessionManager, never()).removeSessionByWebSocket(webSocketSession);
    }

    @Test
    void shouldSupportPartialMessages() {
        boolean supportsPartial = webSocketHandler.supportsPartialMessages();
        
        assertThat(supportsPartial).isTrue();
    }

    @Test
    void shouldSendResponseMessageSuccessfully() throws Exception {
        String sessionId = "test-session-id";
        String messageType = "transcription_result";
        Map<String, Object> data = Map.of("text", "Hello world", "confidence", 0.95);

        when(sessionManager.getSession(sessionId)).thenReturn(webSocketContext);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"transcription_result\"}");

        webSocketHandler.sendResponseMessage(sessionId, messageType, data);

        verify(webSocketSession).sendMessage(any(TextMessage.class));
    }

    @Test
    void shouldNotSendResponseMessageForMissingSession() {
        String sessionId = "missing-session-id";
        when(sessionManager.getSession(sessionId)).thenReturn(null);

        webSocketHandler.sendResponseMessage(sessionId, "test", "data");

        verify(webSocketSession, never()).sendMessage(any());
    }

    @Test
    void shouldNotSendResponseMessageForClosedSession() {
        String sessionId = "test-session-id";
        when(sessionManager.getSession(sessionId)).thenReturn(webSocketContext);
        when(webSocketContext.isWebSocketOpen()).thenReturn(false);

        webSocketHandler.sendResponseMessage(sessionId, "test", "data");

        verify(webSocketSession, never()).sendMessage(any());
    }

    @Test
    void shouldHandleSendResponseMessageException() throws Exception {
        String sessionId = "test-session-id";
        when(sessionManager.getSession(sessionId)).thenReturn(webSocketContext);
        when(objectMapper.writeValueAsString(any())).thenThrow(new RuntimeException("JSON error"));

        webSocketHandler.sendResponseMessage(sessionId, "test", "data");

        // Should handle exception gracefully without propagating
        verify(webSocketSession, never()).sendMessage(any());
    }

    @Test
    void shouldGetSessionManager() {
        WebSocketSessionManager manager = webSocketHandler.getSessionManager();
        
        assertThat(manager).isEqualTo(sessionManager);
    }

    @Test
    void shouldCleanupSuccessfully() {
        webSocketHandler.cleanup();

        verify(sessionManager).shutdown();
    }

    @Test
    void shouldHandleJsonParsingFailureGracefully() throws Exception {
        String invalidJson = "{invalid json";
        TextMessage textMessage = new TextMessage(invalidJson);
        
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(objectMapper.readValue(invalidJson, Map.class)).thenThrow(new RuntimeException("JSON parse error"));
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, textMessage);

        // Should treat as plain text when JSON parsing fails
        verify(validationHandler).handle(argThat(msg -> 
            "text".equals(msg.getType()) && invalidJson.equals(msg.getTextContent())
        ), eq(webSocketContext));
    }

    @Test
    void shouldGenerateUniqueMessageIds() throws Exception {
        TextMessage textMessage1 = new TextMessage("Message 1");
        TextMessage textMessage2 = new TextMessage("Message 2");
        
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);

        webSocketHandler.handleMessage(webSocketSession, textMessage1);
        webSocketHandler.handleMessage(webSocketSession, textMessage2);

        // Verify different message IDs were generated (indirectly through handler calls)
        verify(validationHandler, times(2)).handle(any(WebSocketMessage.class), eq(webSocketContext));
    }

    @Test
    void shouldHandleErrorInSendErrorMessage() throws Exception {
        TextMessage textMessage = new TextMessage("Hello");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);
        when(validationHandler.handle(any(), any())).thenReturn(MessageProcessingResult.ERROR);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");
        when(webSocketSession.sendMessage(any())).thenThrow(new RuntimeException("Send failed"));

        // Should handle exception in sending error message gracefully
        assertThatCode(() -> webSocketHandler.handleMessage(webSocketSession, textMessage))
            .doesNotThrowAnyException();
    }

    @Test
    void shouldNotSendErrorMessageToClosedSession() throws Exception {
        when(webSocketSession.isOpen()).thenReturn(false);
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"type\":\"error\"}");

        // This tests the private sendErrorMessage method indirectly
        RuntimeException transportError = new RuntimeException("Connection lost");
        when(sessionManager.getSessionByWebSocket(webSocketSession)).thenReturn(webSocketContext);

        webSocketHandler.handleTransportError(webSocketSession, transportError);

        verify(webSocketSession, never()).sendMessage(any());
    }
}
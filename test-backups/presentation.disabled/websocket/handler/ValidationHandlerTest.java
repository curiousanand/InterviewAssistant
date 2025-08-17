package com.interview.assistant.presentation.websocket.handler;

import com.interview.assistant.presentation.websocket.model.WebSocketContext;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for ValidationHandler
 * 
 * Tests message validation logic, structure validation, and content validation
 * Rationale: Ensures only valid messages are processed by downstream handlers
 */
@ExtendWith(MockitoExtension.class)
class ValidationHandlerTest {

    @Mock
    private IMessageHandler nextHandler;

    @Mock
    private WebSocketContext webSocketContext;

    private ValidationHandler validationHandler;

    @BeforeEach
    void setUp() {
        validationHandler = new ValidationHandler();
        validationHandler.setNext(nextHandler);

        when(webSocketContext.getSessionId()).thenReturn("test-session-id");
        when(nextHandler.handle(any(), any())).thenReturn(MessageProcessingResult.CONTINUE);
    }

    @Test
    void shouldValidateValidTextMessageSuccessfully() {
        WebSocketMessage message = createValidTextMessage("Hello world");

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldValidateValidAudioMessageSuccessfully() {
        WebSocketMessage message = createValidAudioMessage(new byte[1024]);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldValidateControlMessageSuccessfully() {
        WebSocketMessage message = createValidControlMessage("start_recording");

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldRejectMessageWithNullType() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type(null)
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Message type cannot be null or empty");
    }

    @Test
    void shouldRejectMessageWithEmptyType() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("")
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Message type cannot be null or empty");
    }

    @Test
    void shouldRejectMessageWithInvalidType() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("invalid_type")
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Unsupported message type");
    }

    @Test
    void shouldRejectMessageWithNullMessageId() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId(null)
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Message ID cannot be null or empty");
    }

    @Test
    void shouldRejectMessageWithNullSessionId() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId(null)
            .type("text")
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Session ID cannot be null or empty");
    }

    @Test
    void shouldRejectMessageWithNullTimestamp() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(null)
            .sessionId("test-session")
            .type("text")
            .textContent("Hello")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Message timestamp cannot be null");
    }

    @Test
    void shouldRejectTooLargeMessage() {
        // Create a message that exceeds the size limit
        byte[] largeAudioData = new byte[11 * 1024 * 1024]; // 11MB > 10MB limit
        WebSocketMessage message = createValidAudioMessage(largeAudioData);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Message size exceeds maximum limit");
    }

    @Test
    void shouldRejectTextMessageWithTooLongContent() {
        String longText = "a".repeat(100_001); // Exceeds 100K limit
        WebSocketMessage message = createValidTextMessage(longText);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Text content exceeds maximum length");
    }

    @Test
    void shouldRejectTextMessageWithNullContent() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent(null)
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Text content cannot be null or empty");
    }

    @Test
    void shouldRejectTextMessageWithEmptyContent() {
        WebSocketMessage message = createValidTextMessage("");

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Text content cannot be null or empty");
    }

    @Test
    void shouldRejectAudioMessageWithNullContent() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("audio")
            .binaryContent(null)
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Audio data cannot be null or empty");
    }

    @Test
    void shouldRejectAudioMessageWithEmptyContent() {
        WebSocketMessage message = createValidAudioMessage(new byte[0]);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Audio data cannot be null or empty");
    }

    @Test
    void shouldRejectControlMessageWithNullContent() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("control")
            .textContent(null)
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Control message content cannot be null or empty");
    }

    @Test
    void shouldAcceptPingMessageWithoutContent() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("ping")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldAcceptLanguageChangeMessage() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("language_change")
            .textContent("en-US")
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldValidateMaximumAllowedTextLength() {
        String maxLengthText = "a".repeat(100_000); // Exactly at the limit
        WebSocketMessage message = createValidTextMessage(maxLengthText);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldValidateMaximumAllowedMessageSize() {
        byte[] maxSizeAudioData = new byte[10 * 1024 * 1024]; // Exactly at 10MB limit
        WebSocketMessage message = createValidAudioMessage(maxSizeAudioData);

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldHandleValidationException() {
        WebSocketMessage message = createValidTextMessage("Hello");
        
        // Simulate validation exception
        doThrow(new RuntimeException("Validation error")).when(webSocketContext).incrementErrorCount();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(nextHandler, never()).handle(any(), any());
        assertThat(message.getProcessingError()).contains("Validation failed");
    }

    @Test
    void shouldReturnCorrectHandlerName() {
        String handlerName = validationHandler.getHandlerName();
        
        assertThat(handlerName).isEqualTo("ValidationHandler");
    }

    @Test
    void shouldReturnCorrectPriority() {
        int priority = validationHandler.getPriority();
        
        assertThat(priority).isEqualTo(10); // ValidationHandler should have high priority
    }

    @Test
    void shouldHandleAllSupportedMessageTypes() {
        String[] supportedTypes = {"audio", "text", "control", "ping", "language_change"};
        
        for (String type : supportedTypes) {
            boolean canHandle = validationHandler.canHandle(type);
            assertThat(canHandle).isTrue();
        }
    }

    @Test
    void shouldNotHandleUnsupportedMessageTypes() {
        String[] unsupportedTypes = {"video", "file", "image", "unknown"};
        
        for (String type : unsupportedTypes) {
            boolean canHandle = validationHandler.canHandle(type);
            assertThat(canHandle).isFalse();
        }
    }

    @Test
    void shouldSetNextHandlerCorrectly() {
        IMessageHandler newNextHandler = mock(IMessageHandler.class);
        
        IMessageHandler returnedHandler = validationHandler.setNext(newNextHandler);
        
        assertThat(returnedHandler).isEqualTo(newNextHandler);
    }

    @Test
    void shouldHandleMessageWithMetadata() {
        Map<String, Object> metadata = Map.of(
            "language", "en-US",
            "confidence", 0.95,
            "audioFormat", "wav"
        );
        
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello world")
            .metadata(metadata)
            .build();

        MessageProcessingResult result = validationHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(nextHandler).handle(message, webSocketContext);
    }

    @Test
    void shouldCalculateMessageSizeCorrectly() {
        String textContent = "Hello world";
        byte[] binaryContent = new byte[1024];
        Map<String, Object> metadata = Map.of("key", "value");
        
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent(textContent)
            .binaryContent(binaryContent)
            .metadata(metadata)
            .build();

        // The message size calculation should include text, binary, and metadata
        assertThat(message.getMessageSize()).isGreaterThan(0);
    }

    private WebSocketMessage createValidTextMessage(String content) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent(content)
            .build();
    }

    private WebSocketMessage createValidAudioMessage(byte[] audioData) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("audio")
            .binaryContent(audioData)
            .build();
    }

    private WebSocketMessage createValidControlMessage(String command) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("control")
            .textContent(command)
            .build();
    }
}
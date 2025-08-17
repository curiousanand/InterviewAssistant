package com.interview.assistant.presentation.websocket.handler;

import com.interview.assistant.application.usecase.ProcessAudioUseCase;
import com.interview.assistant.application.usecase.GenerateResponseUseCase;
import com.interview.assistant.application.usecase.StartConversationUseCase;
import com.interview.assistant.presentation.websocket.model.WebSocketContext;
import com.interview.assistant.presentation.websocket.model.WebSocketMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Test suite for BusinessLogicHandler
 * 
 * Tests business logic routing, use case integration, and message processing
 * Rationale: Ensures messages are correctly routed to appropriate business logic
 */
@ExtendWith(MockitoExtension.class)
class BusinessLogicHandlerTest {

    @Mock
    private StartConversationUseCase startConversationUseCase;

    @Mock
    private ProcessAudioUseCase processAudioUseCase;

    @Mock
    private GenerateResponseUseCase generateResponseUseCase;

    @Mock
    private WebSocketContext webSocketContext;

    private BusinessLogicHandler businessLogicHandler;

    @BeforeEach
    void setUp() {
        businessLogicHandler = new BusinessLogicHandler(
            startConversationUseCase,
            processAudioUseCase,
            generateResponseUseCase
        );

        // Setup context
        when(webSocketContext.getSessionId()).thenReturn("test-session-id");
        when(webSocketContext.getConversationSessionId()).thenReturn("conversation-session-id");
        when(webSocketContext.getLanguageCode()).thenReturn("en-US");

        // Setup use case returns
        when(startConversationUseCase.execute(any())).thenReturn(CompletableFuture.completedFuture("conversation-id"));
        when(processAudioUseCase.execute(any())).thenReturn(CompletableFuture.completedFuture(null));
        when(generateResponseUseCase.execute(any())).thenReturn(CompletableFuture.completedFuture(null));
    }

    @Test
    void shouldHandleAudioMessageSuccessfully() {
        byte[] audioData = new byte[1024];
        WebSocketMessage message = createAudioMessage(audioData);

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(processAudioUseCase).execute(any());
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldHandleTextMessageSuccessfully() {
        WebSocketMessage message = createTextMessage("Hello, how are you?");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(generateResponseUseCase).execute(any());
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldHandleControlMessageSuccessfully() {
        WebSocketMessage message = createControlMessage("start_recording");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldHandleLanguageChangeMessageSuccessfully() {
        WebSocketMessage message = createLanguageChangeMessage("fr-FR");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).setLanguageCode("fr-FR");
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldHandlePingMessageSuccessfully() {
        WebSocketMessage message = createPingMessage();

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext, never()).incrementErrorCount();
    }

    @Test
    void shouldRejectUnsupportedMessageType() {
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("unsupported_type")
            .textContent("Some content")
            .build();

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Unsupported message type");
    }

    @Test
    void shouldInitializeConversationSessionWhenNull() {
        when(webSocketContext.getConversationSessionId()).thenReturn(null);
        WebSocketMessage message = createTextMessage("Hello");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(startConversationUseCase).execute(any());
        verify(webSocketContext).setConversationSessionId(anyString());
    }

    @Test
    void shouldNotInitializeConversationSessionWhenAlreadyExists() {
        WebSocketMessage message = createTextMessage("Hello");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(startConversationUseCase, never()).execute(any());
        verify(webSocketContext, never()).setConversationSessionId(anyString());
    }

    @Test
    void shouldHandleAudioProcessingFailure() {
        when(processAudioUseCase.execute(any())).thenReturn(
            CompletableFuture.failedFuture(new RuntimeException("Audio processing failed"))
        );
        
        byte[] audioData = new byte[1024];
        WebSocketMessage message = createAudioMessage(audioData);

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Failed to process audio message");
    }

    @Test
    void shouldHandleTextProcessingFailure() {
        when(generateResponseUseCase.execute(any())).thenReturn(
            CompletableFuture.failedFuture(new RuntimeException("Response generation failed"))
        );
        
        WebSocketMessage message = createTextMessage("Hello");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Failed to process text message");
    }

    @Test
    void shouldHandleConversationInitializationFailure() {
        when(webSocketContext.getConversationSessionId()).thenReturn(null);
        when(startConversationUseCase.execute(any())).thenReturn(
            CompletableFuture.failedFuture(new RuntimeException("Conversation init failed"))
        );
        
        WebSocketMessage message = createTextMessage("Hello");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Failed to initialize conversation session");
    }

    @Test
    void shouldHandleGeneralProcessingException() {
        // Simulate an exception during message processing
        doThrow(new RuntimeException("Unexpected error")).when(webSocketContext).getConversationSessionId();
        
        WebSocketMessage message = createTextMessage("Hello");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Business logic processing failed");
    }

    @Test
    void shouldHandleControlMessageCommands() {
        // Test different control commands
        String[] commands = {"start_recording", "stop_recording", "pause_recording", "resume_recording"};
        
        for (String command : commands) {
            WebSocketMessage message = createControlMessage(command);
            MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);
            
            assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
            verify(webSocketContext, never()).incrementErrorCount();
        }
    }

    @Test
    void shouldHandleInvalidLanguageCode() {
        WebSocketMessage message = createLanguageChangeMessage("invalid-language");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        // Should still continue but log warning
        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(webSocketContext).setLanguageCode("invalid-language");
    }

    @Test
    void shouldHandleEmptyAudioMessage() {
        byte[] emptyAudioData = new byte[0];
        WebSocketMessage message = createAudioMessage(emptyAudioData);

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Audio data cannot be empty");
    }

    @Test
    void shouldHandleEmptyTextMessage() {
        WebSocketMessage message = createTextMessage("");

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.ERROR);
        verify(webSocketContext).incrementErrorCount();
        assertThat(message.getProcessingError()).contains("Text content cannot be empty");
    }

    @Test
    void shouldReturnCorrectHandlerName() {
        String handlerName = businessLogicHandler.getHandlerName();
        
        assertThat(handlerName).isEqualTo("BusinessLogicHandler");
    }

    @Test
    void shouldReturnCorrectPriority() {
        int priority = businessLogicHandler.getPriority();
        
        assertThat(priority).isEqualTo(100); // BusinessLogicHandler should have lowest priority (processed last)
    }

    @Test
    void shouldHandleAllSupportedMessageTypes() {
        String[] supportedTypes = {"audio", "text", "control", "language_change", "ping"};
        
        for (String type : supportedTypes) {
            boolean canHandle = businessLogicHandler.canHandle(type);
            assertThat(canHandle).isTrue();
        }
    }

    @Test
    void shouldNotHandleUnsupportedMessageTypes() {
        String[] unsupportedTypes = {"video", "file", "image"};
        
        for (String type : unsupportedTypes) {
            boolean canHandle = businessLogicHandler.canHandle(type);
            assertThat(canHandle).isFalse();
        }
    }

    @Test
    void shouldSetNextHandlerCorrectly() {
        IMessageHandler nextHandler = mock(IMessageHandler.class);
        
        IMessageHandler returnedHandler = businessLogicHandler.setNext(nextHandler);
        
        assertThat(returnedHandler).isEqualTo(nextHandler);
    }

    @Test
    void shouldHandleAsyncProcessingCompletion() throws Exception {
        WebSocketMessage message = createTextMessage("Hello");
        
        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);
        
        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        
        // Wait for async processing to complete
        Thread.sleep(100);
        
        verify(webSocketContext, atLeastOnce()).updateLastActivity();
    }

    @Test
    void shouldHandleMessageWithMetadata() {
        Map<String, Object> metadata = Map.of(
            "confidence", 0.95,
            "language", "en-US",
            "audioFormat", "wav"
        );
        
        WebSocketMessage message = WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent("Hello with metadata")
            .metadata(metadata)
            .build();

        MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);

        assertThat(result).isEqualTo(MessageProcessingResult.CONTINUE);
        verify(generateResponseUseCase).execute(any());
    }

    @Test
    void shouldHandleCaseInsensitiveMessageTypes() {
        String[] messageTypes = {"AUDIO", "Text", "CONTROL", "Language_Change", "PING"};
        
        for (String type : messageTypes) {
            WebSocketMessage message = WebSocketMessage.builder()
                .messageId("msg-1")
                .timestamp(Instant.now())
                .sessionId("test-session")
                .type(type)
                .textContent("test")
                .build();
            
            MessageProcessingResult result = businessLogicHandler.handle(message, webSocketContext);
            
            // All should be handled successfully (converted to lowercase)
            assertThat(result).isNotEqualTo(MessageProcessingResult.ERROR);
        }
    }

    private WebSocketMessage createAudioMessage(byte[] audioData) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("audio")
            .binaryContent(audioData)
            .build();
    }

    private WebSocketMessage createTextMessage(String content) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("text")
            .textContent(content)
            .build();
    }

    private WebSocketMessage createControlMessage(String command) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("control")
            .textContent(command)
            .build();
    }

    private WebSocketMessage createLanguageChangeMessage(String languageCode) {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("language_change")
            .textContent(languageCode)
            .build();
    }

    private WebSocketMessage createPingMessage() {
        return WebSocketMessage.builder()
            .messageId("msg-1")
            .timestamp(Instant.now())
            .sessionId("test-session")
            .type("ping")
            .build();
    }
}
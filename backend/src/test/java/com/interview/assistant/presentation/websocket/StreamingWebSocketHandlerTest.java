package com.interview.assistant.presentation.websocket;

import com.interview.assistant.websocket.AuthenticationHandler;
import com.interview.assistant.websocket.BusinessLogicHandler;
import com.interview.assistant.websocket.ValidationHandler;
import com.interview.assistant.websocket.WebSocketMessage;
import com.interview.assistant.websocket.StreamingWebSocketHandler;
import com.interview.assistant.websocket.WebSocketSessionManager;
import com.interview.assistant.service.IAIService;
import com.interview.assistant.service.ITranscriptionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for StreamingWebSocketHandler
 * 
 * Tests WebSocket lifecycle, message processing, error handling, and handler chain
 */
@DisplayName("StreamingWebSocketHandler Tests")
@ExtendWith(MockitoExtension.class)
class StreamingWebSocketHandlerTest {
    
    private StreamingWebSocketHandler webSocketHandler;
    
    @Mock
    private WebSocketSessionManager sessionManager;
    
    @Mock
    private ValidationHandler validationHandler;
    
    @Mock
    private AuthenticationHandler authenticationHandler;
    
    @Mock
    private BusinessLogicHandler businessLogicHandler;
    
    @Mock
    private ObjectMapper objectMapper;
    
    @Mock
    private WebSocketSession mockSession;
    
    @Mock
    private ValidationHandler.ValidationResult validationResult;
    
    @Mock
    private BusinessLogicHandler.MessageProcessingResult processingResult;
    
    private String testSessionId;
    private WebSocketMessage testMessage;
    
    @BeforeEach
    void setUp() {
        webSocketHandler = new StreamingWebSocketHandler(
            sessionManager, validationHandler, authenticationHandler, businessLogicHandler, objectMapper);
        
        testSessionId = "test-session-123";
        
        // Setup mock session
        when(mockSession.getId()).thenReturn(testSessionId);
        when(mockSession.isOpen()).thenReturn(true);
        
        // Setup test message
        testMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.AUDIO_DATA,
            testSessionId,
            "test-audio-data"
        );
    }
    
    @Test
    @DisplayName("Should handle connection establishment successfully")
    void shouldHandleConnectionEstablishmentSuccessfully() throws Exception {
        // Given
        doNothing().when(sessionManager).registerSession(mockSession);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.afterConnectionEstablished(mockSession);
        
        // Then
        verify(sessionManager).registerSession(mockSession);
        verify(mockSession).sendMessage(any(TextMessage.class));
    }
    
    @Test
    @DisplayName("Should handle connection establishment with send error")
    void shouldHandleConnectionEstablishmentWithSendError() throws Exception {
        // Given
        doNothing().when(sessionManager).registerSession(mockSession);
        doThrow(new RuntimeException("Send failed")).when(mockSession).sendMessage(any(TextMessage.class));
        
        // When & Then - Should not throw exception
        assertThatNoException().isThrownBy(() -> webSocketHandler.afterConnectionEstablished(mockSession));
        
        verify(sessionManager).registerSession(mockSession);
    }
    
    @Test
    @DisplayName("Should process valid authenticated message successfully")
    void shouldProcessValidAuthenticatedMessageSuccessfully() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.CONVERSATION);
        when(businessLogicHandler.processAudioMessage(testMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Then
        verify(sessionManager).updateLastActivity(testSessionId);
        verify(validationHandler).validate(testMessage);
        verify(authenticationHandler).isAuthenticated(mockSession);
        verify(businessLogicHandler).processAudioMessage(testMessage);
    }
    
    @Test
    @DisplayName("Should handle validation failure")
    void shouldHandleValidationFailure() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(false);
        when(validationResult.getErrorMessage()).thenReturn("Invalid message format");
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Then
        verify(validationHandler).validate(testMessage);
        verify(authenticationHandler, never()).isAuthenticated(any());
        verify(businessLogicHandler, never()).processAudioMessage(any());
        verify(mockSession).sendMessage(any(TextMessage.class)); // Error message sent
    }
    
    @Test
    @DisplayName("Should handle authentication failure")
    void shouldHandleAuthenticationFailure() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(false);
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Then
        verify(validationHandler).validate(testMessage);
        verify(authenticationHandler).isAuthenticated(mockSession);
        verify(businessLogicHandler, never()).processAudioMessage(any());
        verify(mockSession).sendMessage(any(TextMessage.class)); // Error message sent
    }
    
    @Test
    @DisplayName("Should handle business logic processing failure")
    void shouldHandleBusinessLogicProcessingFailure() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(false);
        when(processingResult.getErrorMessage()).thenReturn("Processing failed");
        when(businessLogicHandler.processAudioMessage(testMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Then
        verify(businessLogicHandler).processAudioMessage(testMessage);
        verify(mockSession).sendMessage(any(TextMessage.class)); // Error message sent
    }
    
    @Test
    @DisplayName("Should handle async processing exception")
    void shouldHandleAsyncProcessingException() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        CompletableFuture<BusinessLogicHandler.MessageProcessingResult> failedFuture = new CompletableFuture<>();
        failedFuture.completeExceptionally(new RuntimeException("Async processing failed"));
        when(businessLogicHandler.processAudioMessage(testMessage)).thenReturn(failedFuture);
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Wait for async processing
        Thread.sleep(100);
        
        // Then
        verify(businessLogicHandler).processAudioMessage(testMessage);
        // Error message should be sent due to exception
    }
    
    @Test
    @DisplayName("Should process session start message")
    void shouldProcessSessionStartMessage() throws Exception {
        // Given
        WebSocketMessage sessionStartMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_START,
            testSessionId,
            null
        );
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(sessionStartMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.SESSION_CREATED);
        when(businessLogicHandler.processSessionStart(sessionStartMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, sessionStartMessage);
        
        // Then
        verify(businessLogicHandler).processSessionStart(sessionStartMessage);
    }
    
    @Test
    @DisplayName("Should process session end message and close session")
    void shouldProcessSessionEndMessageAndCloseSession() throws Exception {
        // Given
        WebSocketMessage sessionEndMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_END,
            testSessionId,
            null
        );
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(sessionEndMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.SESSION_CLOSED);
        when(businessLogicHandler.processSessionEnd(sessionEndMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        doNothing().when(mockSession).close();
        
        // When
        webSocketHandler.handleMessage(mockSession, sessionEndMessage);
        
        // Wait for async processing
        Thread.sleep(100);
        
        // Then
        verify(businessLogicHandler).processSessionEnd(sessionEndMessage);
        verify(mockSession).close();
    }
    
    @Test
    @DisplayName("Should process heartbeat message")
    void shouldProcessHeartbeatMessage() throws Exception {
        // Given
        WebSocketMessage heartbeatMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            testSessionId,
            null
        );
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(heartbeatMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, heartbeatMessage);
        
        // Then
        verify(mockSession).sendMessage(any(TextMessage.class)); // PONG response
        verify(businessLogicHandler, never()).processAudioMessage(any());
    }
    
    @Test
    @DisplayName("Should handle unsupported message type")
    void shouldHandleUnsupportedMessageType() throws Exception {
        // Given - Using a custom message type that doesn't have specific handling
        WebSocketMessage unknownMessage = mock(WebSocketMessage.class);
        when(unknownMessage.getType()).thenReturn(WebSocketMessage.MessageType.ERROR); // Using ERROR as unsupported in switch
        when(unknownMessage.getSessionId()).thenReturn(testSessionId);
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(unknownMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, unknownMessage);
        
        // Then
        verify(mockSession).sendMessage(any(TextMessage.class)); // Error message sent
        verify(businessLogicHandler, never()).processAudioMessage(any());
    }
    
    @Test
    @DisplayName("Should handle transport error")
    void shouldHandleTransportError() throws Exception {
        // Given
        Throwable transportError = new RuntimeException("Connection lost");
        doNothing().when(sessionManager).unregisterSession(mockSession);
        
        // When
        webSocketHandler.handleTransportError(mockSession, transportError);
        
        // Then
        verify(sessionManager).unregisterSession(mockSession);
    }
    
    @Test
    @DisplayName("Should handle connection closed")
    void shouldHandleConnectionClosed() throws Exception {
        // Given
        CloseStatus closeStatus = CloseStatus.NORMAL;
        doNothing().when(sessionManager).unregisterSession(mockSession);
        doNothing().when(authenticationHandler).cleanupSession(mockSession);
        
        // When
        webSocketHandler.afterConnectionClosed(mockSession, closeStatus);
        
        // Then
        verify(sessionManager).unregisterSession(mockSession);
        verify(authenticationHandler).cleanupSession(mockSession);
    }
    
    @Test
    @DisplayName("Should support partial messages")
    void shouldSupportPartialMessages() {
        // When & Then
        assertThat(webSocketHandler.supportsPartialMessages()).isTrue();
    }
    
    @Test
    @DisplayName("Should handle session close error in session end processing")
    void shouldHandleSessionCloseErrorInSessionEndProcessing() throws Exception {
        // Given
        WebSocketMessage sessionEndMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.SESSION_END,
            testSessionId,
            null
        );
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(sessionEndMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.SESSION_CLOSED);
        when(businessLogicHandler.processSessionEnd(sessionEndMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        doThrow(new RuntimeException("Close failed")).when(mockSession).close();
        
        // When - Should not throw exception
        assertThatNoException().isThrownBy(() -> 
            webSocketHandler.handleMessage(mockSession, sessionEndMessage));
        
        // Wait for async processing
        Thread.sleep(100);
        
        // Then
        verify(businessLogicHandler).processSessionEnd(sessionEndMessage);
        verify(mockSession).close();
    }
    
    @Test
    @DisplayName("Should handle send message error gracefully")
    void shouldHandleSendMessageErrorGracefully() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(false);
        when(validationResult.getErrorMessage()).thenReturn("Validation failed");
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doThrow(new RuntimeException("Send failed")).when(mockSession).sendMessage(any(TextMessage.class));
        
        // When - Should not throw exception
        assertThatNoException().isThrownBy(() -> 
            webSocketHandler.handleMessage(mockSession, testMessage));
        
        // Then
        verify(validationHandler).validate(testMessage);
        verify(mockSession).sendMessage(any(TextMessage.class));
    }
    
    @Test
    @DisplayName("Should not send message to closed session")
    void shouldNotSendMessageToClosedSession() throws Exception {
        // Given
        when(mockSession.isOpen()).thenReturn(false);
        when(validationResult.isValid()).thenReturn(false);
        when(validationResult.getErrorMessage()).thenReturn("Validation failed");
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Then
        verify(validationHandler).validate(testMessage);
        verify(mockSession, never()).sendMessage(any(TextMessage.class));
    }
    
    @Test
    @DisplayName("Should handle conversation result processing")
    void shouldHandleConversationResultProcessing() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        // Mock conversation result
        BusinessLogicHandler.ConversationResult conversationResult = mock(BusinessLogicHandler.ConversationResult.class);
        ITranscriptionService.TranscriptionResult transcriptionResult = mock(ITranscriptionService.TranscriptionResult.class);
        IAIService.AIResponse aiResponse = mock(IAIService.AIResponse.class);
        
        when(transcriptionResult.getText()).thenReturn("Hello world");
        when(transcriptionResult.getConfidence()).thenReturn(0.95);
        when(aiResponse.getContent()).thenReturn("Hi there!");
        when(conversationResult.getTranscription()).thenReturn(transcriptionResult);
        when(conversationResult.getAiResponse()).thenReturn(aiResponse);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.CONVERSATION);
        when(processingResult.getData()).thenReturn(conversationResult);
        when(businessLogicHandler.processAudioMessage(testMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Wait for async processing
        Thread.sleep(100);
        
        // Then
        verify(businessLogicHandler).processAudioMessage(testMessage);
        verify(mockSession, atLeast(2)).sendMessage(any(TextMessage.class)); // Transcript + AI response
    }
    
    @Test
    @DisplayName("Should handle error result type")
    void shouldHandleErrorProcessingType() throws Exception {
        // Given
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(testMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        when(processingResult.isSuccess()).thenReturn(true);
        when(processingResult.getType()).thenReturn(BusinessLogicHandler.MessageProcessingResult.ProcessingType.ERROR);
        when(processingResult.getErrorMessage()).thenReturn("Business logic error");
        when(businessLogicHandler.processAudioMessage(testMessage))
            .thenReturn(CompletableFuture.completedFuture(processingResult));
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, testMessage);
        
        // Wait for async processing
        Thread.sleep(100);
        
        // Then
        verify(businessLogicHandler).processAudioMessage(testMessage);
        verify(mockSession).sendMessage(any(TextMessage.class)); // Error message sent
    }
    
    @Test
    @DisplayName("Should handle heartbeat acknowledgment result")
    void shouldHandleHeartbeatAcknowledgmentResult() throws Exception {
        // Given
        WebSocketMessage heartbeatMessage = WebSocketMessage.create(
            WebSocketMessage.MessageType.HEARTBEAT,
            testSessionId,
            null
        );
        
        when(validationResult.isValid()).thenReturn(true);
        when(validationHandler.validate(heartbeatMessage)).thenReturn(validationResult);
        when(authenticationHandler.isAuthenticated(mockSession)).thenReturn(true);
        
        doNothing().when(sessionManager).updateLastActivity(testSessionId);
        doNothing().when(mockSession).sendMessage(any(TextMessage.class));
        
        // When
        webSocketHandler.handleMessage(mockSession, heartbeatMessage);
        
        // Then
        verify(mockSession).sendMessage(any(TextMessage.class)); // PONG response
    }
}
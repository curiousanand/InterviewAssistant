package com.interview.assistant.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.assistant.websocket.WebSocketMessage;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.*;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;

import java.net.URI;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration test for real-time multimodal conversation orchestration
 * Tests the core requirements you specified:
 * 1. Always listening to speech
 * 2. Live transcription
 * 3. Context understanding
 * 4. Pause detection and AI response triggering
 * 5. Parallel listening while AI responds
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
public class RealTimeConversationOrchestrationTest {

    @LocalServerPort
    private int port;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Test 1: Audio Ingestion - Always listening to speech
     * Verifies continuous audio streaming capability
     */
    @Test
    public void testAudioIngestion_AlwaysListening() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            // Send session start
            sendSessionStart(session, "test-session-1");
            
            // Continuously send audio chunks (simulating always listening)
            byte[] audioChunk = generateMockAudioChunk(100); // 100ms chunk
            
            for (int i = 0; i < 10; i++) {
                session.sendMessage(new BinaryMessage(audioChunk));
                Thread.sleep(100); // 100ms intervals
            }
            
            // Verify session is still active and processing
            assertTrue(session.isOpen(), "WebSocket session should remain open during continuous audio streaming");
            
            // Wait for some processing
            Thread.sleep(1000);
            
            // Should have received some responses
            assertTrue(handler.messagesReceived.get() > 0, "Should receive processing responses");
            
        } finally {
            session.close();
        }
    }

    /**
     * Test 2: Live Transcription - Streaming partial and final results
     * Verifies transcript.partial and transcript.final message flow
     */
    @Test
    public void testLiveTranscription_PartialAndFinalResults() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            sendSessionStart(session, "test-session-2");
            
            // Send audio data
            byte[] audioData = generateMockAudioChunk(1000); // Longer chunk for transcription
            session.sendMessage(new BinaryMessage(audioData));
            
            // Wait for responses
            handler.partialTranscriptLatch.await(5, TimeUnit.SECONDS);
            handler.finalTranscriptLatch.await(5, TimeUnit.SECONDS);
            
            // Verify we got both partial and final transcripts
            assertTrue(handler.receivedPartialTranscript.get(), "Should receive partial transcript");
            assertTrue(handler.receivedFinalTranscript.get(), "Should receive final transcript");
            
        } finally {
            session.close();
        }
    }

    /**
     * Test 3: Context Understanding - Session state management
     * Verifies conversation context is maintained across messages
     */
    @Test
    public void testContextManagement() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            String sessionId = "context-test-session";
            sendSessionStart(session, sessionId);
            
            // Send multiple audio messages to build context
            for (int i = 0; i < 3; i++) {
                byte[] audioData = generateMockAudioChunk(500);
                session.sendMessage(new BinaryMessage(audioData));
                Thread.sleep(2000); // Wait between messages to allow processing
            }
            
            // Verify session maintains context (should get AI responses)
            handler.assistantResponseLatch.await(10, TimeUnit.SECONDS);
            assertTrue(handler.receivedAssistantResponse.get(), "Should receive AI responses indicating context processing");
            
        } finally {
            session.close();
        }
    }

    /**
     * Test 4: Pause Detection - Simulated silence detection
     * Tests the logic for handling speech pauses
     */
    @Test
    public void testPauseDetectionLogic() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            sendSessionStart(session, "pause-test-session");
            
            // Send audio chunk
            byte[] audioData = generateMockAudioChunk(800);
            session.sendMessage(new BinaryMessage(audioData));
            
            // Simulate pause by not sending more audio
            // The system should detect this and trigger AI response
            
            // Wait for AI response (indicating pause was detected)
            boolean aiResponseReceived = handler.assistantResponseLatch.await(8, TimeUnit.SECONDS);
            assertTrue(aiResponseReceived, "Should receive AI response after pause detection");
            
        } finally {
            session.close();
        }
    }

    /**
     * Test 5: Parallel Processing - Listening while AI thinks
     * Simulates user continuing to speak while AI processes
     */
    @Test
    public void testParallelListeningAndAIProcessing() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            sendSessionStart(session, "parallel-test-session");
            
            // Send first audio chunk
            byte[] firstAudio = generateMockAudioChunk(500);
            session.sendMessage(new BinaryMessage(firstAudio));
            
            // Immediately send more audio (simulating continued speaking)
            Thread.sleep(100);
            byte[] continuedAudio = generateMockAudioChunk(500);
            session.sendMessage(new BinaryMessage(continuedAudio));
            
            // Both should be processed
            handler.finalTranscriptLatch.await(10, TimeUnit.SECONDS);
            handler.assistantResponseLatch.await(10, TimeUnit.SECONDS);
            
            assertTrue(handler.receivedFinalTranscript.get(), "Should process all audio even during parallel processing");
            assertTrue(handler.receivedAssistantResponse.get(), "Should generate AI response even with continued input");
            
        } finally {
            session.close();
        }
    }

    /**
     * Test 6: Output Generation - Text and streaming responses
     * Verifies assistant.delta and assistant.done message flow
     */
    @Test
    public void testOutputGeneration_StreamingResponse() throws Exception {
        TestWebSocketHandler handler = new TestWebSocketHandler();
        WebSocketSession session = connectToWebSocket(handler);

        try {
            sendSessionStart(session, "output-test-session");
            
            // Send audio
            byte[] audioData = generateMockAudioChunk(600);
            session.sendMessage(new BinaryMessage(audioData));
            
            // Wait for complete response flow
            handler.assistantDeltaLatch.await(8, TimeUnit.SECONDS);
            handler.assistantDoneLatch.await(8, TimeUnit.SECONDS);
            
            assertTrue(handler.receivedAssistantDelta.get(), "Should receive assistant.delta messages");
            assertTrue(handler.receivedAssistantDone.get(), "Should receive assistant.done message");
            
        } finally {
            session.close();
        }
    }

    // Helper methods

    private WebSocketSession connectToWebSocket(TestWebSocketHandler handler) throws Exception {
        StandardWebSocketClient client = new StandardWebSocketClient();
        URI uri = URI.create("ws://localhost:" + port + "/ws/stream");
        
        CompletableFuture<WebSocketSession> sessionFuture = new CompletableFuture<>();
        
        client.doHandshake(new WebSocketHandler() {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                handler.afterConnectionEstablished(session);
                sessionFuture.complete(session);
            }

            @Override
            public void handleMessage(WebSocketSession session, org.springframework.web.socket.WebSocketMessage<?> message) throws Exception {
                handler.handleMessage(session, message);
            }

            @Override
            public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
                handler.handleTransportError(session, exception);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                handler.afterConnectionClosed(session, closeStatus);
            }

            @Override
            public boolean supportsPartialMessages() {
                return handler.supportsPartialMessages();
            }
        }, null, uri);

        return sessionFuture.get(5, TimeUnit.SECONDS);
    }

    private void sendSessionStart(WebSocketSession session, String sessionId) throws Exception {
        WebSocketMessage startMessage = WebSocketMessage.create(
                WebSocketMessage.MessageType.SESSION_START,
                sessionId,
                null
        );
        
        String jsonMessage = objectMapper.writeValueAsString(startMessage);
        session.sendMessage(new TextMessage(jsonMessage));
        
        Thread.sleep(500); // Allow session initialization
    }

    private byte[] generateMockAudioChunk(int durationMs) {
        // Generate mock PCM audio data (16kHz, 16-bit, mono)
        int sampleRate = 16000;
        int bytesPerSample = 2;
        int samples = (sampleRate * durationMs) / 1000;
        
        return new byte[samples * bytesPerSample]; // Silent audio for testing
    }

    /**
     * Test WebSocket handler to track received messages
     */
    private static class TestWebSocketHandler implements WebSocketHandler {
        final AtomicInteger messagesReceived = new AtomicInteger(0);
        final AtomicBoolean receivedPartialTranscript = new AtomicBoolean(false);
        final AtomicBoolean receivedFinalTranscript = new AtomicBoolean(false);
        final AtomicBoolean receivedAssistantResponse = new AtomicBoolean(false);
        final AtomicBoolean receivedAssistantDelta = new AtomicBoolean(false);
        final AtomicBoolean receivedAssistantDone = new AtomicBoolean(false);
        
        final CountDownLatch partialTranscriptLatch = new CountDownLatch(1);
        final CountDownLatch finalTranscriptLatch = new CountDownLatch(1);
        final CountDownLatch assistantResponseLatch = new CountDownLatch(1);
        final CountDownLatch assistantDeltaLatch = new CountDownLatch(1);
        final CountDownLatch assistantDoneLatch = new CountDownLatch(1);

        @Override
        public void afterConnectionEstablished(WebSocketSession session) throws Exception {
            // Connection established
        }

        @Override
        public void handleMessage(WebSocketSession session, org.springframework.web.socket.WebSocketMessage<?> message) throws Exception {
            messagesReceived.incrementAndGet();
            
            if (message instanceof TextMessage) {
                String payload = ((TextMessage) message).getPayload();
                
                if (payload.contains("\"type\":\"transcript.partial\"")) {
                    receivedPartialTranscript.set(true);
                    partialTranscriptLatch.countDown();
                } else if (payload.contains("\"type\":\"transcript.final\"")) {
                    receivedFinalTranscript.set(true);
                    finalTranscriptLatch.countDown();
                } else if (payload.contains("\"type\":\"assistant.delta\"")) {
                    receivedAssistantDelta.set(true);
                    receivedAssistantResponse.set(true);
                    assistantDeltaLatch.countDown();
                    assistantResponseLatch.countDown();
                } else if (payload.contains("\"type\":\"assistant.done\"")) {
                    receivedAssistantDone.set(true);
                    assistantDoneLatch.countDown();
                }
            }
        }

        @Override
        public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
            exception.printStackTrace();
        }

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
            // Connection closed
        }

        @Override
        public boolean supportsPartialMessages() {
            return true;
        }
    }
}
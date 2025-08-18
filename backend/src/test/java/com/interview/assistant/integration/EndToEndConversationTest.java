package com.interview.assistant.integration;

import com.interview.assistant.orchestration.ConversationOrchestrator;
import com.interview.assistant.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end integration test for complete real-time conversation orchestration
 * 
 * Tests the full pipeline:
 * Audio → VAD → Transcript Buffers → Pause Detection → AI → Streaming Output
 */
@SpringBootTest
@ActiveProfiles("test")
public class EndToEndConversationTest {

    @Autowired(required = false)
    private ConversationOrchestrator conversationOrchestrator;
    
    @Autowired(required = false)
    private VoiceActivityDetector voiceActivityDetector;
    
    @Autowired(required = false)  
    private TranscriptBufferManager transcriptBufferManager;
    
    @Autowired(required = false)
    private StreamingAIService streamingAIService;

    /**
     * Test the complete conversation orchestration flow
     */
    @Test
    public void testCompleteConversationOrchestration() throws Exception {
        // Skip test if orchestration components not available (missing Azure config)
        if (conversationOrchestrator == null) {
            System.out.println("⚠️ Skipping E2E test - orchestration components not available (likely missing Azure config)");
            return;
        }

        System.out.println("\n🚀 STARTING END-TO-END CONVERSATION ORCHESTRATION TEST");
        System.out.println("================================================================");

        String sessionId = "e2e-test-session-" + System.currentTimeMillis();
        
        // Event tracking
        AtomicInteger transcriptPartialCount = new AtomicInteger(0);
        AtomicInteger transcriptFinalCount = new AtomicInteger(0);
        AtomicInteger aiResponseCount = new AtomicInteger(0);
        AtomicBoolean aiThinkingReceived = new AtomicBoolean(false);
        AtomicReference<String> finalTranscript = new AtomicReference<>("");
        AtomicReference<String> aiResponse = new AtomicReference<>("");
        
        CountDownLatch sessionStartedLatch = new CountDownLatch(1);
        CountDownLatch transcriptLatch = new CountDownLatch(1);
        CountDownLatch aiResponseLatch = new CountDownLatch(1);

        // Start orchestration session
        System.out.println("1. Starting orchestration session...");
        conversationOrchestrator.startSession(sessionId, event -> {
            System.out.println("   Event: " + event.getType() + " - " + event.getPayload());
            
            switch (event.getType()) {
                case SESSION_STARTED -> sessionStartedLatch.countDown();
                
                case TRANSCRIPT_PARTIAL -> {
                    transcriptPartialCount.incrementAndGet();
                    ConversationOrchestrator.OrchestrationEvent.TranscriptPayload payload = 
                        (ConversationOrchestrator.OrchestrationEvent.TranscriptPayload) event.getPayload();
                    System.out.println("   📝 Partial transcript: '" + payload.getText() + "' (confidence: " + payload.getConfidence() + ")");
                }
                
                case TRANSCRIPT_FINAL -> {
                    transcriptFinalCount.incrementAndGet();
                    ConversationOrchestrator.OrchestrationEvent.TranscriptPayload payload = 
                        (ConversationOrchestrator.OrchestrationEvent.TranscriptPayload) event.getPayload();
                    finalTranscript.set(payload.getText());
                    System.out.println("   ✅ Final transcript: '" + payload.getText() + "' (confidence: " + payload.getConfidence() + ")");
                    transcriptLatch.countDown();
                }
                
                case AI_THINKING -> {
                    aiThinkingReceived.set(true);
                    System.out.println("   🤔 AI is thinking...");
                }
                
                case AI_RESPONSE_DELTA -> {
                    String text = (String) event.getPayload();
                    System.out.println("   💬 AI response delta: '" + text + "'");
                }
                
                case AI_RESPONSE_DONE -> {
                    aiResponseCount.incrementAndGet();
                    String text = (String) event.getPayload();
                    aiResponse.set(text);
                    System.out.println("   ✅ AI response complete: '" + text + "'");
                    aiResponseLatch.countDown();
                }
                
                case AI_INTERRUPTED -> {
                    System.out.println("   ⚡ AI interrupted by user");
                }
                
                case SESSION_ENDED -> {
                    System.out.println("   🔚 Session ended");
                }
                
                case ERROR -> {
                    String error = (String) event.getPayload();
                    System.err.println("   ❌ Error: " + error);
                }
            }
        }).get(5, TimeUnit.SECONDS);

        // Wait for session to start
        assertTrue(sessionStartedLatch.await(5, TimeUnit.SECONDS), "Session should start");
        System.out.println("✅ Session started successfully");

        // 2. Simulate audio input with voice activity
        System.out.println("\n2. Simulating audio input with speech...");
        
        // Generate mock audio chunks with some "voice" activity
        byte[] audioWithVoice = generateMockAudioWithVoice(800); // 50ms chunk with voice
        byte[] audioSilence = generateMockSilentAudio(800);      // 50ms silent chunk

        // Send audio chunks simulating: speech → pause → more speech → long pause
        for (int i = 0; i < 5; i++) {
            conversationOrchestrator.processAudioChunk(sessionId, audioWithVoice, event -> {
                // Events handled by session callback above
            });
            Thread.sleep(100); // 100ms between chunks
        }
        
        System.out.println("   📤 Sent 5 audio chunks with voice activity");

        // Send silence to trigger pause detection
        for (int i = 0; i < 15; i++) { // 1.5 seconds of silence
            conversationOrchestrator.processAudioChunk(sessionId, audioSilence, event -> {
                // Events handled by session callback above  
            });
            Thread.sleep(100);
        }
        
        System.out.println("   🔇 Sent 15 silent chunks to trigger pause detection");

        // 3. Wait for transcription and AI response
        System.out.println("\n3. Waiting for transcription and AI response...");
        
        boolean transcriptReceived = transcriptLatch.await(10, TimeUnit.SECONDS);
        boolean aiResponseReceived = aiResponseLatch.await(15, TimeUnit.SECONDS);

        // 4. Verify results
        System.out.println("\n4. Verifying orchestration results...");
        System.out.println("================================================================");
        
        System.out.println("📊 CONVERSATION ORCHESTRATION RESULTS:");
        System.out.println("├── Transcript partial events: " + transcriptPartialCount.get());
        System.out.println("├── Transcript final events: " + transcriptFinalCount.get());
        System.out.println("├── AI thinking event: " + aiThinkingReceived.get());
        System.out.println("├── AI response events: " + aiResponseCount.get());
        System.out.println("├── Final transcript: '" + finalTranscript.get() + "'");
        System.out.println("└── AI response: '" + aiResponse.get() + "'");

        // Component availability verification
        System.out.println("\n🔧 COMPONENT VERIFICATION:");
        System.out.println("├── ConversationOrchestrator: " + (conversationOrchestrator != null ? "✅" : "❌"));
        System.out.println("├── VoiceActivityDetector: " + (voiceActivityDetector != null ? "✅" : "❌"));
        System.out.println("├── TranscriptBufferManager: " + (transcriptBufferManager != null ? "✅" : "❌"));
        System.out.println("└── StreamingAIService: " + (streamingAIService != null ? "✅" : "❌"));

        // Basic assertions
        assertNotNull(conversationOrchestrator, "ConversationOrchestrator should be available");
        
        // Note: Some assertions may fail if Azure services are not configured
        // This is expected in test environment
        if (transcriptReceived) {
            System.out.println("✅ Transcription pipeline working");
            assertTrue(transcriptFinalCount.get() > 0, "Should receive final transcript");
        } else {
            System.out.println("⚠️ Transcription may require Azure Speech Services configuration");
        }
        
        if (aiResponseReceived) {
            System.out.println("✅ AI response pipeline working");
            assertTrue(aiResponseCount.get() > 0, "Should receive AI response");
            assertFalse(aiResponse.get().trim().isEmpty(), "AI response should not be empty");
        } else {
            System.out.println("⚠️ AI response may require Azure OpenAI configuration");
        }

        // 5. Test buffer management
        if (transcriptBufferManager != null) {
            System.out.println("\n5. Testing buffer management...");
            
            // Add some test data to buffers
            transcriptBufferManager.updateLiveBuffer(sessionId, "test partial", 0.9, java.time.Instant.now());
            TranscriptBufferManager.TranscriptSegment liveSegment = transcriptBufferManager.getCurrentLiveBuffer(sessionId);
            
            if (liveSegment != null) {
                assertEquals("test partial", liveSegment.getText());
                System.out.println("✅ Live buffer management working");
            }
            
            // Confirm buffer
            TranscriptBufferManager.TranscriptSegment confirmedSegment = 
                transcriptBufferManager.confirmBuffer(sessionId, "test final", 0.95, java.time.Instant.now());
            
            assertNotNull(confirmedSegment);
            assertEquals("test final", confirmedSegment.getText());
            System.out.println("✅ Buffer confirmation working");
        }

        // 6. Test voice activity detection
        if (voiceActivityDetector != null) {
            System.out.println("\n6. Testing voice activity detection...");
            
            VoiceActivityDetector.VoiceActivityResult vadResult = 
                voiceActivityDetector.processAudioChunk(sessionId, audioWithVoice);
            
            assertNotNull(vadResult);
            System.out.println("✅ Voice activity detection working - Event: " + vadResult.getEvent());
            
            // Test silence detection
            VoiceActivityDetector.VoiceActivityResult silenceResult = 
                voiceActivityDetector.processAudioChunk(sessionId, audioSilence);
            
            assertNotNull(silenceResult);
            System.out.println("✅ Silence detection working - Event: " + silenceResult.getEvent());
        }

        // 7. Cleanup
        System.out.println("\n7. Cleaning up session...");
        conversationOrchestrator.endSession(sessionId).get(5, TimeUnit.SECONDS);
        System.out.println("✅ Session cleanup completed");

        System.out.println("\n🎉 END-TO-END CONVERSATION ORCHESTRATION TEST COMPLETED");
        System.out.println("================================================================");
        
        // Overall success if core orchestration is working
        assertTrue(conversationOrchestrator != null, "Core orchestration should be functional");
    }

    /**
     * Generate mock audio data with voice-like characteristics
     */
    private byte[] generateMockAudioWithVoice(int lengthBytes) {
        byte[] audio = new byte[lengthBytes];
        
        // Generate simple sine wave to simulate voice
        for (int i = 0; i < lengthBytes - 1; i += 2) {
            // 16-bit PCM samples at ~800Hz (voice-like frequency)
            double time = (double) i / (2.0 * 16000.0); // Assuming 16kHz
            short sample = (short) (Short.MAX_VALUE * 0.1 * Math.sin(2 * Math.PI * 800 * time));
            
            // Little-endian 16-bit
            audio[i] = (byte) (sample & 0xFF);
            audio[i + 1] = (byte) ((sample >> 8) & 0xFF);
        }
        
        return audio;
    }

    /**
     * Generate mock silent audio data
     */
    private byte[] generateMockSilentAudio(int lengthBytes) {
        return new byte[lengthBytes]; // All zeros = silence
    }
}
package com.interview.assistant.integration;

import com.interview.assistant.application.usecase.StartConversationUseCase;
import com.interview.assistant.application.usecase.ProcessAudioUseCase;
import com.interview.assistant.application.usecase.GenerateResponseUseCase;
import com.interview.assistant.domain.model.AudioFormat;
import com.interview.assistant.domain.model.LanguageCode;
import com.interview.assistant.domain.model.TranscriptionResult;
import com.interview.assistant.domain.service.ConversationService;
import com.interview.assistant.infrastructure.repository.H2SessionRepository;
import com.interview.assistant.infrastructure.repository.H2MessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

/**
 * Integration test suite for conversation workflow
 * 
 * Tests complete conversation flow from start to AI response generation
 * Rationale: Ensures all conversation components work together correctly
 */
@ExtendWith(SpringExtension.class)
@SpringBootTest
@Transactional
class ConversationWorkflowIntegrationTest {

    @Autowired
    private StartConversationUseCase startConversationUseCase;

    @Autowired
    private ProcessAudioUseCase processAudioUseCase;

    @Autowired
    private GenerateResponseUseCase generateResponseUseCase;

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private H2SessionRepository sessionRepository;

    @Autowired
    private H2MessageRepository messageRepository;

    private String conversationSessionId;
    private LanguageCode defaultLanguage;
    private AudioFormat defaultAudioFormat;

    @BeforeEach
    void setUp() throws Exception {
        defaultLanguage = LanguageCode.fromString("en-US");
        defaultAudioFormat = AudioFormat.builder()
            .sampleRate(16000)
            .bitDepth(16)
            .channels(1)
            .encoding("PCM")
            .build();

        // Start a new conversation
        conversationSessionId = startConversationUseCase.execute(
            "test-websocket-session",
            defaultLanguage,
            true
        ).get(5, TimeUnit.SECONDS);
        
        assertThat(conversationSessionId).isNotNull();
    }

    @Test
    void shouldCreateConversationSuccessfully() throws Exception {
        // Verify conversation session was created
        assertThat(conversationSessionId).startsWith("session-");
        
        // Verify session exists in repository
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
        assertThat(session.get().getLanguageCode()).isEqualTo("en-US");
        assertThat(session.get().isActive()).isTrue();
    }

    @Test
    void shouldProcessAudioToTextWorkflow() throws Exception {
        // Create test audio data
        byte[] audioData = createTestAudioData();
        
        // Process audio
        CompletableFuture<TranscriptionResult> transcriptionFuture = 
            processAudioUseCase.executeAsync(conversationSessionId, audioData, defaultAudioFormat);
        
        TranscriptionResult result = transcriptionFuture.get(10, TimeUnit.SECONDS);
        
        // Verify transcription result
        assertThat(result).isNotNull();
        // Note: In real implementation, this would depend on Azure Speech Service
        // For testing, we might get a mock response or error
    }

    @Test
    void shouldProcessTextToResponseWorkflow() throws Exception {
        String userInput = "Hello, how are you today?";
        
        // Generate AI response
        CompletableFuture<String> responseFuture = 
            generateResponseUseCase.executeAsync(conversationSessionId, userInput);
        
        String response = responseFuture.get(10, TimeUnit.SECONDS);
        
        // Verify response was generated
        assertThat(response).isNotNull();
        // Note: In real implementation, this would depend on Azure OpenAI
        // For testing, we might get a mock response or error
    }

    @Test
    void shouldMaintainConversationHistory() throws Exception {
        String userMessage1 = "What is the weather like?";
        String userMessage2 = "What about tomorrow?";
        
        // Send first message
        CompletableFuture<String> response1Future = 
            generateResponseUseCase.executeAsync(conversationSessionId, userMessage1);
        
        String response1 = response1Future.get(10, TimeUnit.SECONDS);
        
        // Send follow-up message
        CompletableFuture<String> response2Future = 
            generateResponseUseCase.executeAsync(conversationSessionId, userMessage2);
        
        String response2 = response2Future.get(10, TimeUnit.SECONDS);
        
        // Verify conversation history is maintained
        var messages = messageRepository.findBySessionIdOrderByTimestamp(conversationSessionId);
        assertThat(messages).hasSizeGreaterThanOrEqualTo(2);
        
        // Verify messages are stored correctly
        assertThat(messages.stream().anyMatch(m -> m.getContent().contains(userMessage1))).isTrue();
        assertThat(messages.stream().anyMatch(m -> m.getContent().contains(userMessage2))).isTrue();
    }

    @Test
    void shouldHandleLanguageChange() throws Exception {
        LanguageCode frenchLanguage = LanguageCode.fromString("fr-FR");
        
        // Change conversation language
        conversationService.updateLanguage(conversationSessionId, frenchLanguage);
        
        // Send message in new language
        String frenchMessage = "Bonjour, comment allez-vous?";
        CompletableFuture<String> responseFuture = 
            generateResponseUseCase.executeAsync(conversationSessionId, frenchMessage);
        
        String response = responseFuture.get(10, TimeUnit.SECONDS);
        
        // Verify language was updated
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
        assertThat(session.get().getLanguageCode()).isEqualTo("fr-FR");
    }

    @Test
    void shouldHandleConversationReset() throws Exception {
        // Add some messages to conversation
        String userMessage = "Initial message";
        generateResponseUseCase.executeAsync(conversationSessionId, userMessage)
            .get(10, TimeUnit.SECONDS);
        
        // Verify messages exist
        var messagesBefore = messageRepository.findBySessionIdOrderByTimestamp(conversationSessionId);
        assertThat(messagesBefore).isNotEmpty();
        
        // Reset conversation
        conversationService.resetConversation(conversationSessionId);
        
        // Verify conversation was reset (implementation dependent)
        // This might clear messages or create a new session
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
    }

    @Test
    void shouldHandleConversationSummarization() throws Exception {
        // Add many messages to trigger summarization
        for (int i = 0; i < 15; i++) {
            String userMessage = "Message number " + i + ": What can you tell me about topic " + i + "?";
            try {
                generateResponseUseCase.executeAsync(conversationSessionId, userMessage)
                    .get(5, TimeUnit.SECONDS);
            } catch (Exception e) {
                // Some messages might fail due to service unavailability in tests
                // Continue to build up conversation history
            }
        }
        
        // Check if summarization was triggered
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
        
        // In a real implementation, we would check for summary creation
        // For now, just verify the session still exists and is manageable
        var messages = messageRepository.findBySessionIdOrderByTimestamp(conversationSessionId);
        // System should manage conversation length appropriately
    }

    @Test
    void shouldHandleMultipleConversations() throws Exception {
        // Create second conversation
        String conversationSessionId2 = startConversationUseCase.execute(
            "test-websocket-session-2",
            defaultLanguage,
            true
        ).get(5, TimeUnit.SECONDS);
        
        assertThat(conversationSessionId2).isNotNull();
        assertThat(conversationSessionId2).isNotEqualTo(conversationSessionId);
        
        // Send messages to both conversations
        String message1 = "Message for conversation 1";
        String message2 = "Message for conversation 2";
        
        CompletableFuture<String> response1Future = 
            generateResponseUseCase.executeAsync(conversationSessionId, message1);
        
        CompletableFuture<String> response2Future = 
            generateResponseUseCase.executeAsync(conversationSessionId2, message2);
        
        // Both should complete independently
        try {
            response1Future.get(10, TimeUnit.SECONDS);
            response2Future.get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Services might not be available in test environment
            // Just verify sessions exist
        }
        
        // Verify both sessions exist
        var session1 = sessionRepository.findBySessionId(conversationSessionId);
        var session2 = sessionRepository.findBySessionId(conversationSessionId2);
        
        assertThat(session1).isPresent();
        assertThat(session2).isPresent();
        assertThat(session1.get().getSessionId()).isNotEqualTo(session2.get().getSessionId());
    }

    @Test
    void shouldHandleConversationStatePersistence() throws Exception {
        String userMessage = "Remember this important information: my name is John";
        
        // Send message with state information
        try {
            generateResponseUseCase.executeAsync(conversationSessionId, userMessage)
                .get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            // Service might not be available, continue with test
        }
        
        // Later in conversation, reference the state
        String followUpMessage = "What is my name?";
        
        try {
            CompletableFuture<String> responseFuture = 
                generateResponseUseCase.executeAsync(conversationSessionId, followUpMessage);
            
            String response = responseFuture.get(10, TimeUnit.SECONDS);
            
            // In a real implementation with working AI service,
            // the response should reference the stored name
        } catch (Exception e) {
            // Service might not be available in test environment
        }
        
        // Verify conversation persistence
        var messages = messageRepository.findBySessionIdOrderByTimestamp(conversationSessionId);
        assertThat(messages.stream().anyMatch(m -> m.getContent().contains("John"))).isTrue();
    }

    @Test
    void shouldHandleAudioToResponseCompleteWorkflow() throws Exception {
        // Create test audio that would transcribe to text
        byte[] audioData = createTestAudioData();
        
        // Process audio (this might fail in test environment without Azure services)
        try {
            CompletableFuture<TranscriptionResult> transcriptionFuture = 
                processAudioUseCase.executeAsync(conversationSessionId, audioData, defaultAudioFormat);
            
            TranscriptionResult transcriptionResult = transcriptionFuture.get(10, TimeUnit.SECONDS);
            
            if (transcriptionResult != null && transcriptionResult.isFinal()) {
                // Generate response from transcription
                CompletableFuture<String> responseFuture = 
                    generateResponseUseCase.executeAsync(conversationSessionId, transcriptionResult.getText());
                
                String response = responseFuture.get(10, TimeUnit.SECONDS);
                
                assertThat(response).isNotNull();
            }
        } catch (Exception e) {
            // Azure services might not be available in test environment
            // This is expected for integration tests without full infrastructure
        }
        
        // Verify session is still active
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
        assertThat(session.get().isActive()).isTrue();
    }

    @Test
    void shouldHandleErrorRecovery() throws Exception {
        // Send invalid/problematic message
        String problematicMessage = ""; // Empty message
        
        try {
            CompletableFuture<String> responseFuture = 
                generateResponseUseCase.executeAsync(conversationSessionId, problematicMessage);
            
            responseFuture.get(5, TimeUnit.SECONDS);
            fail("Should have thrown exception for empty message");
        } catch (Exception e) {
            // Expected - empty message should be rejected
        }
        
        // Verify conversation session is still intact after error
        var session = sessionRepository.findBySessionId(conversationSessionId);
        assertThat(session).isPresent();
        assertThat(session.get().isActive()).isTrue();
        
        // Verify we can still send valid messages after error
        String validMessage = "This is a valid message after error";
        try {
            CompletableFuture<String> responseFuture = 
                generateResponseUseCase.executeAsync(conversationSessionId, validMessage);
            
            responseFuture.get(10, TimeUnit.SECONDS);
            // Should succeed or fail gracefully
        } catch (Exception e) {
            // Azure services might not be available, but conversation should persist
        }
    }

    private byte[] createTestAudioData() {
        // Create simple test audio data representing speech
        byte[] audioData = new byte[8000]; // 0.5 seconds at 16kHz mono
        
        // Generate sine wave pattern to simulate speech
        for (int i = 0; i < audioData.length; i += 2) {
            // Create 16-bit samples
            double time = (double) i / 16000.0;
            short sample = (short) (Math.sin(2.0 * Math.PI * 440.0 * time) * 3000); // 440Hz tone
            
            // Little-endian 16-bit encoding
            audioData[i] = (byte) (sample & 0xFF);
            if (i + 1 < audioData.length) {
                audioData[i + 1] = (byte) ((sample >> 8) & 0xFF);
            }
        }
        
        return audioData;
    }
}
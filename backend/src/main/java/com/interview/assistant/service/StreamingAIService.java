package com.interview.assistant.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Streaming AI service that delivers responses token-by-token for real-time experience
 * <p>
 * Why: Provides real-time AI response streaming like ChatGPT/Claude streaming
 * Pattern: Observer pattern with streaming callbacks
 * Rationale: Essential for natural conversation flow - users see AI "thinking" and responding
 */
@Service
public class StreamingAIService {

    private static final Logger logger = LoggerFactory.getLogger(StreamingAIService.class);

    private final IAIService baseAIService;

    @Value("${ai.streaming.enabled:true}")
    private boolean streamingEnabled;

    @Value("${ai.streaming.token-delay-ms:50}")
    private int tokenDelayMs;

    public StreamingAIService(IAIService baseAIService) {
        this.baseAIService = baseAIService;
    }

    /**
     * Generate streaming AI response with token-by-token delivery
     * 
     * @param sessionId Session identifier
     * @param prompt User input prompt
     * @param language Target language
     * @param streamingCallback Callback for streaming tokens
     * @return Future containing final complete response
     */
    public CompletableFuture<IAIService.AIResponse> generateStreamingResponse(String sessionId, 
                                                                             String prompt,
                                                                             String language,
                                                                             StreamingCallback streamingCallback) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                long startTime = System.currentTimeMillis();
                
                if (!streamingEnabled) {
                    // Fallback to non-streaming response
                    return baseAIService.generateResponse(sessionId, prompt, language).get();
                }

                // Generate complete response first
                IAIService.AIResponse completeResponse = baseAIService.generateResponse(sessionId, prompt, language).get();
                
                if (!completeResponse.isSuccess()) {
                    streamingCallback.onError(completeResponse.getErrorMessage());
                    return completeResponse;
                }

                // Stream the response token-by-token
                streamResponse(sessionId, completeResponse.getContent(), streamingCallback);
                
                // Return final response
                long processingTime = System.currentTimeMillis() - startTime;
                streamingCallback.onComplete();
                
                return createStreamingResponse(completeResponse, (double)processingTime);

            } catch (Exception e) {
                logger.error("Streaming AI response failed for session {}", sessionId, e);
                streamingCallback.onError("Streaming failed: " + e.getMessage());
                return createErrorResponse("Streaming AI response failed: " + e.getMessage());
            }
        });
    }

    /**
     * Stream response text token-by-token
     */
    private void streamResponse(String sessionId, String responseText, StreamingCallback callback) {
        try {
            callback.onStreamStart();
            
            String[] tokens = tokenizeResponse(responseText);
            StringBuilder accumulatedText = new StringBuilder();
            
            for (int i = 0; i < tokens.length; i++) {
                String token = tokens[i];
                accumulatedText.append(token);
                
                // Send token delta
                callback.onToken(token, accumulatedText.toString(), i + 1, tokens.length);
                
                // Simulate natural streaming delay
                if (tokenDelayMs > 0 && i < tokens.length - 1) {
                    Thread.sleep(tokenDelayMs);
                }
            }
            
            logger.debug("Streamed {} tokens for session {}", tokens.length, sessionId);
            
        } catch (Exception e) {
            logger.error("Error during response streaming for session {}", sessionId, e);
            callback.onError("Streaming error: " + e.getMessage());
        }
    }

    /**
     * Tokenize response text for streaming
     * This creates a natural token flow similar to LLM streaming
     */
    private String[] tokenizeResponse(String text) {
        // Simple word-based tokenization for natural streaming feel
        // In production, you might use actual LLM tokenizer
        
        if (text == null || text.trim().isEmpty()) {
            return new String[0];
        }
        
        // Split on spaces but preserve punctuation flow
        String[] words = text.split("\\s+");
        java.util.List<String> tokens = new java.util.ArrayList<>();
        
        for (String word : words) {
            if (word.length() <= 4) {
                // Short words as single tokens
                tokens.add(word + " ");
            } else {
                // Longer words split into smaller chunks for more natural streaming
                tokens.add(word + " ");
            }
        }
        
        return tokens.toArray(new String[0]);
    }

    /**
     * Create streaming-aware AI response
     */
    private IAIService.AIResponse createStreamingResponse(IAIService.AIResponse baseResponse, double streamingTime) {
        return new StreamingAIResponse(
                baseResponse.getContent(),
                baseResponse.getModel(),
                baseResponse.getTokensUsed(),
                streamingTime,
                baseResponse.isSuccess(),
                baseResponse.getErrorMessage(),
                true // isStreamed flag
        );
    }

    /**
     * Create error response
     */
    private IAIService.AIResponse createErrorResponse(String errorMessage) {
        return new StreamingAIResponse("", "unknown", 0, 0, false, errorMessage, false);
    }

    /**
     * Streaming callback interface
     */
    public interface StreamingCallback {
        /**
         * Called when streaming starts
         */
        void onStreamStart();

        /**
         * Called for each token during streaming
         * 
         * @param token Current token
         * @param accumulatedText Full text so far
         * @param tokenIndex Current token index (1-based)
         * @param totalTokens Total number of tokens
         */
        void onToken(String token, String accumulatedText, int tokenIndex, int totalTokens);

        /**
         * Called when streaming completes successfully
         */
        void onComplete();

        /**
         * Called when an error occurs during streaming
         */
        void onError(String error);
    }

    /**
     * Streaming-aware AI response implementation
     */
    private static class StreamingAIResponse implements IAIService.AIResponse {
        private final String content;
        private final String model;
        private final int tokensUsed;
        private final double processingTimeMs;
        private final boolean success;
        private final String errorMessage;
        private final boolean isStreamed;

        public StreamingAIResponse(String content, String model, int tokensUsed, 
                                  double processingTimeMs, boolean success, 
                                  String errorMessage, boolean isStreamed) {
            this.content = content;
            this.model = model;
            this.tokensUsed = tokensUsed;
            this.processingTimeMs = processingTimeMs;
            this.success = success;
            this.errorMessage = errorMessage;
            this.isStreamed = isStreamed;
        }

        @Override
        public String getContent() { return content; }

        @Override
        public String getModel() { return model; }

        @Override
        public int getTokensUsed() { return tokensUsed; }

        @Override
        public double getProcessingTimeMs() { return processingTimeMs; }

        @Override
        public boolean isSuccess() { return success; }

        @Override
        public String getErrorMessage() { return errorMessage; }

        public boolean isStreamed() { return isStreamed; }
    }

    /**
     * WebSocket-compatible streaming callback
     */
    public static class WebSocketStreamingCallback implements StreamingCallback {
        private final String sessionId;
        private final Consumer<StreamingEvent> eventConsumer;

        public WebSocketStreamingCallback(String sessionId, Consumer<StreamingEvent> eventConsumer) {
            this.sessionId = sessionId;
            this.eventConsumer = eventConsumer;
        }

        @Override
        public void onStreamStart() {
            eventConsumer.accept(StreamingEvent.streamStart(sessionId));
        }

        @Override
        public void onToken(String token, String accumulatedText, int tokenIndex, int totalTokens) {
            eventConsumer.accept(StreamingEvent.tokenDelta(sessionId, token, accumulatedText, tokenIndex, totalTokens));
        }

        @Override
        public void onComplete() {
            eventConsumer.accept(StreamingEvent.streamComplete(sessionId));
        }

        @Override
        public void onError(String error) {
            eventConsumer.accept(StreamingEvent.streamError(sessionId, error));
        }
    }

    /**
     * Streaming events for WebSocket communication
     */
    public static class StreamingEvent {
        private final String sessionId;
        private final EventType type;
        private final Object payload;
        private final Instant timestamp;

        private StreamingEvent(String sessionId, EventType type, Object payload) {
            this.sessionId = sessionId;
            this.type = type;
            this.payload = payload;
            this.timestamp = Instant.now();
        }

        public static StreamingEvent streamStart(String sessionId) {
            return new StreamingEvent(sessionId, EventType.STREAM_START, null);
        }

        public static StreamingEvent tokenDelta(String sessionId, String token, String accumulatedText, 
                                               int tokenIndex, int totalTokens) {
            return new StreamingEvent(sessionId, EventType.TOKEN_DELTA, 
                    new TokenPayload(token, accumulatedText, tokenIndex, totalTokens));
        }

        public static StreamingEvent streamComplete(String sessionId) {
            return new StreamingEvent(sessionId, EventType.STREAM_COMPLETE, null);
        }

        public static StreamingEvent streamError(String sessionId, String error) {
            return new StreamingEvent(sessionId, EventType.STREAM_ERROR, error);
        }

        // Getters
        public String getSessionId() { return sessionId; }
        public EventType getType() { return type; }
        public Object getPayload() { return payload; }
        public Instant getTimestamp() { return timestamp; }

        public enum EventType {
            STREAM_START,
            TOKEN_DELTA,
            STREAM_COMPLETE,
            STREAM_ERROR
        }

        public static class TokenPayload {
            private final String token;
            private final String accumulatedText;
            private final int tokenIndex;
            private final int totalTokens;

            public TokenPayload(String token, String accumulatedText, int tokenIndex, int totalTokens) {
                this.token = token;
                this.accumulatedText = accumulatedText;
                this.tokenIndex = tokenIndex;
                this.totalTokens = totalTokens;
            }

            // Getters
            public String getToken() { return token; }
            public String getAccumulatedText() { return accumulatedText; }
            public int getTokenIndex() { return tokenIndex; }
            public int getTotalTokens() { return totalTokens; }
            public double getProgress() { return (double) tokenIndex / totalTokens; }
        }
    }
}
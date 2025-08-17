package com.interview.assistant.application.service;

import com.interview.assistant.domain.service.ITranscriptionService;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;

@Service
public class MockTranscriptionService implements ITranscriptionService {

    @Override
    public CompletableFuture<String> transcribeAudio(byte[] audioData) {
        return CompletableFuture.supplyAsync(() -> {
            // Simulate processing delay
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            // Return mock transcription based on audio data length
            if (audioData.length < 1000) {
                return "hello";
            } else if (audioData.length < 5000) {
                return "hello world";
            } else {
                return "this is a longer transcription for testing purposes";
            }
        });
    }

    @Override
    public Flux<String> transcribeAudioStream(Flux<byte[]> audioStream) {
        return audioStream
            .delayElements(Duration.ofMillis(200))
            .map(audioData -> {
                // Return partial transcriptions
                if (audioData.length < 1000) {
                    return "hel...";
                } else if (audioData.length < 3000) {
                    return "hello wor...";
                } else {
                    return "hello world";
                }
            });
    }

    @Override
    public Mono<String> detectLanguage(byte[] audioData) {
        return Mono.fromCallable(() -> {
            // Mock language detection - always return English
            return "en-US";
        });
    }

    @Override
    public CompletableFuture<Double> getConfidenceScore(String transcription) {
        return CompletableFuture.supplyAsync(() -> {
            // Mock confidence based on transcription length
            if (transcription.length() < 5) {
                return 0.7;
            } else if (transcription.length() < 20) {
                return 0.85;
            } else {
                return 0.95;
            }
        });
    }

    @Override
    public boolean isServiceAvailable() {
        return true;
    }
}
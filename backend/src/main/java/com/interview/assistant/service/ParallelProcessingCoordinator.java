package com.interview.assistant.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Parallel processing coordinator for real-time conversation orchestration
 * 
 * Why: Manages parallel execution of audio processing, transcription, and AI tasks
 * Pattern: Coordinator/Orchestrator - manages complex parallel workflows
 * Rationale: Essential for real-time performance while maintaining system responsiveness
 */
@Service
public class ParallelProcessingCoordinator {
    
    private static final Logger logger = LoggerFactory.getLogger(ParallelProcessingCoordinator.class);
    
    // Specialized thread pools for different types of work
    private final ExecutorService audioProcessingPool;
    private final ExecutorService transcriptionPool;
    private final ExecutorService aiProcessingPool;
    private final ScheduledExecutorService scheduledPool;
    
    // Performance monitoring
    private final AtomicLong totalTasksSubmitted = new AtomicLong(0);
    private final AtomicLong totalTasksCompleted = new AtomicLong(0);
    private final AtomicLong totalTasksFailed = new AtomicLong(0);
    
    // Configuration
    private static final int AUDIO_POOL_SIZE = 4;
    private static final int TRANSCRIPTION_POOL_SIZE = 3;
    private static final int AI_POOL_SIZE = 2;
    private static final int SCHEDULED_POOL_SIZE = 2;
    
    private static final long TASK_TIMEOUT_MS = 10000; // 10 seconds
    private static final int MAX_RETRY_ATTEMPTS = 2;
    
    public ParallelProcessingCoordinator() {
        // Create specialized thread pools with custom naming
        this.audioProcessingPool = createNamedThreadPool(
            AUDIO_POOL_SIZE, "AudioProcessor-%d", Thread.NORM_PRIORITY + 1);
        
        this.transcriptionPool = createNamedThreadPool(
            TRANSCRIPTION_POOL_SIZE, "Transcription-%d", Thread.NORM_PRIORITY);
        
        this.aiProcessingPool = createNamedThreadPool(
            AI_POOL_SIZE, "AIProcessor-%d", Thread.NORM_PRIORITY - 1);
        
        this.scheduledPool = Executors.newScheduledThreadPool(
            SCHEDULED_POOL_SIZE, createThreadFactory("Scheduler-%d", Thread.NORM_PRIORITY));
        
        logger.info("ParallelProcessingCoordinator initialized with pools: audio={}, transcription={}, ai={}, scheduled={}", 
            AUDIO_POOL_SIZE, TRANSCRIPTION_POOL_SIZE, AI_POOL_SIZE, SCHEDULED_POOL_SIZE);
    }
    
    /**
     * Execute audio processing task with high priority
     */
    @Async
    public CompletableFuture<Void> executeAudioProcessing(String sessionId, Runnable task) {
        return executeWithRetry(() -> {
            task.run();
            return null;
        }, audioProcessingPool, "AudioProcessing", sessionId, 1); // Audio tasks rarely need retry
    }
    
    /**
     * Execute transcription task with timeout and retry
     */
    @Async
    public <T> CompletableFuture<T> executeTranscription(String sessionId, Supplier<T> task) {
        return executeWithRetry(task, transcriptionPool, "Transcription", sessionId, MAX_RETRY_ATTEMPTS);
    }
    
    /**
     * Execute AI processing task with lower priority
     */
    @Async
    public <T> CompletableFuture<T> executeAIProcessing(String sessionId, Supplier<T> task) {
        return executeWithRetry(task, aiProcessingPool, "AIProcessing", sessionId, MAX_RETRY_ATTEMPTS);
    }
    
    /**
     * Execute multiple tasks in parallel and wait for all to complete
     */
    public <T> CompletableFuture<List<T>> executeParallel(String sessionId, 
                                                        Supplier<T>... tasks) {
        @SuppressWarnings("unchecked")
        CompletableFuture<T>[] futures = new CompletableFuture[tasks.length];
        
        for (int i = 0; i < tasks.length; i++) {
            final int index = i;
            futures[i] = CompletableFuture.supplyAsync(() -> {
                try {
                    return tasks[index].get();
                } catch (Exception e) {
                    logger.error("Parallel task {} failed for session {}: {}", index, sessionId, e.getMessage());
                    throw new RuntimeException(e);
                }
            }, getOptimalExecutor());
        }
        
        return CompletableFuture.allOf(futures)
            .thenApply(v -> {
                List<T> results = new java.util.ArrayList<>();
                for (CompletableFuture<T> future : futures) {
                    try {
                        results.add(future.get());
                    } catch (Exception e) {
                        logger.warn("Failed to get result from parallel task: {}", e.getMessage());
                        results.add(null);
                    }
                }
                return results;
            });
    }
    
    /**
     * Execute task with delay (for debouncing)
     */
    public <T> ScheduledFuture<T> executeDelayed(Supplier<T> task, long delayMs) {
        totalTasksSubmitted.incrementAndGet();
        
        return scheduledPool.schedule(() -> {
            try {
                T result = task.get();
                totalTasksCompleted.incrementAndGet();
                return result;
            } catch (Exception e) {
                totalTasksFailed.incrementAndGet();
                logger.error("Delayed task execution failed: {}", e.getMessage());
                throw new RuntimeException(e);
            }
        }, delayMs, TimeUnit.MILLISECONDS);
    }
    
    /**
     * Execute recurring task with fixed rate
     */
    public ScheduledFuture<?> executeRecurring(Runnable task, long initialDelayMs, long periodMs) {
        return scheduledPool.scheduleAtFixedRate(() -> {
            try {
                task.run();
            } catch (Exception e) {
                logger.error("Recurring task execution failed: {}", e.getMessage());
            }
        }, initialDelayMs, periodMs, TimeUnit.MILLISECONDS);
    }
    
    /**
     * Cancel delayed task if still pending
     */
    public boolean cancelTask(ScheduledFuture<?> future) {
        if (future != null && !future.isDone()) {
            return future.cancel(false);
        }
        return false;
    }
    
    /**
     * Execute task with retry logic and timeout
     */
    private <T> CompletableFuture<T> executeWithRetry(Supplier<T> task, ExecutorService executor, 
                                                    String taskType, String sessionId, int maxRetries) {
        totalTasksSubmitted.incrementAndGet();
        
        CompletableFuture<T> future = new CompletableFuture<>();
        
        CompletableFuture.runAsync(() -> {
            int attempt = 0;
            Exception lastException = null;
            
            while (attempt <= maxRetries) {
                try {
                    logger.debug("Executing {} task for session {} (attempt {})", taskType, sessionId, attempt + 1);
                    
                    // Execute with timeout
                    CompletableFuture<T> taskFuture = CompletableFuture.supplyAsync(task, executor);
                    T result = taskFuture.get(TASK_TIMEOUT_MS, TimeUnit.MILLISECONDS);
                    
                    // Success
                    future.complete(result);
                    totalTasksCompleted.incrementAndGet();
                    
                    if (attempt > 0) {
                        logger.info("{} task succeeded for session {} after {} retries", 
                            taskType, sessionId, attempt);
                    }
                    return;
                    
                } catch (TimeoutException e) {
                    lastException = e;
                    logger.warn("{} task timeout for session {} (attempt {}): {}ms", 
                        taskType, sessionId, attempt + 1, TASK_TIMEOUT_MS);
                        
                } catch (Exception e) {
                    lastException = e;
                    logger.warn("{} task failed for session {} (attempt {}): {}", 
                        taskType, sessionId, attempt + 1, e.getMessage());
                }
                
                attempt++;
                
                // Exponential backoff for retries
                if (attempt <= maxRetries) {
                    try {
                        Thread.sleep(Math.min(1000 * (1L << (attempt - 1)), 5000));
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            
            // All retries exhausted
            logger.error("{} task failed for session {} after {} attempts", 
                taskType, sessionId, maxRetries + 1);
            future.completeExceptionally(new RuntimeException(
                taskType + " failed after " + (maxRetries + 1) + " attempts", lastException));
            totalTasksFailed.incrementAndGet();
            
        }, executor);
        
        return future;
    }
    
    /**
     * Get optimal executor based on current load
     */
    private ExecutorService getOptimalExecutor() {
        // Simple load balancing - choose executor with smallest queue
        ThreadPoolExecutor audioPool = (ThreadPoolExecutor) audioProcessingPool;
        ThreadPoolExecutor transcriptionPool = (ThreadPoolExecutor) this.transcriptionPool;
        ThreadPoolExecutor aiPool = (ThreadPoolExecutor) aiProcessingPool;
        
        int audioQueue = audioPool.getQueue().size();
        int transcriptionQueue = transcriptionPool.getQueue().size();
        int aiQueue = aiPool.getQueue().size();
        
        if (audioQueue <= transcriptionQueue && audioQueue <= aiQueue) {
            return audioProcessingPool;
        } else if (transcriptionQueue <= aiQueue) {
            return this.transcriptionPool;
        } else {
            return aiProcessingPool;
        }
    }
    
    /**
     * Create named thread pool executor
     */
    private ExecutorService createNamedThreadPool(int poolSize, String namePattern, int priority) {
        return new ThreadPoolExecutor(
            poolSize, poolSize,
            60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            createThreadFactory(namePattern, priority),
            new ThreadPoolExecutor.CallerRunsPolicy() // Fallback to caller thread if overwhelmed
        );
    }
    
    /**
     * Create thread factory with custom naming and priority
     */
    private ThreadFactory createThreadFactory(String namePattern, int priority) {
        return new ThreadFactory() {
            private final AtomicLong threadNumber = new AtomicLong(1);
            
            @Override
            public Thread newThread(Runnable r) {
                Thread thread = new Thread(r, String.format(namePattern, threadNumber.getAndIncrement()));
                thread.setDaemon(false);
                thread.setPriority(priority);
                return thread;
            }
        };
    }
    
    /**
     * Get processing statistics
     */
    public ProcessingStatistics getStatistics() {
        ThreadPoolExecutor audioPool = (ThreadPoolExecutor) audioProcessingPool;
        ThreadPoolExecutor transcriptionPool = (ThreadPoolExecutor) this.transcriptionPool;
        ThreadPoolExecutor aiPool = (ThreadPoolExecutor) aiProcessingPool;
        
        return new ProcessingStatistics(
            totalTasksSubmitted.get(),
            totalTasksCompleted.get(),
            totalTasksFailed.get(),
            audioPool.getActiveCount(),
            audioPool.getQueue().size(),
            transcriptionPool.getActiveCount(),
            transcriptionPool.getQueue().size(),
            aiPool.getActiveCount(),
            aiPool.getQueue().size()
        );
    }
    
    /**
     * Graceful shutdown of all thread pools
     */
    public void shutdown() {
        logger.info("Shutting down ParallelProcessingCoordinator...");
        
        shutdownExecutor(audioProcessingPool, "AudioProcessing");
        shutdownExecutor(transcriptionPool, "Transcription");
        shutdownExecutor(aiProcessingPool, "AIProcessing");
        shutdownExecutor(scheduledPool, "Scheduled");
        
        logger.info("ParallelProcessingCoordinator shutdown complete. Stats: {}", getStatistics());
    }
    
    /**
     * Shutdown individual executor gracefully
     */
    private void shutdownExecutor(ExecutorService executor, String name) {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
                logger.warn("{} pool did not terminate gracefully, forcing shutdown", name);
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            logger.warn("{} pool shutdown interrupted", name);
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
    
    /**
     * Processing statistics data class
     */
    public static class ProcessingStatistics {
        private final long totalTasksSubmitted;
        private final long totalTasksCompleted;
        private final long totalTasksFailed;
        private final int audioActiveThreads;
        private final int audioQueueSize;
        private final int transcriptionActiveThreads;
        private final int transcriptionQueueSize;
        private final int aiActiveThreads;
        private final int aiQueueSize;
        
        public ProcessingStatistics(long totalTasksSubmitted, long totalTasksCompleted, long totalTasksFailed,
                                  int audioActiveThreads, int audioQueueSize, int transcriptionActiveThreads, 
                                  int transcriptionQueueSize, int aiActiveThreads, int aiQueueSize) {
            this.totalTasksSubmitted = totalTasksSubmitted;
            this.totalTasksCompleted = totalTasksCompleted;
            this.totalTasksFailed = totalTasksFailed;
            this.audioActiveThreads = audioActiveThreads;
            this.audioQueueSize = audioQueueSize;
            this.transcriptionActiveThreads = transcriptionActiveThreads;
            this.transcriptionQueueSize = transcriptionQueueSize;
            this.aiActiveThreads = aiActiveThreads;
            this.aiQueueSize = aiQueueSize;
        }
        
        public double getSuccessRate() {
            if (totalTasksSubmitted == 0) return 0.0;
            return (double) totalTasksCompleted / totalTasksSubmitted;
        }
        
        public long getPendingTasks() {
            return totalTasksSubmitted - totalTasksCompleted - totalTasksFailed;
        }
        
        // Getters
        public long getTotalTasksSubmitted() { return totalTasksSubmitted; }
        public long getTotalTasksCompleted() { return totalTasksCompleted; }
        public long getTotalTasksFailed() { return totalTasksFailed; }
        public int getAudioActiveThreads() { return audioActiveThreads; }
        public int getAudioQueueSize() { return audioQueueSize; }
        public int getTranscriptionActiveThreads() { return transcriptionActiveThreads; }
        public int getTranscriptionQueueSize() { return transcriptionQueueSize; }
        public int getAiActiveThreads() { return aiActiveThreads; }
        public int getAiQueueSize() { return aiQueueSize; }
        
        @Override
        public String toString() {
            return String.format("ProcessingStats{submitted=%d, completed=%d, failed=%d, success=%.1f%%, " +
                "audio=%d/%d, transcription=%d/%d, ai=%d/%d}", 
                totalTasksSubmitted, totalTasksCompleted, totalTasksFailed, getSuccessRate() * 100,
                audioActiveThreads, audioQueueSize, transcriptionActiveThreads, transcriptionQueueSize,
                aiActiveThreads, aiQueueSize);
        }
    }
}
package com.interview.assistant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main Spring Boot application entry point for Interview Assistant
 * <p>
 * Why: Bootstraps the application with necessary Spring Boot configurations
 * Pattern: Standard Spring Boot application structure
 * 
 * @EnableAsync - Enables asynchronous processing for non-blocking operations
 * @EnableScheduling - Enables scheduled tasks for session cleanup and monitoring
 * @ConfigurationPropertiesScan - Scans for @ConfigurationProperties classes
 */
@SpringBootApplication
@EnableAsync
@EnableScheduling
@ConfigurationPropertiesScan
public class InterviewAssistantApplication {

    public static void main(String[] args) {
        SpringApplication.run(InterviewAssistantApplication.class, args);
    }
}
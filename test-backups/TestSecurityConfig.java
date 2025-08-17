package com.interview.assistant.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Test-specific security configuration for Interview Assistant
 * Allows public access to test endpoints during testing
 */
@Configuration
@EnableWebSecurity
@Profile("test")
public class TestSecurityConfig {

    @Bean
    public SecurityFilterChain testFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(authz -> authz
                .requestMatchers("/api/test/**").permitAll()  // Allow test endpoints
                .requestMatchers("/actuator/**").permitAll()  // Allow actuator endpoints
                .requestMatchers("/h2-console/**").permitAll() // Allow H2 console
                .anyRequest().permitAll() // Allow all requests in test mode
            )
            .csrf(csrf -> csrf.disable()) // Disable CSRF for testing
            .headers(headers -> headers
                .frameOptions().sameOrigin() // For H2 console
            );
        
        return http.build();
    }
}
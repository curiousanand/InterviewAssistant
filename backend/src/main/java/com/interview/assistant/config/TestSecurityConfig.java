package com.interview.assistant.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Test security configuration for Interview Assistant
 * Allows unauthenticated access for testing
 */
@Configuration
@EnableWebSecurity
@Profile("test")
@Order(1)
public class TestSecurityConfig {

    @Bean
    @Order(1)
    public SecurityFilterChain testFilterChain(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(authz -> authz
                        .anyRequest().permitAll() // Allow all requests in tests
                )
                .csrf(csrf -> csrf.disable()) // Disable CSRF for testing
                .headers(headers -> headers
                        .frameOptions().sameOrigin() // Allow H2 console frames in tests
                );

        return http.build();
    }
}
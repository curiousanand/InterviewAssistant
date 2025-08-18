package com.interview.assistant.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Production security configuration for Interview Assistant
 * Restricts access to production endpoints only
 */
@Configuration
@EnableWebSecurity
@Profile("!test & !dev")
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .authorizeHttpRequests(authz -> authz
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()  // Public health endpoints
                        .requestMatchers("/api/v1/sessions/**").authenticated() // Production API endpoints
                        .requestMatchers("/ws/stream").authenticated() // WebSocket endpoint
                        .anyRequest().denyAll() // Deny all other requests in production
                )
                .csrf(csrf -> csrf
                        .ignoringRequestMatchers("/ws/**") // Disable CSRF for WebSocket
                )
                .headers(headers -> headers
                        .frameOptions().deny() // Security hardening for production
                );

        return http.build();
    }
}
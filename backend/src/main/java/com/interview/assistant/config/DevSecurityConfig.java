package com.interview.assistant.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Development security configuration for Interview Assistant
 * Allows unauthenticated access for development and testing
 */
@Configuration
@EnableWebSecurity
@Profile("dev")
public class DevSecurityConfig {

    @Bean
    public SecurityFilterChain devFilterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(authz -> authz
                .anyRequest().permitAll() // Allow all requests in development
            )
            .csrf(csrf -> csrf.disable()) // Disable CSRF for development
            .headers(headers -> headers
                .frameOptions().sameOrigin() // Allow H2 console frames
            );
        
        return http.build();
    }
}
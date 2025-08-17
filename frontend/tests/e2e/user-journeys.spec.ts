import { test, expect } from '@playwright/test';

/**
 * End-to-End test suite for complete user journeys
 * 
 * Tests complete user workflows from start to finish
 * Rationale: Ensures the entire application works together for real user scenarios
 */

test.describe('Complete User Journeys', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should complete voice conversation journey', async ({ page }) => {
    // Test the complete voice conversation flow
    
    // 1. Page should load with initial state
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="mic-button"]')).toBeVisible();
    
    // 2. Check for microphone permission prompt (if needed)
    // Note: In real E2E tests, you would need to handle browser permissions
    
    // 3. Start recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // 4. Verify recording state
    await expect(page.locator('[data-testid="mic-button"]')).toHaveAttribute('data-recording', 'true');
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
    
    // 5. Simulate some recording time
    await page.waitForTimeout(2000);
    
    // 6. Stop recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // 7. Verify recording stopped
    await expect(page.locator('[data-testid="mic-button"]')).toHaveAttribute('data-recording', 'false');
    
    // 8. Wait for transcription to appear
    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });
    
    // 9. Wait for AI response
    await expect(page.locator('[data-testid="ai-message"]').first()).toBeVisible({ timeout: 15000 });
    
    // 10. Verify conversation history
    const messages = page.locator('[data-testid="message"]');
    await expect(messages).toHaveCount.atLeast(2); // User message + AI response
  });

  test('should complete text conversation journey', async ({ page }) => {
    // Test the complete text conversation flow
    
    // 1. Find and use text input
    const textInput = page.locator('[data-testid="text-input"]');
    await expect(textInput).toBeVisible();
    
    // 2. Type a message
    await textInput.fill('Hello, how are you today?');
    
    // 3. Send the message
    await page.locator('[data-testid="send-button"]').click();
    
    // 4. Verify message appears in chat
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('Hello, how are you today?');
    
    // 5. Wait for AI response
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 15000 });
    
    // 6. Verify input is cleared
    await expect(textInput).toHaveValue('');
    
    // 7. Send follow-up message
    await textInput.fill('What is the weather like?');
    await page.locator('[data-testid="send-button"]').click();
    
    // 8. Verify conversation continues
    await expect(page.locator('[data-testid="ai-message"]').nth(1)).toBeVisible({ timeout: 15000 });
    
    // 9. Check conversation history
    const allMessages = page.locator('[data-testid="message"]');
    await expect(allMessages).toHaveCount.atLeast(4); // 2 user + 2 AI messages
  });

  test('should handle language switching journey', async ({ page }) => {
    // Test language switching functionality
    
    // 1. Open language settings
    await page.locator('[data-testid="language-selector"]').click();
    
    // 2. Select different language
    await page.locator('[data-testid="language-option-fr"]').click();
    
    // 3. Verify UI language changed
    await expect(page.locator('[data-testid="mic-button-label"]')).toContainText('Parler');
    
    // 4. Send message in new language
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Bonjour, comment allez-vous?');
    await page.locator('[data-testid="send-button"]').click();
    
    // 5. Verify message processing
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('Bonjour');
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 15000 });
    
    // 6. Switch back to English
    await page.locator('[data-testid="language-selector"]').click();
    await page.locator('[data-testid="language-option-en"]').click();
    
    // 7. Verify UI switched back
    await expect(page.locator('[data-testid="mic-button-label"]')).toContainText('Speak');
  });

  test('should handle connection issues gracefully', async ({ page }) => {
    // Test how the app handles connection problems
    
    // 1. Start a conversation
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Test message');
    await page.locator('[data-testid="send-button"]').click();
    
    // 2. Simulate network disconnection
    await page.context().setOffline(true);
    
    // 3. Try to send another message
    await textInput.fill('Message while offline');
    await page.locator('[data-testid="send-button"]').click();
    
    // 4. Verify error handling
    await expect(page.locator('[data-testid="connection-error"]')).toBeVisible({ timeout: 5000 });
    
    // 5. Restore connection
    await page.context().setOffline(false);
    
    // 6. Verify reconnection
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    
    // 7. Send message after reconnection
    await textInput.fill('Message after reconnection');
    await page.locator('[data-testid="send-button"]').click();
    
    // 8. Verify normal operation resumed
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 15000 });
  });

  test('should handle long conversation journey', async ({ page }) => {
    // Test extended conversation with multiple exchanges
    
    const questions = [
      'What is artificial intelligence?',
      'How does machine learning work?',
      'What are neural networks?',
      'Explain deep learning',
      'What is natural language processing?',
      'How do chatbots work?',
      'What is computer vision?',
      'Explain reinforcement learning'
    ];
    
    for (let i = 0; i < questions.length; i++) {
      // Send question
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.fill(questions[i]);
      await page.locator('[data-testid="send-button"]').click();
      
      // Wait for response
      await expect(page.locator('[data-testid="ai-message"]').nth(i)).toBeVisible({ timeout: 20000 });
      
      // Small delay between questions
      await page.waitForTimeout(1000);
    }
    
    // Verify all messages are present
    const allMessages = page.locator('[data-testid="message"]');
    await expect(allMessages).toHaveCount.atLeast(16); // 8 questions + 8 responses
    
    // Verify conversation is scrollable
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    
    // Test scrolling to top
    await page.locator('[data-testid="scroll-to-top"]').click();
    await expect(page.locator('[data-testid="message"]').first()).toBeInViewport();
  });

  test('should handle microphone permission journey', async ({ page }) => {
    // Test microphone permission handling
    
    // Mock permission states
    await page.context().grantPermissions(['microphone']);
    
    // 1. Try to start recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // 2. Verify recording starts successfully
    await expect(page.locator('[data-testid="mic-button"]')).toHaveAttribute('data-recording', 'true');
    
    // 3. Stop recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // Test permission denied scenario
    await page.context().clearPermissions();
    
    // 4. Try to start recording without permission
    await page.locator('[data-testid="mic-button"]').click();
    
    // 5. Verify permission prompt or error message
    await expect(page.locator('[data-testid="permission-error"]')).toBeVisible({ timeout: 5000 });
    
    // 6. Verify fallback to text input is available
    await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-input"]')).toBeEnabled();
  });

  test('should handle responsive design journey', async ({ page }) => {
    // Test responsive behavior across different screen sizes
    
    // 1. Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    
    // 2. Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
    
    // 3. Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
    
    // 4. Test mobile interactions
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Mobile test message');
    await page.locator('[data-testid="send-button"]').click();
    
    // 5. Verify mobile UI responds correctly
    await expect(page.locator('[data-testid="user-message"]').last()).toBeVisible();
    
    // 6. Test orientation change
    await page.setViewportSize({ width: 667, height: 375 });
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
  });

  test('should handle accessibility journey', async ({ page }) => {
    // Test accessibility features
    
    // 1. Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="mic-button"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="text-input"]')).toBeFocused();
    
    // 2. Test screen reader compatibility
    await expect(page.locator('[data-testid="mic-button"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="text-input"]')).toHaveAttribute('aria-label');
    
    // 3. Test keyboard shortcuts
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Keyboard test message');
    await page.keyboard.press('Enter');
    
    // 4. Verify message sent via keyboard
    await expect(page.locator('[data-testid="user-message"]').last()).toContainText('Keyboard test message');
    
    // 5. Test high contrast mode compatibility
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // 6. Verify dark mode works
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('should handle error recovery journey', async ({ page }) => {
    // Test error handling and recovery
    
    // 1. Send valid message first
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Valid message');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 15000 });
    
    // 2. Simulate server error
    await page.route('**/ws/stream', route => {
      route.abort('failed');
    });
    
    // 3. Try to send message during error
    await textInput.fill('Message during error');
    await page.locator('[data-testid="send-button"]').click();
    
    // 4. Verify error message appears
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
    
    // 5. Clear route interception to simulate recovery
    await page.unroute('**/ws/stream');
    
    // 6. Try again after recovery
    await page.locator('[data-testid="retry-button"]').click();
    
    // 7. Verify normal operation resumed
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected');
    
    // 8. Send new message after recovery
    await textInput.fill('Message after recovery');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible({ timeout: 15000 });
  });

  test('should handle concurrent user actions journey', async ({ page }) => {
    // Test handling multiple concurrent user actions
    
    // 1. Start multiple actions simultaneously
    const textInput = page.locator('[data-testid="text-input"]');
    
    // Start recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // Try to type while recording
    await textInput.fill('Typing while recording');
    
    // 2. Verify system handles concurrent actions appropriately
    await expect(page.locator('[data-testid="mic-button"]')).toHaveAttribute('data-recording', 'true');
    
    // 3. Stop recording
    await page.locator('[data-testid="mic-button"]').click();
    
    // 4. Quickly send text message
    await page.locator('[data-testid="send-button"]').click();
    
    // 5. Verify both actions are processed correctly
    await expect(page.locator('[data-testid="message"]')).toHaveCount.atLeast(1);
    
    // 6. Test rapid message sending
    for (let i = 0; i < 3; i++) {
      await textInput.fill(`Rapid message ${i}`);
      await page.locator('[data-testid="send-button"]').click();
      await page.waitForTimeout(100);
    }
    
    // 7. Verify all messages are queued and processed
    await expect(page.locator('[data-testid="message"]')).toHaveCount.atLeast(4);
  });
});
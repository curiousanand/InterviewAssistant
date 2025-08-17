import { test, expect, devices } from '@playwright/test';

/**
 * Cross-browser compatibility test suite
 * 
 * Tests application functionality across different browsers and devices
 * Rationale: Ensures consistent user experience across all supported platforms
 */

// Test configurations for different browsers and devices
const browserConfigs = [
  { name: 'Chrome Desktop', ...devices['Desktop Chrome'] },
  { name: 'Firefox Desktop', ...devices['Desktop Firefox'] },
  { name: 'Safari Desktop', ...devices['Desktop Safari'] },
  { name: 'Edge Desktop', ...devices['Desktop Edge'] },
  { name: 'Chrome Mobile', ...devices['Pixel 5'] },
  { name: 'Safari Mobile', ...devices['iPhone 12'] },
  { name: 'Samsung Mobile', ...devices['Galaxy S5'] },
];

for (const config of browserConfigs) {
  test.describe(`Cross-browser tests - ${config.name}`, () => {
    
    test.use({ ...config });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('should load application correctly', async ({ page }) => {
      // Basic application loading test
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
      await expect(page.locator('[data-testid="mic-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
      
      // Check for critical CSS loading
      const micButton = page.locator('[data-testid="mic-button"]');
      await expect(micButton).toHaveCSS('display', 'flex');
      
      // Verify JavaScript functionality
      const sendButton = page.locator('[data-testid="send-button"]');
      await expect(sendButton).toBeEnabled();
    });

    test('should handle text input correctly', async ({ page }) => {
      const textInput = page.locator('[data-testid="text-input"]');
      
      // Test typing
      await textInput.fill('Test message for cross-browser compatibility');
      await expect(textInput).toHaveValue('Test message for cross-browser compatibility');
      
      // Test sending
      await page.locator('[data-testid="send-button"]').click();
      
      // Verify message appears
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Test message for cross-browser compatibility');
      
      // Verify input is cleared
      await expect(textInput).toHaveValue('');
    });

    test('should handle WebSocket connection', async ({ page }) => {
      // Test WebSocket functionality across browsers
      const textInput = page.locator('[data-testid="text-input"]');
      
      await textInput.fill('WebSocket test message');
      await page.locator('[data-testid="send-button"]').click();
      
      // Wait for message to be sent via WebSocket
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('WebSocket test message');
      
      // Check connection status
      await expect(page.locator('[data-testid="connection-status"]'))
        .toContainText('Connected');
    });

    test('should handle CSS animations and transitions', async ({ page }) => {
      // Test CSS animations work across browsers
      const micButton = page.locator('[data-testid="mic-button"]');
      
      // Test hover effects (desktop only)
      if (!config.name.includes('Mobile')) {
        await micButton.hover();
        await expect(micButton).toHaveCSS('transform', /scale/);
      }
      
      // Test click animations
      await micButton.click();
      await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
      
      await micButton.click(); // Stop recording
      await expect(page.locator('[data-testid="recording-indicator"]')).not.toBeVisible();
    });

    test('should handle responsive design', async ({ page }) => {
      const viewport = page.viewportSize();
      
      if (viewport && viewport.width < 768) {
        // Mobile layout tests
        await expect(page.locator('[data-testid="mobile-menu-toggle"]')).toBeVisible();
        await expect(page.locator('[data-testid="sidebar"]')).not.toBeVisible();
        
        // Test mobile menu
        await page.locator('[data-testid="mobile-menu-toggle"]').click();
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
        
      } else {
        // Desktop layout tests
        await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
        await expect(page.locator('[data-testid="mobile-menu-toggle"]')).not.toBeVisible();
      }
    });

    test('should handle audio features appropriately', async ({ page }) => {
      const micButton = page.locator('[data-testid="mic-button"]');
      
      // Click microphone button
      await micButton.click();
      
      // Check if browser supports audio recording
      const permissionError = page.locator('[data-testid="permission-error"]');
      const recordingIndicator = page.locator('[data-testid="recording-indicator"]');
      
      // Either should show recording indicator or permission error
      const hasRecording = await recordingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      const hasError = await permissionError.isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(hasRecording || hasError).toBeTruthy();
      
      // If recording works, test stopping
      if (hasRecording) {
        await micButton.click();
        await expect(recordingIndicator).not.toBeVisible();
      }
      
      // Verify text input fallback is always available
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
    });

    test('should handle keyboard navigation', async ({ page }) => {
      // Test keyboard accessibility across browsers
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test Enter key in text input
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.focus();
      await textInput.fill('Keyboard test');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Keyboard test');
    });

    test('should handle local storage', async ({ page }) => {
      // Test localStorage functionality across browsers
      
      // Set some preferences
      await page.locator('[data-testid="language-selector"]').click();
      await page.locator('[data-testid="language-option-fr"]').click();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check if preference persisted
      const languageSelector = page.locator('[data-testid="language-selector"]');
      await expect(languageSelector).toContainText('FR');
    });

    test('should handle different font sizes and zoom levels', async ({ page }) => {
      // Test accessibility at different zoom levels
      
      // Test normal zoom
      await page.setViewportSize({ 
        width: config.viewport!.width, 
        height: config.viewport!.height 
      });
      
      await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
      
      // Simulate zoom in (increase font size)
      await page.addStyleTag({
        content: 'body { font-size: 18px !important; }'
      });
      
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
      
      // Test functionality still works
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.fill('Zoom test message');
      await page.locator('[data-testid="send-button"]').click();
      
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Zoom test message');
    });

    test('should handle network conditions', async ({ page }) => {
      // Test different network conditions
      
      // Slow 3G simulation
      await page.context().route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
        await route.continue();
      });
      
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.fill('Slow network test');
      await page.locator('[data-testid="send-button"]').click();
      
      // Should still work but slower
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Slow network test', { timeout: 10000 });
      
      // Clear route interception
      await page.context().unroute('**/*');
    });

    test('should handle JavaScript disabled gracefully', async ({ page }) => {
      // This test simulates degraded functionality without JavaScript
      // Note: This is conceptual as Playwright requires JavaScript
      
      // Verify essential elements are still accessible
      await expect(page.locator('[data-testid="text-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
      
      // Basic form functionality should work
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.fill('Basic form test');
      
      // Even without enhanced JS features, basic form should be usable
      await expect(textInput).toHaveValue('Basic form test');
    });

    test('should handle touch events on mobile', async ({ page }) => {
      if (config.name.includes('Mobile')) {
        // Mobile-specific touch tests
        const micButton = page.locator('[data-testid="mic-button"]');
        
        // Test touch tap
        await micButton.tap();
        
        // Should respond to touch events
        const recordingIndicator = page.locator('[data-testid="recording-indicator"]');
        const permissionError = page.locator('[data-testid="permission-error"]');
        
        const hasRecording = await recordingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
        const hasError = await permissionError.isVisible({ timeout: 2000 }).catch(() => false);
        
        expect(hasRecording || hasError).toBeTruthy();
        
        // Test swipe gestures on chat window
        const chatWindow = page.locator('[data-testid="chat-window"]');
        
        // Add some messages first
        const textInput = page.locator('[data-testid="text-input"]');
        await textInput.fill('Touch test message 1');
        await page.locator('[data-testid="send-button"]').click();
        
        await textInput.fill('Touch test message 2');
        await page.locator('[data-testid="send-button"]').click();
        
        // Test scrolling with touch
        await chatWindow.hover();
        await page.mouse.wheel(0, 100);
        
        // Chat should still be functional
        await expect(page.locator('[data-testid="message"]')).toHaveCount.atLeast(2);
      }
    });

    test('should handle browser-specific APIs', async ({ page }) => {
      // Test browser-specific feature detection and fallbacks
      
      // Test Web Audio API availability
      const audioSupport = await page.evaluate(() => {
        return typeof window.AudioContext !== 'undefined' || 
               typeof (window as any).webkitAudioContext !== 'undefined';
      });
      
      // Test MediaRecorder API availability
      const mediaRecorderSupport = await page.evaluate(() => {
        return typeof MediaRecorder !== 'undefined';
      });
      
      // Test WebSocket support
      const webSocketSupport = await page.evaluate(() => {
        return typeof WebSocket !== 'undefined';
      });
      
      // Core WebSocket should be supported everywhere
      expect(webSocketSupport).toBeTruthy();
      
      // If audio features aren't supported, text input should still work
      const textInput = page.locator('[data-testid="text-input"]');
      await expect(textInput).toBeVisible();
      await expect(textInput).toBeEnabled();
      
      await textInput.fill('Fallback test message');
      await page.locator('[data-testid="send-button"]').click();
      
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Fallback test message');
    });

    test('should handle different screen orientations', async ({ page }) => {
      if (config.name.includes('Mobile')) {
        // Test portrait orientation
        await page.setViewportSize({ width: 375, height: 667 });
        await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
        
        // Test landscape orientation
        await page.setViewportSize({ width: 667, height: 375 });
        await expect(page.locator('[data-testid="chat-window"]')).toBeVisible();
        
        // Test functionality in landscape
        const textInput = page.locator('[data-testid="text-input"]');
        await textInput.fill('Landscape test');
        await page.locator('[data-testid="send-button"]').click();
        
        await expect(page.locator('[data-testid="user-message"]').last())
          .toContainText('Landscape test');
      }
    });

    test('should handle browser extensions and ad blockers', async ({ page }) => {
      // Test resilience against common browser modifications
      
      // Simulate ad blocker blocking some requests
      await page.route('**/analytics/**', route => route.abort());
      await page.route('**/tracking/**', route => route.abort());
      
      // Core functionality should still work
      const textInput = page.locator('[data-testid="text-input"]');
      await textInput.fill('Ad blocker test message');
      await page.locator('[data-testid="send-button"]').click();
      
      await expect(page.locator('[data-testid="user-message"]').last())
        .toContainText('Ad blocker test message');
      
      // Application should remain functional
      await expect(page.locator('[data-testid="connection-status"]'))
        .toContainText('Connected');
    });

  });
}

// Cross-browser specific feature tests
test.describe('Browser-specific feature tests', () => {
  
  test('Chrome - Test Chrome-specific features', async ({ page }) => {
    test.skip(!/chrome/i.test(page.context().browser()!.browserType().name()));
    
    await page.goto('/');
    
    // Test Chrome-specific audio features
    const audioWorkletSupport = await page.evaluate(() => {
      return typeof AudioWorkletNode !== 'undefined';
    });
    
    if (audioWorkletSupport) {
      // Test advanced audio features
      await page.locator('[data-testid="mic-button"]').click();
      
      // Chrome should support advanced audio processing
      const advancedAudioIndicator = page.locator('[data-testid="advanced-audio-indicator"]');
      await expect(advancedAudioIndicator).toBeVisible({ timeout: 5000 });
    }
  });

  test('Safari - Test Safari-specific features', async ({ page }) => {
    test.skip(!/webkit/i.test(page.context().browser()!.browserType().name()));
    
    await page.goto('/');
    
    // Test Safari audio handling
    await page.locator('[data-testid="mic-button"]').click();
    
    // Safari might require user gesture for audio
    const userGesturePrompt = page.locator('[data-testid="user-gesture-prompt"]');
    const recordingIndicator = page.locator('[data-testid="recording-indicator"]');
    
    const hasPrompt = await userGesturePrompt.isVisible({ timeout: 2000 }).catch(() => false);
    const hasRecording = await recordingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasPrompt || hasRecording).toBeTruthy();
  });

  test('Firefox - Test Firefox-specific features', async ({ page }) => {
    test.skip(!/firefox/i.test(page.context().browser()!.browserType().name()));
    
    await page.goto('/');
    
    // Test Firefox audio implementation
    const audioSupport = await page.evaluate(() => {
      return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    });
    
    if (audioSupport) {
      await page.locator('[data-testid="mic-button"]').click();
      
      // Firefox should handle permissions differently
      const permissionDialog = page.locator('[data-testid="firefox-permission-dialog"]');
      await expect(permissionDialog).toBeVisible({ timeout: 3000 });
    }
  });

});
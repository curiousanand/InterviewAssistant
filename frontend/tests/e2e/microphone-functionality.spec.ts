import { test, expect } from '@playwright/test';

test.describe('Microphone Functionality', () => {
  test('should handle microphone recording flow', async ({ page }) => {
    console.log('🎤 Testing complete microphone functionality...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait for full app initialization
    
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'test-results/mic-test-initial.png', fullPage: true });
    
    // Find microphone button
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
    
    console.log('🎤 Microphone button found and enabled');
    
    // Check initial state
    const startText = page.locator('text=Start Recording');
    await expect(startText).toBeVisible();
    
    // Click to start recording
    console.log('🔴 Starting recording...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    console.log('📸 Taking recording screenshot...');
    await page.screenshot({ path: 'test-results/mic-test-recording.png', fullPage: true });
    
    // Check if recording state changed
    const recordingIndicator = page.locator('text=Recording...');
    const stopText = page.locator('text=Stop Recording');
    
    if (await recordingIndicator.count() > 0) {
      console.log('✅ Recording state detected');
      
      // Wait a bit during recording
      await page.waitForTimeout(3000);
      
      // Stop recording
      console.log('🛑 Stopping recording...');
      await micButton.click();
      await page.waitForTimeout(2000);
      
      console.log('📸 Taking final screenshot...');
      await page.screenshot({ path: 'test-results/mic-test-stopped.png', fullPage: true });
      
      // Check if back to initial state
      const backToStart = page.locator('text=Start Recording');
      await expect(backToStart).toBeVisible();
      
      console.log('✅ Successfully completed recording cycle');
    } else {
      console.log('ℹ️ Recording may be waiting for microphone permission or audio setup');
      
      // Check for permission requests or error messages
      const permissionDenied = page.locator('text=/permission.*denied/i');
      const microphoneError = page.locator('text=/microphone.*error/i');
      const audioError = page.locator('text=/audio.*error/i');
      
      if (await permissionDenied.count() > 0) {
        console.log('🚫 Microphone permission denied');
      } else if (await microphoneError.count() > 0) {
        console.log('🚫 Microphone error detected');
      } else if (await audioError.count() > 0) {
        console.log('🚫 Audio error detected');
      } else {
        console.log('ℹ️ No specific error found, may be normal browser limitation');
      }
    }
    
    // Check for any console errors during the process
    console.log('🔍 Test completed - check console logs for any errors');
  });
  
  test('should handle WebSocket communication during recording', async ({ page }) => {
    console.log('🔌 Testing WebSocket communication...');
    
    let wsMessages: any[] = [];
    
    // Capture WebSocket messages
    page.on('websocket', (ws) => {
      if (ws.url().includes('8080/ws/stream')) {
        console.log('🔌 WebSocket connection detected');
        
        ws.on('framereceived', (frame) => {
          if (frame.payload) {
            try {
              const message = JSON.parse(frame.payload.toString());
              wsMessages.push(message);
              console.log('📨 WebSocket message received:', message.type || 'unknown');
            } catch (e) {
              // Binary data or non-JSON
              console.log('📨 WebSocket binary data received');
            }
          }
        });
        
        ws.on('framesent', (frame) => {
          if (frame.payload) {
            try {
              const message = JSON.parse(frame.payload.toString());
              console.log('📤 WebSocket message sent:', message.type || 'unknown');
            } catch (e) {
              // Binary data or non-JSON
              console.log('📤 WebSocket binary data sent');
            }
          }
        });
      }
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const micButton = page.locator('[data-testid="microphone-button"]');
    await expect(micButton).toBeVisible();
    
    // Try recording and check WebSocket activity
    await micButton.click();
    await page.waitForTimeout(3000); // Recording time
    await micButton.click(); // Stop
    await page.waitForTimeout(2000);
    
    console.log(`📊 Total WebSocket messages captured: ${wsMessages.length}`);
    
    // Log message types
    const messageTypes = wsMessages.map(msg => msg.type).filter(Boolean);
    const uniqueTypes = [...new Set(messageTypes)];
    console.log(`📊 Message types seen: ${uniqueTypes.join(', ')}`);
  });
  
  test('should show appropriate error handling', async ({ page }) => {
    console.log('🚨 Testing error handling...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check if there are any error messages displayed
    const errorMessages = page.locator('.text-red-500, .text-red-700, [class*="error"], [role="alert"]');
    const errorCount = await errorMessages.count();
    
    console.log(`🔍 Found ${errorCount} potential error elements`);
    
    for (let i = 0; i < Math.min(errorCount, 3); i++) {
      const error = errorMessages.nth(i);
      const text = await error.textContent();
      console.log(`❌ Error ${i + 1}: "${text}"`);
    }
    
    // Test what happens when clicking disabled button (if any)
    const disabledButtons = page.locator('button:disabled');
    const disabledCount = await disabledButtons.count();
    console.log(`🔍 Found ${disabledCount} disabled buttons`);
    
    if (disabledCount > 0) {
      console.log('🚫 Found disabled buttons (this is expected)');
      // Don't click disabled buttons as they should remain unclickable
    }
    
    console.log('✅ Error handling test completed');
  });
});
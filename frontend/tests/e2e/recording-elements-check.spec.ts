import { test, expect } from '@playwright/test';

test.describe('Recording Elements Check', () => {
  test('should not have duplicate recording elements', async ({ page }) => {
    console.log('🔍 Checking for duplicate recording elements...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the app to load
    await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 10000 });
    
    // Wait a moment for WebSocket connection
    await page.waitForTimeout(2000);
    
    console.log('📱 App loaded, checking for recording-related elements...');
    
    // Check how many elements contain "Recording" text
    const recordingElements = await page.locator('text="Recording"').count();
    const recordingTextElements = await page.locator(':has-text("Recording")').count();
    
    console.log(`📊 Elements with "Recording" text: ${recordingElements}`);
    console.log(`📊 Elements containing "Recording": ${recordingTextElements}`);
    
    // Get all elements that have "Recording" in their text
    const allRecordingElements = await page.locator(':has-text("Recording")').all();
    
    for (let i = 0; i < allRecordingElements.length; i++) {
      const element = allRecordingElements[i];
      const text = await element.textContent();
      const className = await element.getAttribute('class');
      const tagName = await element.evaluate(el => el.tagName);
      
      console.log(`📝 Recording element ${i + 1}: ${tagName} - "${text?.trim()}" - class: "${className}"`);
    }
    
    // Click the microphone to start recording
    console.log('🎤 Clicking microphone button to start recording...');
    await page.click('[data-testid="microphone-button"]');
    
    // Wait for recording state to update
    await page.waitForTimeout(1000);
    
    // Count recording status indicators when recording
    const activeRecordingElements = await page.locator('text="Recording..."').count();
    const recordingDots = await page.locator('div:has-text("Recording...") div.bg-red-500').count();
    
    console.log(`🔴 Active "Recording..." elements: ${activeRecordingElements}`);
    console.log(`🔴 Red recording dots: ${recordingDots}`);
    
    // Get details of active recording elements
    const activeElements = await page.locator('text="Recording..."').all();
    
    for (let i = 0; i < activeElements.length; i++) {
      const element = activeElements[i];
      const text = await element.textContent();
      const className = await element.getAttribute('class');
      const parentClass = await element.locator('..').getAttribute('class');
      
      console.log(`🔍 Active recording element ${i + 1}: "${text?.trim()}" - class: "${className}" - parent: "${parentClass}"`);
    }
    
    // There should be exactly 1 "Recording..." element when recording
    expect(activeRecordingElements).toBe(1);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/recording-elements-check.png', fullPage: true });
    console.log('📸 Screenshot saved to test-results/recording-elements-check.png');
    
    console.log('✅ Recording elements check completed');
  });
});
import { test, expect } from '@playwright/test';

test.describe('Debug Second Recording Issue', () => {
  test('should check console logs for second recording attempt', async ({ page }) => {
    console.log('🎤 Starting debug test for second recording issue...');
    
    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('audio capture failed') || 
          text.includes('demo mode') || 
          text.includes('Audio capture') ||
          text.includes('Starting audio capture') ||
          text.includes('recording')) {
        console.log(`🔍 RELEVANT LOG: [${msg.type()}] ${text}`);
      }
    });
    
    // Navigate and wait for app to load
    await page.goto('http://localhost:3000');
    await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const micButton = page.locator('[data-testid="microphone-button"]');
    
    // First recording cycle
    console.log('🎤 STEP 1: Starting first recording...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    console.log('🛑 STEP 2: Stopping first recording...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    // Second recording cycle - this is where the issue should appear
    console.log('🎤 STEP 3: Starting second recording (where issue occurs)...');
    await micButton.click();
    await page.waitForTimeout(3000); // Give more time to see the error
    
    console.log('🛑 STEP 4: Stopping second recording...');
    await micButton.click();
    await page.waitForTimeout(1000);
    
    console.log('✅ Debug test completed');
  });
});
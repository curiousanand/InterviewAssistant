import { test, expect } from '@playwright/test';

test.describe('Microphone Button Console Monitoring', () => {
  test('should capture console logs when clicking microphone button', async ({ page }) => {
    // Array to store all console messages
    const consoleLogs: { type: string; text: string; location?: string }[] = [];
    
    // Listen to all console events
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      consoleLogs.push({
        type,
        text,
        location: location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined
      });
      
      // Print errors and warnings immediately
      if (type === 'error' || type === 'warning') {
        console.log(`[${type.toUpperCase()}] ${text}`);
        if (location) {
          console.log(`  at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
        }
      }
    });

    // Also capture page errors
    page.on('pageerror', (error) => {
      console.log('[PAGE ERROR]', error.message);
      consoleLogs.push({
        type: 'pageerror',
        text: error.message
      });
    });

    // Navigate to the application
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for the page to be ready
    await page.waitForTimeout(3000);
    
    console.log('\n=== Initial Page Load Complete ===\n');
    
    // Look for the microphone button
    const micButton = page.locator('button:has-text("Start Recording"), button:has-text("Stop Recording"), button[aria-label*="microphone"], button[aria-label*="record"], [data-testid*="mic"], [data-testid*="record"], button:has(svg), button').first();
    
    // Check if button exists
    const buttonExists = await micButton.count() > 0;
    console.log(`Microphone button found: ${buttonExists}`);
    
    if (buttonExists) {
      // Get initial button state
      const initialText = await micButton.textContent();
      console.log(`Initial button text: "${initialText}"`);
      
      // Clear console logs before first click
      consoleLogs.length = 0;
      
      console.log('\n=== FIRST CLICK: Starting Recording ===\n');
      
      // First click - should start recording
      await micButton.click();
      console.log('Clicked microphone button - waiting for recording to start...');
      await page.waitForTimeout(3000); // Wait to see if recording starts
      
      // Check if listening state changed
      const listeningState = await page.evaluate(() => {
        return (window as any).__conversationState?.isListening;
      });
      console.log(`Listening state after first click: ${listeningState}`);
      
      // Print all console logs after first click
      console.log('Console logs after starting recording:');
      consoleLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
      
      // Check button state after first click
      const afterFirstClickText = await micButton.textContent();
      console.log(`\nButton text after first click: "${afterFirstClickText}"`);
      
      // Clear logs for second click
      consoleLogs.length = 0;
      
      console.log('\n=== SECOND CLICK: Attempting to Stop Recording ===\n');
      
      // Second click - should stop recording
      await micButton.click();
      await page.waitForTimeout(3000); // Wait to see if recording stops
      
      // Print all console logs after second click
      console.log('Console logs after stopping recording:');
      consoleLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
      
      // Check button state after second click
      const afterSecondClickText = await micButton.textContent();
      console.log(`\nButton text after second click: "${afterSecondClickText}"`);
      
      // Clear logs for third click
      consoleLogs.length = 0;
      
      console.log('\n=== THIRD CLICK: Testing Toggle Again ===\n');
      
      // Third click - test if it can start again
      await micButton.click();
      await page.waitForTimeout(3000);
      
      // Print all console logs after third click
      console.log('Console logs after third click:');
      consoleLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
      
      const afterThirdClickText = await micButton.textContent();
      console.log(`\nButton text after third click: "${afterThirdClickText}"`);
      
      // Summary of errors
      const errors = consoleLogs.filter(log => log.type === 'error' || log.type === 'pageerror');
      if (errors.length > 0) {
        console.log('\n=== SUMMARY OF ERRORS ===');
        errors.forEach(err => {
          console.log(`[${err.type}] ${err.text}`);
        });
      } else {
        console.log('\n=== No errors detected ===');
      }
      
    } else {
      console.log('ERROR: Could not find microphone button on the page');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'microphone-button-not-found.png' });
      console.log('Screenshot saved as microphone-button-not-found.png');
      
      // Log the page structure
      const pageContent = await page.content();
      console.log('\nPage buttons found:');
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const text = await button.textContent();
        console.log(`  - "${text}"`);
      }
    }
    
    // Keep the browser open for manual inspection
    await page.waitForTimeout(5000);
  });
});
import { test, expect } from '@playwright/test';

test.describe('Microphone State Issue Investigation', () => {
  test('should reproduce microphone recording state issue', async ({ page }) => {
    console.log('🎤 Starting microphone state issue investigation...');
    
    // Listen to all console messages for debugging
    page.on('console', msg => {
      if (msg.type() === 'log') {
        console.log(`📝 CONSOLE LOG: [${msg.type()}] ${msg.text()}`);
      } else if (msg.type() === 'error') {
        console.log(`🔴 CONSOLE ERROR: [${msg.type()}] ${msg.text()}`);
      } else if (msg.type() === 'warn') {
        console.log(`🟡 CONSOLE WARNING: [${msg.type()}] ${msg.text()}`);
      }
    });
    
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the app to load and WebSocket to connect
    await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 15000 });
    await page.waitForTimeout(3000); // Wait for WebSocket connection
    
    console.log('✅ App loaded, starting microphone state test sequence...');
    
    const micButton = page.locator('[data-testid="microphone-button"]');
    
    // Step 1: First recording attempt
    console.log('🎤 Step 1: First click - Start recording');
    await micButton.click();
    
    // Wait for recording to start
    await page.waitForTimeout(1000);
    
    // Check if recording started
    const isRecording1 = await page.locator('text="Recording..."').count();
    console.log(`📊 Recording status after first click: ${isRecording1 > 0 ? 'RECORDING' : 'NOT RECORDING'}`);
    
    // Step 2: Stop recording
    console.log('🛑 Step 2: Second click - Stop recording');
    await micButton.click();
    
    // Wait for recording to stop
    await page.waitForTimeout(1000);
    
    // Check if recording stopped
    const isRecording2 = await page.locator('text="Recording..."').count();
    console.log(`📊 Recording status after stop: ${isRecording2 > 0 ? 'STILL RECORDING' : 'STOPPED'}`);
    
    // Step 3: Wait 1 second and try to start recording again (the problematic scenario)
    console.log('⏱️ Step 3: Waiting 1 second before next attempt...');
    await page.waitForTimeout(1000);
    
    console.log('🎤 Step 4: Third click - Attempt to start recording again');
    await micButton.click();
    
    // Wait for potential recording start
    await page.waitForTimeout(1500);
    
    // Check if recording started on second attempt
    const isRecording3 = await page.locator('text="Recording..."').count();
    console.log(`📊 Recording status after third click: ${isRecording3 > 0 ? 'RECORDING' : 'NOT RECORDING'}`);
    
    if (isRecording3 === 0) {
      console.log('🔴 ISSUE REPRODUCED: Recording did not start on second attempt!');
      
      // Try one more time (the workaround)
      console.log('🎤 Step 5: Fourth click - Second workaround attempt');
      await micButton.click();
      await page.waitForTimeout(500);
      
      console.log('🎤 Step 6: Fifth click - Third attempt after pause');
      await micButton.click();
      await page.waitForTimeout(1000);
      
      const isRecording4 = await page.locator('text="Recording..."').count();
      console.log(`📊 Recording status after workaround: ${isRecording4 > 0 ? 'RECORDING' : 'NOT RECORDING'}`);
      
      if (isRecording4 > 0) {
        console.log('✅ WORKAROUND CONFIRMED: Multiple clicks needed to restart recording');
      }
    } else {
      console.log('✅ No issue detected - recording started normally on second attempt');
    }
    
    // Capture button state information
    const buttonText = await page.locator('[data-testid="microphone-button"]').getAttribute('aria-label');
    const buttonClass = await page.locator('[data-testid="microphone-button"]').getAttribute('class');
    
    console.log(`🔍 Final button state: aria-label="${buttonText}", class="${buttonClass}"`);
    
    // Take screenshot for visual inspection
    await page.screenshot({ 
      path: 'test-results/microphone-state-issue.png', 
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved to test-results/microphone-state-issue.png');
    
    // Let's also check the recording state from the hook/component
    const recordingStates = await page.evaluate(() => {
      // Try to access the recording state from the window if it's exposed
      return {
        timestamp: new Date().toISOString(),
        hasRecordingElement: !!document.querySelector('text="Recording..."'),
        micButtonState: document.querySelector('[data-testid="microphone-button"]')?.getAttribute('aria-label'),
        totalRecordingElements: document.querySelectorAll(':has-text("Recording")').length
      };
    });
    
    console.log('📊 Final state analysis:', JSON.stringify(recordingStates, null, 2));
    
    console.log('🏁 Microphone state issue investigation completed');
  });
});
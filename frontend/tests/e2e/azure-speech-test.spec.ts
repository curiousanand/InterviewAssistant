import { test, expect } from '@playwright/test';

test.describe('Azure Speech Service Integration Test', () => {
  test('should test Azure Speech Service with console logs', async ({ page }) => {
    console.log('🧪 Starting Azure Speech Service integration test...');
    
    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      if (type === 'error') {
        console.log(`🔴 CONSOLE ERROR: ${text}`);
      } else if (type === 'warn') {
        console.log(`🟡 CONSOLE WARNING: ${text}`);
      } else if (text.includes('Azure') || 
                 text.includes('Speech') || 
                 text.includes('transcript') || 
                 text.includes('recording') ||
                 text.includes('WebSocket') ||
                 text.includes('audio') ||
                 text.includes('failed') ||
                 text.includes('error')) {
        console.log(`📝 RELEVANT LOG: [${type}] ${text}`);
      }
    });

    // Capture network failures
    page.on('requestfailed', request => {
      console.log(`🌐 NETWORK FAILED: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Capture JavaScript exceptions
    page.on('pageerror', exception => {
      console.log(`💥 JS EXCEPTION: ${exception.message}`);
    });
    
    console.log('🌐 Navigating to the application...');
    await page.goto('http://localhost:3000');
    
    console.log('⏳ Waiting for microphone button...');
    await page.waitForSelector('[data-testid="microphone-button"]', { timeout: 15000 });
    
    console.log('⏳ Waiting for WebSocket connection...');
    await page.waitForTimeout(3000);
    
    const micButton = page.locator('[data-testid="microphone-button"]');
    
    console.log('🎤 Clicking microphone button to start recording...');
    await micButton.click();
    
    console.log('⏳ Waiting for recording to start...');
    await page.waitForTimeout(3000);
    
    // Check if recording started
    const recordingElements = await page.locator('text="Recording..."').count();
    console.log(`📊 Recording elements found: ${recordingElements}`);
    
    // Check for live transcription bubble
    const transcriptionBubble = await page.locator('text="Live Transcription"').count();
    console.log(`💬 Live transcription bubble found: ${transcriptionBubble}`);
    
    // Check microphone button state
    const buttonAriaLabel = await micButton.getAttribute('aria-label');
    const buttonClass = await micButton.getAttribute('class');
    console.log(`🎤 Button state - aria-label: "${buttonAriaLabel}", class includes red: ${buttonClass?.includes('red')}`);
    
    console.log('🛑 Clicking microphone button to stop recording...');
    await micButton.click();
    
    console.log('⏳ Waiting for recording to stop...');
    await page.waitForTimeout(2000);
    
    // Check final state
    const finalRecordingElements = await page.locator('text="Recording..."').count();
    console.log(`📊 Recording elements after stop: ${finalRecordingElements}`);
    
    // Look for any error messages
    const errorMessages = await page.locator('[role="alert"], .error, .text-red').count();
    console.log(`❌ Error messages found: ${errorMessages}`);
    
    // Check connection state
    const connectionStatus = await page.locator('text="Connected"').count();
    const disconnectedStatus = await page.locator('text="Disconnected"').count();
    console.log(`🔌 Connection status - Connected: ${connectionStatus}, Disconnected: ${disconnectedStatus}`);
    
    // Take screenshot for visual inspection
    await page.screenshot({ 
      path: 'test-results/azure-speech-test.png', 
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved to test-results/azure-speech-test.png');
    console.log('🏁 Azure Speech Service test completed');
    
    // Try to extract any additional state information
    const diagnostics = await page.evaluate(() => {
      return {
        hasAudioContext: typeof AudioContext !== 'undefined',
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        protocol: location.protocol,
        hostname: location.hostname,
        wsUrl: (window as any).NEXT_PUBLIC_WS_URL || 'not set',
        timestamp: new Date().toISOString()
      };
    });
    
    console.log('🔍 Browser diagnostics:', JSON.stringify(diagnostics, null, 2));
  });
});
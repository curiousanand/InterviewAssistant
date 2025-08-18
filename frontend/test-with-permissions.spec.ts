import { test, expect } from '@playwright/test';

// Configure browser to auto-grant microphone permission
test.use({
  permissions: ['microphone'],
});

test('Test with microphone permission granted', async ({ page }) => {
  const logs: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    logs.push(text);
    console.log(`[${msg.type()}] ${text}`);
  });

  console.log('Navigating to page with microphone permission pre-granted...');
  await page.goto('http://localhost:3000');
  
  console.log('Waiting for initialization...');
  
  // Wait for the orchestrator to fully initialize
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText;
    return !bodyText.includes('Initializing Interview Assistant');
  }, { timeout: 30000 }).catch(() => {
    console.log('Warning: Page still showing loading screen after 30 seconds');
  });
  
  await page.waitForTimeout(2000);
  
  console.log('\n=== Checking page state ===');
  
  // Check if mic button exists
  const micButton = page.locator('[data-testid="mic-button"]');
  const buttonExists = await micButton.count() > 0;
  console.log('Microphone button found:', buttonExists);
  
  // Check if settings panel is visible
  const settingsPanel = page.locator('[data-testid="settings-panel"]');
  const settingsVisible = await settingsPanel.count() > 0;
  console.log('Settings panel visible:', settingsVisible);
  
  if (buttonExists) {
    console.log('\n=== Testing microphone button clicks ===');
    
    // First click - start recording
    console.log('Click 1: Starting recording...');
    await micButton.click();
    await page.waitForTimeout(3000);
    
    // Check if recording started
    const isRecording1 = await page.evaluate(() => {
      return (window as any).__conversationState?.isListening || false;
    });
    console.log('Recording after first click:', isRecording1);
    
    // Second click - stop recording
    console.log('\nClick 2: Stopping recording...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    const isRecording2 = await page.evaluate(() => {
      return (window as any).__conversationState?.isListening || false;
    });
    console.log('Recording after second click:', isRecording2);
    
    // Third click - restart recording
    console.log('\nClick 3: Restarting recording...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    const isRecording3 = await page.evaluate(() => {
      return (window as any).__conversationState?.isListening || false;
    });
    console.log('Recording after third click:', isRecording3);
    
    console.log('\n=== Test Summary ===');
    console.log('✅ Microphone button found and clickable');
    console.log(`${isRecording1 ? '✅' : '❌'} First click started recording`);
    console.log(`${!isRecording2 ? '✅' : '❌'} Second click stopped recording`);
    console.log(`${isRecording3 ? '✅' : '❌'} Third click restarted recording`);
    console.log(`${!settingsVisible ? '✅' : '❌'} Settings panel not auto-opening`);
  } else {
    console.log('❌ Microphone button not found - page may not have loaded correctly');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-no-mic-button.png' });
    console.log('Screenshot saved to debug-no-mic-button.png');
  }
  
  console.log('\n=== All console logs from initialization ===');
  const initLogs = logs.filter(log => 
    log.includes('orchestrator') || 
    log.includes('audio') || 
    log.includes('permission') ||
    log.includes('Microphone')
  );
  initLogs.forEach(log => console.log(log));
});
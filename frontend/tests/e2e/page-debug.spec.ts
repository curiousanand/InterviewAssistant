import { test, expect } from '@playwright/test';

test('Debug page elements', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Extra wait for app initialization
  
  console.log('🔍 Taking screenshot...');
  await page.screenshot({ path: 'test-results/page-debug.png', fullPage: true });
  
  console.log('🔍 Looking for all buttons...');
  const allButtons = page.locator('button');
  const buttonCount = await allButtons.count();
  console.log(`Found ${buttonCount} buttons total`);
  
  for (let i = 0; i < buttonCount; i++) {
    const button = allButtons.nth(i);
    const text = await button.textContent();
    const testId = await button.getAttribute('data-testid');
    const ariaLabel = await button.getAttribute('aria-label');
    const className = await button.getAttribute('class');
    
    console.log(`Button ${i + 1}:`);
    console.log(`  Text: "${text}"`);
    console.log(`  data-testid: "${testId}"`);
    console.log(`  aria-label: "${ariaLabel}"`);
    console.log(`  class: "${className}"`);
    console.log('');
  }
  
  console.log('🔍 Looking for microphone button specifically...');
  const micButton = page.locator('[data-testid="microphone-button"]');
  const micButtonCount = await micButton.count();
  console.log(`Microphone buttons found: ${micButtonCount}`);
  
  if (micButtonCount > 0) {
    const isVisible = await micButton.isVisible();
    const isEnabled = await micButton.isEnabled();
    console.log(`Microphone button visible: ${isVisible}`);
    console.log(`Microphone button enabled: ${isEnabled}`);
  }
  
  console.log('🔍 Looking for any element with "microphone" text...');
  const micText = page.locator('text=/microphone/i');
  const micTextCount = await micText.count();
  console.log(`Elements with "microphone" text: ${micTextCount}`);
  
  console.log('🔍 Looking for recording related elements...');
  const recordingElements = page.locator('text=/record/i');
  const recordingCount = await recordingElements.count();
  console.log(`Elements with "record" text: ${recordingCount}`);
  
  for (let i = 0; i < Math.min(recordingCount, 5); i++) {
    const element = recordingElements.nth(i);
    const text = await element.textContent();
    console.log(`Recording element ${i + 1}: "${text}"`);
  }
});
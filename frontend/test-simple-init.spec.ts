import { test, expect } from '@playwright/test';

test('Check orchestrator initialization', async ({ page }) => {
  const logs: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    logs.push(text);
    console.log(`[${msg.type()}] ${text}`);
  });

  console.log('Navigating to page...');
  await page.goto('http://localhost:3000');
  
  console.log('Waiting 15 seconds for initialization and microphone permission...');
  console.log('Please grant microphone permission when prompted!');
  await page.waitForTimeout(15000);
  
  console.log('\n=== All console logs ===');
  logs.forEach(log => console.log(log));
  
  const hasInitLog = logs.some(log => log.includes('useEffect for orchestrator initialization'));
  const hasOrchestratorInit = logs.some(log => log.includes('Initializing conversation orchestration system'));
  
  console.log('\n=== Summary ===');
  console.log('useEffect triggered:', hasInitLog);
  console.log('Orchestrator initialization started:', hasOrchestratorInit);
  
  // Click the mic button
  console.log('\n=== Clicking microphone button ===');
  const micButton = page.locator('[data-testid="mic-button"]').first();
  
  if (await micButton.count() > 0) {
    await micButton.click();
    await page.waitForTimeout(3000);
    
    console.log('\n=== Logs after button click ===');
    logs.forEach(log => console.log(log));
  } else {
    console.log('Microphone button not found');
  }
});
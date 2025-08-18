import { test, expect } from '@playwright/test';

test.describe('Console Log Analysis', () => {
  let consoleMessages: any[] = [];
  let consoleErrors: any[] = [];
  let consoleWarnings: any[] = [];
  let networkErrors: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear arrays for each test
    consoleMessages = [];
    consoleErrors = [];
    consoleWarnings = [];
    networkErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      };
      
      consoleMessages.push(message);
      
      if (msg.type() === 'error') {
        consoleErrors.push(message);
        console.log('🔴 Console Error:', message);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(message);
        console.log('🟡 Console Warning:', message);
      } else if (msg.type() === 'log' || msg.type() === 'info') {
        console.log('ℹ️ Console Log:', message);
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      consoleErrors.push(errorInfo);
      console.log('🔴 Page Error:', errorInfo);
    });

    // Capture network failures
    page.on('requestfailed', (request) => {
      const networkError = {
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      };
      networkErrors.push(networkError);
      console.log('🌐 Network Error:', networkError);
    });

    // Capture WebSocket events
    page.on('websocket', (ws) => {
      console.log('🔌 WebSocket opened:', ws.url());
      
      ws.on('close', () => console.log('🔌 WebSocket closed:', ws.url()));
      ws.on('socketerror', (error) => {
        console.log('🔌 WebSocket error:', error);
        networkErrors.push({
          type: 'websocket',
          url: ws.url(),
          error: error,
          timestamp: new Date().toISOString()
        });
      });
    });
  });

  test('should load homepage and capture all console activity', async ({ page }) => {
    console.log('🚀 Starting homepage test...');
    
    // Navigate to the homepage
    await page.goto('http://localhost:3000');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Additional wait for any async operations
    
    console.log('\n📊 CONSOLE ACTIVITY SUMMARY:');
    console.log(`Total messages: ${consoleMessages.length}`);
    console.log(`Errors: ${consoleErrors.length}`);
    console.log(`Warnings: ${consoleWarnings.length}`);
    console.log(`Network failures: ${networkErrors.length}`);
    
    // Check if page loaded successfully
    expect(page.url()).toBe('http://localhost:3000/');
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/homepage-initial.png', fullPage: true });
  });

  test('should test microphone button interaction', async ({ page }) => {
    console.log('🎤 Testing microphone functionality...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait for app initialization
    
    // Look for microphone button
    const micButton = page.locator('[data-testid="microphone-button"]').first();
    
    if (await micButton.count() > 0) {
      console.log('🎤 Microphone button found, attempting to click...');
      await micButton.click();
      await page.waitForTimeout(2000);
      
      // Try to stop recording
      const stopButton = page.locator('[data-testid="stop-button"], button:has-text("Stop"), button[aria-label*="stop"]').first();
      if (await stopButton.count() > 0) {
        await stopButton.click();
        console.log('🛑 Stop button clicked');
      }
    } else {
      console.log('🚫 No microphone button found');
    }
    
    await page.screenshot({ path: 'test-results/microphone-test.png', fullPage: true });
  });

  test('should test WebSocket connection', async ({ page }) => {
    console.log('🔌 Testing WebSocket connection...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for potential WebSocket connections
    await page.waitForTimeout(5000);
    
    // Try to trigger WebSocket connection by interacting with the app
    const connectButton = page.locator('button:has-text("Connect"), button:has-text("Start"), [data-testid="connect-button"]').first();
    if (await connectButton.count() > 0) {
      await connectButton.click();
      await page.waitForTimeout(3000);
    }
    
    await page.screenshot({ path: 'test-results/websocket-test.png', fullPage: true });
  });

  test('should test form interactions and inputs', async ({ page }) => {
    console.log('📝 Testing form interactions...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Look for any input fields
    const inputs = page.locator('input, textarea');
    const inputCount = await inputs.count();
    
    console.log(`📝 Found ${inputCount} input fields`);
    
    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const input = inputs.nth(i);
      const placeholder = await input.getAttribute('placeholder');
      console.log(`📝 Testing input ${i + 1}: ${placeholder || 'no placeholder'}`);
      
      await input.click();
      await input.fill('Test input');
      await page.waitForTimeout(500);
    }
    
    await page.screenshot({ path: 'test-results/form-interactions.png', fullPage: true });
  });

  test.afterEach(async ({ page }) => {
    // Log final summary
    console.log('\n📋 FINAL REPORT:');
    
    if (consoleErrors.length > 0) {
      console.log('\n🔴 ERRORS FOUND:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.text || error.message}`);
        if (error.location) {
          console.log(`   Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
      });
    }
    
    if (consoleWarnings.length > 0) {
      console.log('\n🟡 WARNINGS FOUND:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.text}`);
        if (warning.location) {
          console.log(`   Location: ${warning.location.url}:${warning.location.lineNumber}:${warning.location.columnNumber}`);
        }
      });
    }
    
    if (networkErrors.length > 0) {
      console.log('\n🌐 NETWORK ERRORS:');
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.url} - ${error.failure || error.error}`);
      });
    }
    
    // Save detailed logs to file
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      errors: consoleErrors,
      warnings: consoleWarnings,
      networkErrors: networkErrors,
      allMessages: consoleMessages
    };
    
    // Write report to file (we'll handle this in the test runner)
    console.log('\n💾 Report data ready for analysis');
  });
});
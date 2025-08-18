import { test, expect } from '@playwright/test';

test.describe('Error Detection and Fix', () => {
  let allErrors: any[] = [];
  let allLogs: any[] = [];

  test.beforeEach(async ({ page }) => {
    allErrors = [];
    allLogs = [];

    // Capture all console events
    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      };
      
      allLogs.push(entry);
      
      if (msg.type() === 'error') {
        allErrors.push(entry);
        console.log('🔴 ERROR DETECTED:', entry);
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', (error) => {
      const errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      allErrors.push(errorInfo);
      console.log('🔴 PAGE ERROR:', errorInfo);
    });

    // Capture failed requests
    page.on('requestfailed', (request) => {
      console.log('🌐 FAILED REQUEST:', request.url(), request.failure()?.errorText);
    });
  });

  test('should detect and analyze the TypeError about null type property', async ({ page }) => {
    console.log('🔍 Starting error detection test...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait for app initialization
    
    console.log('📱 Interacting with the application to trigger errors...');
    
    // Try clicking the microphone button
    const micButton = page.locator('[data-testid="microphone-button"]');
    if (await micButton.count() > 0) {
      console.log('🎤 Clicking microphone button...');
      await micButton.click();
      await page.waitForTimeout(3000);
      
      // Stop recording
      await micButton.click();
      await page.waitForTimeout(2000);
    }

    // Try other interactions that might trigger the error
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      try {
        const button = buttons.nth(i);
        if (await button.isVisible() && await button.isEnabled()) {
          console.log(`🔘 Clicking button ${i + 1}...`);
          await button.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        // Continue with other buttons
      }
    }

    console.log('🔍 Analyzing captured errors...');
    
    // Look for the specific error
    const typeErrors = allErrors.filter(error => 
      error.message?.includes('Cannot read properties of null') &&
      error.message?.includes('type')
    );

    if (typeErrors.length > 0) {
      console.log('🎯 FOUND THE TARGET ERROR:');
      typeErrors.forEach((error, index) => {
        console.log(`Error ${index + 1}:`, error);
      });
    } else {
      console.log('ℹ️ Target error not detected in this run');
    }

    console.log(`📊 Total errors captured: ${allErrors.length}`);
    console.log(`📊 Total logs captured: ${allLogs.length}`);

    // Log all errors for analysis
    if (allErrors.length > 0) {
      console.log('\n🔴 ALL DETECTED ERRORS:');
      allErrors.forEach((error, index) => {
        console.log(`\n--- Error ${index + 1} ---`);
        console.log('Message:', error.message || error.text);
        console.log('Location:', error.location || 'Unknown');
        if (error.stack) {
          console.log('Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
      });
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/error-detection.png', fullPage: true });
  });

  test('should test various user flows to reproduce the error', async ({ page }) => {
    console.log('🎮 Testing different user flows...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Test 1: Language settings
    const langButton = page.locator('button[aria-label*="Language"]');
    if (await langButton.count() > 0) {
      console.log('🌐 Testing language settings...');
      await langButton.click();
      await page.waitForTimeout(1000);
    }

    // Test 2: Clear conversation
    const clearButton = page.locator('button[aria-label*="Clear"]');
    if (await clearButton.count() > 0) {
      console.log('🗑️ Testing clear conversation...');
      await clearButton.click();
      await page.waitForTimeout(1000);
    }

    // Test 3: Multiple microphone clicks
    const micButton = page.locator('[data-testid="microphone-button"]');
    if (await micButton.count() > 0) {
      console.log('🎤 Testing rapid microphone clicks...');
      for (let i = 0; i < 3; i++) {
        await micButton.click();
        await page.waitForTimeout(500);
      }
    }

    console.log(`📊 Errors in this test: ${allErrors.length}`);
  });

  test.afterEach(async ({ page }) => {
    console.log('\n📋 FINAL ERROR REPORT:');
    console.log(`Total errors detected: ${allErrors.length}`);
    
    if (allErrors.length > 0) {
      // Group errors by message
      const errorGroups = allErrors.reduce((groups, error) => {
        const key = error.message || error.text || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(error);
        return groups;
      }, {});

      Object.entries(errorGroups).forEach(([message, errors]: [string, any[]]) => {
        console.log(`\n❌ "${message}" (${errors.length} occurrences)`);
        if (errors[0].location) {
          console.log(`   📍 Location: ${errors[0].location.url}:${errors[0].location.lineNumber}:${errors[0].location.columnNumber}`);
        }
      });
    } else {
      console.log('✅ No errors detected');
    }
  });
});
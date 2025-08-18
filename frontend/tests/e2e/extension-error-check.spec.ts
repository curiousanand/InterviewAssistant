import { test, expect } from '@playwright/test';

test.describe('Chrome Extension Error Analysis', () => {
  test('should identify extension-related console errors', async ({ page }) => {
    console.log('🔍 Analyzing extension-related console errors...');
    
    let allConsoleMessages: any[] = [];
    let extensionErrors: any[] = [];
    let cspErrors: any[] = [];
    
    // Capture all console messages
    page.on('console', (msg) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      };
      
      allConsoleMessages.push(message);
      
      // Check for extension-related errors
      const text = msg.text().toLowerCase();
      if (text.includes('extension') || 
          text.includes('chrome-extension://') ||
          text.includes('moz-extension://') ||
          text.includes('content script') ||
          text.includes('inject') ||
          text.includes('manifest')) {
        extensionErrors.push(message);
        console.log('🔌 EXTENSION ERROR:', message);
      }
      
      // Check for CSP errors
      if (text.includes('content security policy') ||
          text.includes('csp') ||
          text.includes('refused to execute') ||
          text.includes('unsafe-eval') ||
          text.includes('unsafe-inline')) {
        cspErrors.push(message);
        console.log('🛡️ CSP ERROR:', message);
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    console.log('\n📊 EXTENSION ERROR ANALYSIS:');
    console.log(`Total console messages: ${allConsoleMessages.length}`);
    console.log(`Extension-related errors: ${extensionErrors.length}`);
    console.log(`CSP-related errors: ${cspErrors.length}`);
    
    if (extensionErrors.length > 0) {
      console.log('\n🔌 EXTENSION ERRORS FOUND:');
      extensionErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.text}`);
        if (error.location) {
          console.log(`   📍 ${error.location.url}:${error.location.lineNumber}`);
        }
      });
    }
    
    if (cspErrors.length > 0) {
      console.log('\n🛡️ CSP ERRORS FOUND:');
      cspErrors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.text}`);
      });
    }

    // Check response headers for CSP
    const response = await page.goto('http://localhost:3000');
    const headers = response?.headers();
    
    console.log('\n📋 SECURITY HEADERS:');
    if (headers) {
      const securityHeaders = [
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection'
      ];
      
      securityHeaders.forEach(header => {
        if (headers[header]) {
          console.log(`${header}: ${headers[header]}`);
        }
      });
    }
  });

  test('should compare with a standard website', async ({ page }) => {
    console.log('🔄 Comparing with a standard website...');
    
    let localErrors: any[] = [];
    let externalErrors: any[] = [];
    
    // Test your local app first
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        localErrors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);
    
    console.log(`Local app errors: ${localErrors.length}`);
    
    // Clear error handler and test external site
    page.removeAllListeners('console');
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        externalErrors.push(msg.text());
      }
    });
    
    await page.goto('https://example.com');
    await page.waitForTimeout(3000);
    
    console.log(`External site errors: ${externalErrors.length}`);
    
    if (localErrors.length > externalErrors.length) {
      console.log('\n⚠️ Your app has more console errors than standard websites');
      console.log('This suggests app-specific issues or extension conflicts');
    }
  });
});
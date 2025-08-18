import { test, expect, Page } from '@playwright/test';

/**
 * Automated Console Monitor Test
 * 
 * This test automatically opens the application in Chrome,
 * monitors console logs, captures errors, and validates functionality
 */
test.describe('Automated Console Monitoring', () => {
  let consoleLogs: string[] = [];
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear previous logs
    consoleLogs = [];
    consoleErrors = [];
    consoleWarnings = [];

    // Set up console monitoring
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.error('🔴 CONSOLE ERROR:', text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
        console.warn('🟡 CONSOLE WARNING:', text);
      } else {
        console.log('📝 CONSOLE LOG:', text);
      }
    });

    // Monitor uncaught exceptions
    page.on('pageerror', (error) => {
      const errorText = `Uncaught Exception: ${error.message}`;
      consoleErrors.push(errorText);
      console.error('💥 UNCAUGHT EXCEPTION:', error.message);
      console.error('Stack:', error.stack);
    });

    // Monitor failed requests
    page.on('requestfailed', (request) => {
      const failedRequest = `Failed Request: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`;
      consoleErrors.push(failedRequest);
      console.error('🌐 REQUEST FAILED:', failedRequest);
    });
  });

  test('should monitor application startup and basic functionality', async ({ page }) => {
    console.log('🚀 Starting automated console monitoring...');
    
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('✅ Page loaded successfully');
    
    // Check if microphone button exists
    const micButton = page.locator('[data-testid="microphone-button"], button:has-text("🎤"), button[aria-label*="microphone"], button[aria-label*="record"]');
    await expect(micButton).toBeVisible({ timeout: 10000 });
    console.log('✅ Microphone button found');
    
    // Check WebSocket connection status
    await page.waitForTimeout(3000); // Allow time for WebSocket connection
    
    // Try to interact with microphone button
    console.log('🎤 Testing microphone button interaction...');
    await micButton.click();
    await page.waitForTimeout(2000);
    
    // Check for common issues
    await checkForCommonIssues(page);
    
    // Generate report
    generateConsoleReport();
  });

  test('should test WebSocket connectivity', async ({ page }) => {
    console.log('🔌 Testing WebSocket connectivity...');
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Monitor WebSocket messages in browser
    await page.evaluate(() => {
      // Override WebSocket to monitor messages
      const originalWebSocket = window.WebSocket;
      window.WebSocket = class extends originalWebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols);
          console.log('WebSocket connecting to:', url);
          
          this.addEventListener('open', () => {
            console.log('✅ WebSocket connected successfully');
          });
          
          this.addEventListener('error', (error) => {
            console.error('❌ WebSocket error:', error);
          });
          
          this.addEventListener('close', (event) => {
            console.log('🔌 WebSocket closed:', event.code, event.reason);
          });
          
          this.addEventListener('message', (event) => {
            console.log('📨 WebSocket message received:', event.data);
          });
        }
      };
    });
    
    await page.waitForTimeout(5000);
    
    // Check WebSocket connection in logs
    const hasWebSocketConnection = consoleLogs.some(log => 
      log.includes('WebSocket connected') || log.includes('WebSocket connecting')
    );
    
    if (hasWebSocketConnection) {
      console.log('✅ WebSocket connection detected in logs');
    } else {
      console.warn('⚠️ No WebSocket connection detected');
    }
  });

  test('should test audio permissions and recording', async ({ page, context }) => {
    console.log('🎵 Testing audio permissions and recording...');
    
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);
    
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Find and click microphone button
    const micButton = page.locator('[data-testid="microphone-button"], button:has-text("🎤"), button[aria-label*="microphone"], button[aria-label*="record"]');
    
    if (await micButton.isVisible()) {
      console.log('🎤 Clicking microphone button...');
      await micButton.click();
      await page.waitForTimeout(3000);
      
      // Check for recording state changes
      const hasRecordingLogs = consoleLogs.some(log => 
        log.toLowerCase().includes('recording') || 
        log.toLowerCase().includes('audio') ||
        log.includes('isRecording: true')
      );
      
      if (hasRecordingLogs) {
        console.log('✅ Recording state changes detected');
      } else {
        console.warn('⚠️ No recording state changes detected');
      }
    } else {
      console.error('❌ Microphone button not found');
    }
  });

  async function checkForCommonIssues(page: Page) {
    console.log('🔍 Checking for common issues...');
    
    // Check for React hydration errors
    const hasHydrationError = consoleErrors.some(error => 
      error.includes('Hydration') || error.includes('hydration')
    );
    if (hasHydrationError) {
      console.error('❌ React hydration error detected');
    }
    
    // Check for module import errors
    const hasImportError = consoleErrors.some(error => 
      error.includes('Cannot resolve module') || 
      error.includes('Module not found') ||
      error.includes('import')
    );
    if (hasImportError) {
      console.error('❌ Module import error detected');
    }
    
    // Check for WebSocket errors
    const hasWebSocketError = consoleErrors.some(error => 
      error.includes('WebSocket') || error.includes('ws://') || error.includes('websocket')
    );
    if (hasWebSocketError) {
      console.error('❌ WebSocket error detected');
    }
    
    // Check for audio/microphone errors
    const hasAudioError = consoleErrors.some(error => 
      error.includes('microphone') || 
      error.includes('audio') || 
      error.includes('MediaRecorder') ||
      error.includes('getUserMedia')
    );
    if (hasAudioError) {
      console.error('❌ Audio/microphone error detected');
    }
    
    // Check for permission errors
    const hasPermissionError = consoleErrors.some(error => 
      error.includes('permission') || error.includes('denied')
    );
    if (hasPermissionError) {
      console.error('❌ Permission error detected');
    }
  }

  function generateConsoleReport() {
    console.log('\n📊 === AUTOMATED CONSOLE MONITORING REPORT ===');
    console.log(`🔢 Total console messages: ${consoleLogs.length}`);
    console.log(`❌ Errors: ${consoleErrors.length}`);
    console.log(`⚠️ Warnings: ${consoleWarnings.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('\n🔴 ERRORS FOUND:');
      consoleErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (consoleWarnings.length > 0) {
      console.log('\n🟡 WARNINGS FOUND:');
      consoleWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
    }
    
    if (consoleErrors.length === 0 && consoleWarnings.length === 0) {
      console.log('✅ No errors or warnings found! Application appears to be working correctly.');
    }
    
    console.log('='.repeat(50));
  }

  test.afterEach(async () => {
    // Save logs to file for later analysis
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logData = {
      timestamp,
      totalLogs: consoleLogs.length,
      errors: consoleErrors,
      warnings: consoleWarnings,
      allLogs: consoleLogs
    };
    
    // This would save to a file in a real scenario
    console.log('\n💾 Console monitoring session completed');
    console.log(`📝 Captured ${consoleLogs.length} console messages`);
  });
});
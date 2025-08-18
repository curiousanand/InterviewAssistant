#!/usr/bin/env node

/**
 * Focused Microphone Test with Console Log Monitoring
 * 
 * Tests microphone button functionality and captures all console logs
 * to identify and fix errors in headed mode
 */

const { chromium } = require('playwright');

console.log('🎭 Starting Microphone Test with Console Monitoring...\n');

class MicrophoneTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.consoleMessages = [];
        this.errors = [];
    }

    async setup() {
        console.log('🚀 Setting up Playwright browser in headed mode...');
        
        // Launch browser in headed mode with developer tools
        this.browser = await chromium.launch({
            headless: false,
            devtools: true,
            slowMo: 1000, // Slow down for observation
            args: [
                '--use-fake-ui-for-media-stream', // Allow microphone access
                '--use-fake-device-for-media-stream',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set up comprehensive console monitoring
        this.page.on('console', msg => {
            const message = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString()
            };
            
            this.consoleMessages.push(message);
            
            // Color-coded console output
            const typeColors = {
                'log': '💬',
                'info': 'ℹ️',
                'warn': '⚠️',
                'error': '❌',
                'debug': '🐛'
            };
            
            const icon = typeColors[msg.type()] || '📋';
            console.log(`${icon} [${msg.type().toUpperCase()}]: ${msg.text()}`);
            
            // Track errors separately
            if (msg.type() === 'error') {
                this.errors.push({
                    message: msg.text(),
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Monitor page errors
        this.page.on('pageerror', error => {
            console.log('💥 Page Error:', error.message);
            this.errors.push({
                message: `Page Error: ${error.message}`,
                timestamp: new Date().toISOString()
            });
        });
        
        // Monitor network failures
        this.page.on('requestfailed', request => {
            console.log(`🌐 Network Failed: ${request.url()} - ${request.failure()?.errorText}`);
            this.errors.push({
                message: `Network Error: ${request.url()} - ${request.failure()?.errorText}`,
                timestamp: new Date().toISOString()
            });
        });
        
        // Set viewport
        await this.page.setViewportSize({ width: 1280, height: 800 });
        
        console.log('✅ Browser setup complete\n');
    }

    async testPageLoad() {
        console.log('🔍 Loading page and monitoring initialization...');
        
        try {
            const response = await this.page.goto('http://localhost:3000', {
                waitUntil: 'networkidle',
                timeout: 30000
            });
            
            if (response.ok()) {
                console.log('✅ Page loaded successfully');
            } else {
                console.log(`❌ Page load failed: ${response.status()}`);
                return false;
            }
            
            // Wait for React hydration and system initialization
            console.log('⏳ Waiting for system initialization...');
            await this.page.waitForTimeout(5000);
            
            return true;
        } catch (error) {
            console.log(`❌ Page load error: ${error.message}`);
            this.errors.push({
                message: `Page load error: ${error.message}`,
                timestamp: new Date().toISOString()
            });
            return false;
        }
    }

    async testMicrophoneButton() {
        console.log('\n🎤 Testing microphone button functionality...');
        
        try {
            // Look for the microphone button
            const micButton = await this.page.waitForSelector('[data-testid="mic-button"]', { timeout: 10000 });
            
            if (!micButton) {
                console.log('❌ Microphone button not found');
                return false;
            }
            
            console.log('✅ Microphone button found');
            
            // Check initial state
            const initialState = await this.page.evaluate(() => {
                const button = document.querySelector('[data-testid="mic-button"]');
                return {
                    visible: button ? true : false,
                    disabled: button ? button.disabled : true,
                    classList: button ? Array.from(button.classList) : []
                };
            });
            
            console.log('📋 Initial button state:', JSON.stringify(initialState, null, 2));
            
            // Click the microphone button
            console.log('🖱️ Clicking microphone button...');
            await micButton.click();
            
            // Wait for state changes and observe logs
            console.log('⏳ Waiting for state changes and monitoring console...');
            await this.page.waitForTimeout(3000);
            
            // Check state after click
            const afterClickState = await this.page.evaluate(() => {
                const button = document.querySelector('[data-testid="mic-button"]');
                return {
                    visible: button ? true : false,
                    disabled: button ? button.disabled : true,
                    classList: button ? Array.from(button.classList) : []
                };
            });
            
            console.log('📋 Button state after click:', JSON.stringify(afterClickState, null, 2));
            
            return true;
        } catch (error) {
            console.log(`❌ Microphone test error: ${error.message}`);
            this.errors.push({
                message: `Microphone test error: ${error.message}`,
                timestamp: new Date().toISOString()
            });
            return false;
        }
    }

    async analyzeErrors() {
        console.log('\n📊 Error Analysis Report');
        console.log('========================');
        
        if (this.errors.length === 0) {
            console.log('🎉 No errors detected!');
            return;
        }
        
        console.log(`Found ${this.errors.length} error(s):\n`);
        
        this.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error.message}`);
            console.log(`   Time: ${error.timestamp}\n`);
        });
        
        // Group errors by type for analysis
        const errorTypes = {};
        this.errors.forEach(error => {
            const type = this.categorizeError(error.message);
            if (!errorTypes[type]) errorTypes[type] = [];
            errorTypes[type].push(error);
        });
        
        console.log('📋 Error Categories:');
        Object.entries(errorTypes).forEach(([type, errors]) => {
            console.log(`  ${type}: ${errors.length} error(s)`);
        });
    }

    categorizeError(message) {
        if (message.includes('WebSocket') || message.includes('ws://')) return 'WebSocket';
        if (message.includes('Audio') || message.includes('microphone')) return 'Audio';
        if (message.includes('Network') || message.includes('Failed to fetch')) return 'Network';
        if (message.includes('React') || message.includes('component')) return 'React';
        if (message.includes('TypeError') || message.includes('ReferenceError')) return 'JavaScript';
        return 'Other';
    }

    async generateReport() {
        console.log('\n📄 Console Messages Summary');
        console.log('============================');
        
        const messageTypes = {};
        this.consoleMessages.forEach(msg => {
            if (!messageTypes[msg.type]) messageTypes[msg.type] = 0;
            messageTypes[msg.type]++;
        });
        
        console.log(`Total Messages: ${this.consoleMessages.length}`);
        Object.entries(messageTypes).forEach(([type, count]) => {
            console.log(`${type}: ${count}`);
        });
        
        console.log('\n💡 Next Steps:');
        if (this.errors.length > 0) {
            console.log('1. Review the errors listed above');
            console.log('2. Focus on WebSocket and Audio-related errors first');
            console.log('3. Check browser developer tools for additional details');
        } else {
            console.log('✅ No errors found - system appears to be working correctly');
        }
    }

    async cleanup() {
        console.log('\n🔍 Browser will remain open for manual inspection...');
        console.log('Press Ctrl+C to close browser and exit.\n');
        
        // Keep browser open for manual inspection
        process.on('SIGINT', async () => {
            console.log('\n👋 Closing browser...');
            if (this.browser) {
                await this.browser.close();
            }
            process.exit(0);
        });
        
        // Keep the process running
        await new Promise(() => {});
    }
}

// Run the test
async function runTest() {
    const test = new MicrophoneTest();
    
    try {
        await test.setup();
        
        const pageLoaded = await test.testPageLoad();
        if (!pageLoaded) {
            console.log('❌ Page failed to load - aborting test');
            return;
        }
        
        await test.testMicrophoneButton();
        await test.analyzeErrors();
        await test.generateReport();
        
        // Keep browser open for inspection
        await test.cleanup();
        
    } catch (error) {
        console.error('💥 Test suite failed:', error);
        if (test.browser) {
            await test.browser.close();
        }
        process.exit(1);
    }
}

// Check if Playwright is available
console.log('🔧 Checking Playwright installation...');
try {
    require.resolve('playwright');
    console.log('✅ Playwright is available\n');
    runTest();
} catch (error) {
    console.log('⚠️ Playwright not found. Installing...');
    const { spawn } = require('child_process');
    
    const install = spawn('npm', ['install', 'playwright'], { stdio: 'inherit', cwd: __dirname });
    
    install.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Playwright installed successfully\n');
            runTest();
        } else {
            console.error('❌ Failed to install Playwright');
            process.exit(1);
        }
    });
}
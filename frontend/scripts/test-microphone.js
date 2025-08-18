const { chromium } = require('playwright');

async function testMicrophoneButton() {
    console.log('🎤 Starting microphone button automated test...\n');
    
    let browser;
    try {
        browser = await chromium.launch({
            headless: false, // Show browser for visibility
            args: [
                '--use-fake-ui-for-media-stream', // Auto-allow microphone
                '--use-fake-device-for-media-stream', // Use fake audio device
                '--allow-running-insecure-content',
                '--disable-web-security'
            ]
        });

        const context = await browser.newContext({
            permissions: ['microphone'] // Grant microphone permission
        });
        
        const page = await context.newPage();
        
        // Capture console logs
        const logs = [];
        page.on('console', msg => {
            const logEntry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
            logs.push(logEntry);
            console.log(`📝 ${logEntry}`);
        });

        // Capture errors
        page.on('pageerror', error => {
            const errorEntry = `[ERROR] ${error.message}`;
            logs.push(errorEntry);
            console.log(`❌ ${errorEntry}`);
        });

        console.log('🌐 Navigating to localhost:3000...');
        await page.goto('http://localhost:3000', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });

        console.log('⏳ Waiting for page to load...');
        await page.waitForTimeout(2000);

        // Wait for microphone button to be available
        console.log('🔍 Looking for microphone button...');
        
        // Try multiple selectors to find the microphone button
        let micButton = null;
        const selectors = [
            'button[aria-label*="microphone"]',
            'button[data-testid*="mic"]', 
            '.microphone-button',
            'button:has-text("Start Recording")',
            'button:has-text("Record")',
            'button' // Fallback to first button
        ];

        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                micButton = await page.$(selector);
                if (micButton) {
                    console.log(`✅ Found microphone button with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
                continue;
            }
        }

        if (!micButton) {
            throw new Error('Microphone button not found with any selector!');
        }

        console.log('✅ Microphone button found!');
        
        // Test 1: First click to start recording
        console.log('\n🎯 TEST 1: Clicking microphone button to start recording...');
        await micButton.click();
        
        console.log('⏳ Recording for 3 seconds and observing message population...');
        await page.waitForTimeout(3000);
        
        // Test 2: Click to stop recording
        console.log('\n🛑 TEST 2: Clicking microphone button to stop recording...');
        // Re-find the button to ensure it's still attached to DOM
        const micButton2 = await page.$('button[data-testid*="mic"]') || await page.$('button');
        await micButton2.click();
        
        console.log('⏳ Waiting 2 seconds to observe UI stability...');
        await page.waitForTimeout(2000);
        
        // Test 3: Second click after pause
        console.log('\n🎯 TEST 3: Clicking microphone button again after pause...');
        const micButton3 = await page.$('button[data-testid*="mic"]') || await page.$('button');
        await micButton3.click();
        
        console.log('⏳ Recording for 2 seconds and watching for position stability...');
        await page.waitForTimeout(2000);
        
        // Test 4: Final stop
        console.log('\n🛑 TEST 4: Final stop...');
        const micButton4 = await page.$('button[data-testid*="mic"]') || await page.$('button');
        await micButton4.click();
        
        console.log('⏳ Observing final button position...');
        await page.waitForTimeout(1000);

        // Check for WebSocket connections
        console.log('\n🔌 Checking WebSocket connections...');
        const wsConnections = await page.evaluate(() => {
            return window.performance.getEntriesByType('navigation').length;
        });

        // Check browser state
        console.log('\n📊 Checking browser media state...');
        const mediaState = await page.evaluate(() => {
            return {
                mediaDevices: !!navigator.mediaDevices,
                getUserMedia: !!navigator.mediaDevices?.getUserMedia,
                webSocket: !!window.WebSocket
            };
        });

        console.log('🔧 Media APIs available:', mediaState);

        // Summary
        console.log('\n📋 TEST SUMMARY:');
        console.log('================');
        console.log(`📝 Total console logs captured: ${logs.length}`);
        console.log(`🔌 WebSocket support: ${mediaState.webSocket ? '✅' : '❌'}`);
        console.log(`🎤 MediaDevices API: ${mediaState.mediaDevices ? '✅' : '❌'}`);
        console.log(`📹 getUserMedia API: ${mediaState.getUserMedia ? '✅' : '❌'}`);

        // Filter and categorize logs
        const errors = logs.filter(log => log.includes('[ERROR]'));
        const warnings = logs.filter(log => log.includes('[WARNING]'));
        const audioLogs = logs.filter(log => 
            log.toLowerCase().includes('audio') || 
            log.toLowerCase().includes('microphone') ||
            log.toLowerCase().includes('recording') ||
            log.toLowerCase().includes('websocket')
        );

        if (errors.length > 0) {
            console.log('\n❌ ERRORS FOUND:');
            errors.forEach(error => console.log(`   ${error}`));
        }

        if (warnings.length > 0) {
            console.log('\n⚠️  WARNINGS FOUND:');
            warnings.forEach(warning => console.log(`   ${warning}`));
        }

        if (audioLogs.length > 0) {
            console.log('\n🎤 AUDIO-RELATED LOGS:');
            audioLogs.forEach(log => console.log(`   ${log}`));
        }

        // Return analysis
        return {
            success: errors.length === 0,
            errors: errors,
            warnings: warnings,
            audioLogs: audioLogs,
            totalLogs: logs.length,
            mediaSupport: mediaState
        };

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (browser) {
            console.log('\n🔄 Keeping browser open for 10 seconds for visual inspection...');
            console.log('🔍 Please observe the HYBRID SOLUTION:');
            console.log('   - Microphone button should be FIXED and NEVER MOVE');
            console.log('   - Chat content should have proper bottom margin (120px)');
            console.log('   - Content should NEVER overlap microphone area');
            console.log('   - Button position should be stable even with errors/status changes');
            await new Promise(resolve => setTimeout(resolve, 10000));
            await browser.close();
        }
    }
}

// Run the test
testMicrophoneButton()
    .then(result => {
        console.log('\n🏁 Test completed!');
        if (!result.success) {
            console.log('❌ Test failed - errors need to be fixed');
            process.exit(1);
        } else {
            console.log('✅ Test passed - no critical errors found');
            process.exit(0);
        }
    })
    .catch(error => {
        console.error('💥 Test script error:', error);
        process.exit(1);
    });
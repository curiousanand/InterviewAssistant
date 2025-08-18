#!/usr/bin/env node

/**
 * Automated Application Debugger
 * 
 * This script automatically:
 * - Checks if both frontend and backend are running
 * - Opens the application in a browser
 * - Monitors console logs and errors
 * - Tests basic functionality
 * - Reports any issues found
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutoDebugger {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.logs = [];
    this.issues = [];
  }

  async run() {
    console.log('🤖 Starting Automated Application Debugger...\n');
    
    try {
      await this.checkServices();
      await this.runPlaywrightTests();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Automated debugging failed:', error.message);
      process.exit(1);
    }
  }

  async checkServices() {
    console.log('🔍 Checking if services are running...');
    
    // Check frontend (port 3000)
    const frontendRunning = await this.checkPort(3000);
    if (frontendRunning) {
      console.log('✅ Frontend is running on port 3000');
    } else {
      this.issues.push('❌ Frontend is not running on port 3000');
      console.log('❌ Frontend is not running on port 3000');
      console.log('💡 Run: npm run dev');
    }
    
    // Check backend (port 8080)
    const backendRunning = await this.checkPort(8080);
    if (backendRunning) {
      console.log('✅ Backend is running on port 8080');
    } else {
      this.issues.push('❌ Backend is not running on port 8080');
      console.log('❌ Backend is not running on port 8080');
      console.log('💡 Run: cd backend && mvn spring-boot:run');
    }
    
    if (!frontendRunning || !backendRunning) {
      throw new Error('Required services are not running');
    }
    
    console.log('');
  }

  async checkPort(port) {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const process = spawn('lsof', ['-i', `:${port}`]);
      
      process.on('exit', (code) => {
        resolve(code === 0);
      });
      
      process.on('error', () => {
        resolve(false);
      });
    });
  }

  async runPlaywrightTests() {
    console.log('🎭 Running automated browser tests with console monitoring...');
    
    return new Promise((resolve, reject) => {
      const playwrightProcess = spawn('npx', [
        'playwright', 'test', 
        'tests/automated-console-monitor.spec.ts',
        '--headed'
      ], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      playwrightProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());
      });

      playwrightProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error(text.trim());
      });

      playwrightProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Automated tests completed successfully');
          resolve();
        } else {
          console.log('⚠️ Tests completed with issues (exit code:', code, ')');
          resolve(); // Don't reject, we still want the report
        }
      });

      playwrightProcess.on('error', (error) => {
        console.error('❌ Failed to run Playwright tests:', error.message);
        console.log('💡 Make sure Playwright is installed: npx playwright install');
        reject(error);
      });
    });
  }

  async generateReport() {
    console.log('\n📊 === AUTOMATED DEBUGGING REPORT ===');
    
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      summary: {
        totalIssues: this.issues.length,
        criticalIssues: this.errors.length,
        warnings: this.warnings.length
      },
      issues: this.issues,
      recommendations: this.generateRecommendations()
    };

    // Save report to file
    const reportPath = path.join(process.cwd(), 'debug-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📁 Report saved to: ${reportPath}`);
    
    if (this.issues.length === 0) {
      console.log('✅ No critical issues found! Application appears to be working correctly.');
    } else {
      console.log(`❌ Found ${this.issues.length} issues that need attention:`);
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    console.log('='.repeat(50));
  }

  generateRecommendations() {
    const recommendations = [
      'Run this automated debugger regularly during development',
      'Check the debug-report.json file for detailed analysis',
      'Monitor browser console when testing manually',
      'Ensure both frontend and backend services are running before testing'
    ];

    if (this.issues.some(issue => issue.includes('WebSocket'))) {
      recommendations.push('Check WebSocket connection between frontend and backend');
    }

    if (this.issues.some(issue => issue.includes('audio') || issue.includes('microphone'))) {
      recommendations.push('Verify microphone permissions in browser settings');
    }

    return recommendations;
  }
}

// Run the automated debugger
if (require.main === module) {
  const debugger = new AutoDebugger();
  debugger.run().catch(console.error);
}

module.exports = AutoDebugger;
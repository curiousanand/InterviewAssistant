import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for comprehensive cross-browser testing
 * 
 * Configures testing across multiple browsers, devices, and scenarios
 * Rationale: Ensures consistent user experience across all supported platforms
 */
export default defineConfig({
  // Test directories
  testDir: './tests/e2e',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // Global test timeout
  timeout: 30000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 10000
  },
  
  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Browser context options
    contextOptions: {
      // Ignore HTTPS errors
      ignoreHTTPSErrors: true,
      
      // Set permissions
      permissions: ['microphone'],
    },
  },

  // Configure projects for major browsers and devices
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Chrome-specific settings for audio testing
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--allow-insecure-localhost'
          ]
        }
      },
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox-specific settings
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true
          }
        }
      },
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        // Safari-specific settings
        contextOptions: {
          permissions: ['microphone']
        }
      },
    },
    
    {
      name: 'edge',
      use: { 
        ...devices['Desktop Edge'],
        // Edge-specific settings
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream'
          ]
        }
      },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        contextOptions: {
          permissions: ['microphone']
        }
      },
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        contextOptions: {
          permissions: ['microphone']
        }
      },
    },
    
    {
      name: 'Mobile Samsung',
      use: { 
        ...devices['Galaxy S5'],
        contextOptions: {
          permissions: ['microphone']
        }
      },
    },

    // Tablet browsers
    {
      name: 'iPad',
      use: { 
        ...devices['iPad Pro'],
        contextOptions: {
          permissions: ['microphone']
        }
      },
    },

    // Accessibility testing configurations
    {
      name: 'High Contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        forcedColors: 'active'
      },
    },

    // Different viewport sizes for responsive testing
    {
      name: 'Small Desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 }
      },
    },
    
    {
      name: 'Large Desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },
  ],

  // Test match patterns
  testMatch: [
    '**/tests/e2e/**/*.spec.ts',
    '**/e2e/**/*.spec.ts'
  ],

  // Configure test output directory
  outputDir: './test-results',
  
  // Web server configuration for local development
  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'cd ../backend && mvn spring-boot:run -Dspring-boot.run.profiles=test',
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
  ],
});
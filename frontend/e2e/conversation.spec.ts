import { test, expect } from '@playwright/test';

test.describe('Conversation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/Interview Assistant/);
    await expect(page.locator('h1')).toContainText('Interview Assistant');
  });

  test('should handle microphone permission request', async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']);

    // Click the record button
    const recordButton = page.locator('[data-testid="record-button"]');
    await recordButton.click();

    // Check if recording starts
    await expect(recordButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('should establish WebSocket connection', async ({ page }) => {
    // Wait for WebSocket connection indicator
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    await expect(connectionStatus).toHaveText('Connected', { timeout: 10000 });
  });

  test('should display error message on connection failure', async ({ page }) => {
    // Simulate offline mode to test error handling
    await page.route('ws://localhost:8080/ws/stream', route => {
      route.abort();
    });

    await page.reload();

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should handle manual text input as fallback', async ({ page }) => {
    const textInput = page.locator('[data-testid="text-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    await textInput.fill('Hello, this is a test message');
    await sendButton.click();

    // Check if message appears in conversation
    const messageList = page.locator('[data-testid="message-list"]');
    await expect(messageList).toContainText('Hello, this is a test message');
  });

  test('should show typing indicator during AI response', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);

    // Send a message
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('What is the capital of France?');
    await textInput.press('Enter');

    // Check for typing indicator
    const typingIndicator = page.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 5000 });
  });

  test('should persist conversation across page refresh', async ({ page }) => {
    // Send a message
    const textInput = page.locator('[data-testid="text-input"]');
    await textInput.fill('Test message for persistence');
    await textInput.press('Enter');

    // Wait for message to appear
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Test message for persistence');

    // Refresh page
    await page.reload();

    // Check if message is still there
    await expect(page.locator('[data-testid="message-list"]')).toContainText('Test message for persistence');
  });
});
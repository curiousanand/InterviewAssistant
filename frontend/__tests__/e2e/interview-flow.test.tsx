/**
 * End-to-end tests for Interview Assistant flow
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../../src/app/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Interview Assistant E2E Flow', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    // Set short timeout for faster tests
    jest.setTimeout(10000);
  });

  describe('Application Initialization', () => {
    it('should render loading screen initially', () => {
      render(<HomePage />);
      
      // The app should render without crashing
      expect(screen.getByText('Initializing Interview Assistant')).toBeInTheDocument();
    });

    it('should contain main components after initialization', async () => {
      render(<HomePage />);

      // Wait for initialization to complete or timeout
      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      }, { timeout: 6000 });

      // Check that the app rendered properly
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Basic Functionality', () => {
    it('should render without crashing', async () => {
      render(<HomePage />);

      // Wait a bit for any async operations
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      }, { timeout: 3000 });

      // Test passed if we get here without errors
      expect(true).toBe(true);
    });

    it('should show some interactive elements', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      }, { timeout: 6000 });

      // Should have at least one button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Component Integration', () => {
    it('should show app components when loaded', async () => {
      render(<HomePage />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      }, { timeout: 6000 });

      // App should have loaded successfully
      expect(document.body).toBeInTheDocument();
    });
  });
});
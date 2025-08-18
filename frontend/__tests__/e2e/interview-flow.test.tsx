/**
 * End-to-end tests for Interview Assistant flow
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../../src/app/page-simplified';

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
  });

  describe('Application Initialization', () => {
    it('should show loading screen initially', () => {
      render(<HomePage />);
      
      expect(screen.getByText('Initializing Interview Assistant')).toBeInTheDocument();
      expect(screen.getByText('Setting up audio and connection...')).toBeInTheDocument();
    });

    it('should display main interface after initialization', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Interview Assistant')).toBeInTheDocument();
      expect(screen.getByText('Welcome to Interview Assistant')).toBeInTheDocument();
    });

    it('should show error if initialization fails', async () => {
      // Mock initialization failure
      const mockError = 'Failed to connect to server';
      
      // TODO: Mock the service to fail
      
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText(mockError)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Recording Flow', () => {
    it('should start recording when microphone button is clicked', async () => {
      render(<HomePage />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Find and click microphone button
      const micButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(micButton);

      // Should change to stop recording
      await waitFor(() => {
        expect(screen.getByText('Stop Recording')).toBeInTheDocument();
      });

      // Should show recording indicator
      expect(screen.getByText('Recording...')).toBeInTheDocument();
    });

    it('should stop recording when stop button is clicked', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Start recording
      const micButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(micButton);

      await waitFor(() => {
        expect(screen.getByText('Stop Recording')).toBeInTheDocument();
      });

      // Stop recording
      const stopButton = screen.getByRole('button', { name: /stop recording/i });
      await user.click(stopButton);

      await waitFor(() => {
        expect(screen.getByText('Start Recording')).toBeInTheDocument();
      });

      expect(screen.queryByText('Recording...')).not.toBeInTheDocument();
    });

    it('should show error when recording fails', async () => {
      // Mock microphone permission denied
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
        new Error('Permission denied')
      );

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      const micButton = screen.getByRole('button', { name: /start recording/i });
      await user.click(micButton);

      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
      });

      // Restore
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    });
  });

  describe('Language Settings', () => {
    it('should toggle language settings panel', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Find language button
      const languageButton = screen.getByLabelText('Language Settings');
      await user.click(languageButton);

      // Language selector should appear
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });
  });

  describe('Conversation Management', () => {
    it('should clear conversation when clear button is clicked', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Clear button should be disabled initially
      const clearButton = screen.getByLabelText('Clear Conversation');
      expect(clearButton).toBeDisabled();

      // TODO: Add messages to conversation
      // Then test clear functionality
    });
  });

  describe('Connection Status', () => {
    it('should display connection status indicator', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Should show connection status
      const statusIndicator = screen.getByTestId('status-indicator');
      expect(statusIndicator).toBeInTheDocument();
    });

    it('should disable microphone when disconnected', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // TODO: Mock disconnection
      // const micButton = screen.getByRole('button', { name: /start recording/i });
      // expect(micButton).toBeDisabled();
    });
  });

  describe('Message Display', () => {
    it('should display welcome screen when no messages', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Welcome to Interview Assistant')).toBeInTheDocument();
      expect(screen.getByText(/Start a conversation by clicking the microphone button/)).toBeInTheDocument();
    });

    it('should show feature cards on welcome screen', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Voice Input')).toBeInTheDocument();
      expect(screen.getByText('AI Responses')).toBeInTheDocument();
      expect(screen.getByText('Multilingual')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display and dismiss error messages', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // TODO: Trigger an error
      // const errorMessage = 'Test error message';
      
      // Check error is displayed
      // expect(screen.getByText(errorMessage)).toBeInTheDocument();

      // Dismiss error
      // const dismissButton = screen.getByLabelText('Clear error');
      // await user.click(dismissButton);

      // Error should be gone
      // expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Language Settings')).toBeInTheDocument();
      expect(screen.getByLabelText('Clear Conversation')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Tab through interface
      await user.tab();
      expect(document.activeElement).toHaveAttribute('title', 'Language Settings');

      await user.tab();
      expect(document.activeElement).toHaveAttribute('title', 'Clear Conversation');

      await user.tab();
      // Should reach microphone button
      expect(document.activeElement?.textContent).toContain('Start Recording');
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Set mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;

      render(<HomePage />);

      await waitFor(() => {
        expect(screen.queryByText('Initializing Interview Assistant')).not.toBeInTheDocument();
      });

      // Feature cards should stack vertically on mobile
      const featureCards = screen.getByText('Voice Input').closest('.grid');
      expect(featureCards).toHaveClass('grid-cols-1');
    });
  });
});
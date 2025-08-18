/**
 * Unit tests for SimpleMicrophoneButton component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleMicrophoneButton } from '../../../src/components/ui/SimpleMicrophoneButton';
import { mockFactory } from '../../utils/test-utils';

describe('SimpleMicrophoneButton', () => {
  const defaultProps = {
    recordingState: mockFactory.recordingState(),
    onStartRecording: jest.fn(),
    onStopRecording: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default state', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Start Recording')).toBeInTheDocument();
      expect(screen.queryByText('Recording...')).not.toBeInTheDocument();
    });

    it('should show recording state when isRecording is true', () => {
      const props = {
        ...defaultProps,
        recordingState: mockFactory.recordingState({ isRecording: true }),
      };

      render(<SimpleMicrophoneButton {...props} />);
      
      expect(screen.getByText('Stop Recording')).toBeInTheDocument();
      expect(screen.getByText('Recording...')).toBeInTheDocument();
      
      // Check for red background color
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ backgroundColor: '#ef4444' });
    });

    it('should be disabled when disabled prop is true', () => {
      const props = { ...defaultProps, disabled: true };
      
      render(<SimpleMicrophoneButton {...props} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('should show debug information', () => {
      const props = {
        ...defaultProps,
        recordingState: mockFactory.recordingState({ isRecording: true }),
      };

      render(<SimpleMicrophoneButton {...props} />);
      
      expect(screen.getByText(/Debug: isRecording=true/)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onStartRecording when clicked while not recording', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(defaultProps.onStartRecording).toHaveBeenCalledTimes(1);
      expect(defaultProps.onStopRecording).not.toHaveBeenCalled();
    });

    it('should call onStopRecording when clicked while recording', () => {
      const props = {
        ...defaultProps,
        recordingState: mockFactory.recordingState({ isRecording: true }),
      };

      render(<SimpleMicrophoneButton {...props} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(defaultProps.onStopRecording).toHaveBeenCalledTimes(1);
      expect(defaultProps.onStartRecording).not.toHaveBeenCalled();
    });

    it('should not call handlers when disabled', () => {
      const props = { ...defaultProps, disabled: true };
      
      render(<SimpleMicrophoneButton {...props} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(defaultProps.onStartRecording).not.toHaveBeenCalled();
      expect(defaultProps.onStopRecording).not.toHaveBeenCalled();
    });

    it('should log click events to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(consoleSpy).toHaveBeenCalledWith('Button activated, isRecording:', false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Visual States', () => {
    it('should show blue button when not recording', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ backgroundColor: '#3b82f6' });
      expect(button).toHaveClass('bg-blue-500');
    });

    it('should show red button with pulse animation when recording', () => {
      const props = {
        ...defaultProps,
        recordingState: mockFactory.recordingState({ isRecording: true }),
      };

      render(<SimpleMicrophoneButton {...props} />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ backgroundColor: '#ef4444' });
      expect(button).toHaveClass('bg-red-500');
      
      // Check for recording indicator
      const recordingDot = screen.getByText('Recording...').previousElementSibling;
      expect(recordingDot).toHaveClass('animate-pulse');
    });

    it('should show microphone icon when not recording', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      
      // Check for microphone path
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('d', expect.stringContaining('M19 11a7'));
    });

    it('should show stop icon when recording', () => {
      const props = {
        ...defaultProps,
        recordingState: mockFactory.recordingState({ isRecording: true }),
      };

      render(<SimpleMicrophoneButton {...props} />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      
      // Check for stop (square) path
      const path = svg?.querySelector('path');
      expect(path).toHaveAttribute('d', 'M6 6h12v12H6z');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(<SimpleMicrophoneButton {...defaultProps} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(defaultProps.onStartRecording).toHaveBeenCalled();
      
      fireEvent.keyDown(button, { key: ' ' });
      expect(defaultProps.onStartRecording).toHaveBeenCalledTimes(2);
    });
  });
});
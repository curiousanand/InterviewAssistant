import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageBubble, MessageBubbleGroup, TypingIndicator } from '../MessageBubble';
import { MessageStatus } from '@/hooks/useConversation';

/**
 * Test suite for MessageBubble components
 * 
 * Tests message display, user interactions, and status indicators
 * Rationale: Ensures messages are displayed correctly with proper styling and functionality
 */

describe('MessageBubble', () => {
  const mockMessage = {
    id: 'test-message-1',
    content: 'Hello, this is a test message',
    type: 'user' as const,
    status: MessageStatus.SENT,
    timestamp: new Date('2023-12-01T10:00:00Z'),
  };

  const mockOnRetry = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnCopy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render user message correctly', () => {
      render(<MessageBubble message={mockMessage} />);

      expect(screen.getByText('Hello, this is a test message')).toBeInTheDocument();
      expect(screen.getByText('U')).toBeInTheDocument(); // User avatar
    });

    it('should render assistant message correctly', () => {
      const assistantMessage = {
        ...mockMessage,
        type: 'assistant' as const,
        content: 'This is an assistant response',
      };

      render(<MessageBubble message={assistantMessage} />);

      expect(screen.getByText('This is an assistant response')).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument(); // Assistant avatar
    });

    it('should render system message correctly', () => {
      const systemMessage = {
        ...mockMessage,
        type: 'system' as const,
        content: 'System notification',
      };

      render(<MessageBubble message={systemMessage} />);

      expect(screen.getByText('System notification')).toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument(); // System avatar
    });
  });

  describe('message status display', () => {
    it('should show sending status', () => {
      const sendingMessage = {
        ...mockMessage,
        status: MessageStatus.SENDING,
      };

      render(<MessageBubble message={sendingMessage} />);

      expect(screen.getByText('⏳')).toBeInTheDocument();
      expect(screen.getByText('sending')).toBeInTheDocument();
    });

    it('should show sent status', () => {
      const sentMessage = {
        ...mockMessage,
        status: MessageStatus.SENT,
      };

      render(<MessageBubble message={sentMessage} />);

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should show failed status', () => {
      const failedMessage = {
        ...mockMessage,
        status: MessageStatus.FAILED,
      };

      render(<MessageBubble message={failedMessage} />);

      expect(screen.getByText('❌')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    it('should show partial status with cursor', () => {
      const partialMessage = {
        ...mockMessage,
        status: MessageStatus.PARTIAL,
        content: 'Partial message...',
      };

      render(<MessageBubble message={partialMessage} />);

      expect(screen.getByText('Partial message...')).toBeInTheDocument();
      // Partial messages should have animated cursor
      const cursor = document.querySelector('.animate-pulse');
      expect(cursor).toBeInTheDocument();
    });

    it('should not show status for completed messages', () => {
      const completedMessage = {
        ...mockMessage,
        status: MessageStatus.COMPLETED,
      };

      render(<MessageBubble message={completedMessage} />);

      // Completed status shouldn't be displayed
      expect(screen.queryByText('completed')).not.toBeInTheDocument();
    });
  });

  describe('timestamp display', () => {
    it('should show timestamp when enabled', () => {
      render(<MessageBubble message={mockMessage} showTimestamp={true} />);

      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('should hide timestamp when disabled', () => {
      render(<MessageBubble message={mockMessage} showTimestamp={false} />);

      expect(screen.queryByText('Just now')).not.toBeInTheDocument();
    });

    it('should format old timestamps correctly', () => {
      const oldMessage = {
        ...mockMessage,
        timestamp: new Date('2023-11-30T10:00:00Z'), // Yesterday
      };

      render(<MessageBubble message={oldMessage} showTimestamp={true} />);

      expect(screen.getByText(/ago|11\/30\/2023/)).toBeInTheDocument();
    });
  });

  describe('message actions', () => {
    it('should show actions on hover', async () => {
      render(
        <MessageBubble 
          message={mockMessage} 
          onRetry={mockOnRetry}
          onDelete={mockOnDelete}
          onCopy={mockOnCopy}
        />
      );

      const messageContainer = screen.getByText('Hello, this is a test message').closest('div');
      
      fireEvent.mouseEnter(messageContainer!);

      await waitFor(() => {
        expect(screen.getByTitle('Copy message')).toBeInTheDocument();
        expect(screen.getByTitle('Delete message')).toBeInTheDocument();
      });
    });

    it('should call copy callback when copy button clicked', async () => {
      render(
        <MessageBubble 
          message={mockMessage} 
          onCopy={mockOnCopy}
        />
      );

      const messageContainer = screen.getByText('Hello, this is a test message').closest('div');
      fireEvent.mouseEnter(messageContainer!);

      await waitFor(() => {
        const copyButton = screen.getByTitle('Copy message');
        fireEvent.click(copyButton);
      });

      expect(mockOnCopy).toHaveBeenCalledWith('Hello, this is a test message');
    });

    it('should call delete callback when delete button clicked', async () => {
      render(
        <MessageBubble 
          message={mockMessage} 
          onDelete={mockOnDelete}
        />
      );

      const messageContainer = screen.getByText('Hello, this is a test message').closest('div');
      fireEvent.mouseEnter(messageContainer!);

      await waitFor(() => {
        const deleteButton = screen.getByTitle('Delete message');
        fireEvent.click(deleteButton);
      });

      expect(mockOnDelete).toHaveBeenCalled();
    });

    it('should show retry button for failed messages', async () => {
      const failedMessage = {
        ...mockMessage,
        status: MessageStatus.FAILED,
      };

      render(
        <MessageBubble 
          message={failedMessage} 
          onRetry={mockOnRetry}
        />
      );

      // Failed messages should show actions immediately
      await waitFor(() => {
        expect(screen.getByTitle('Retry message')).toBeInTheDocument();
      });
    });

    it('should call retry callback when retry button clicked', async () => {
      const failedMessage = {
        ...mockMessage,
        status: MessageStatus.FAILED,
      };

      render(
        <MessageBubble 
          message={failedMessage} 
          onRetry={mockOnRetry}
        />
      );

      const retryButton = await screen.findByTitle('Retry message');
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalled();
    });
  });

  describe('metadata display', () => {
    it('should show metadata when enabled', () => {
      const messageWithMetadata = {
        ...mockMessage,
        metadata: {
          transcriptionConfidence: 0.95,
          processingTime: 250,
          audioLength: 1024,
          language: 'en-US',
        },
      };

      render(<MessageBubble message={messageWithMetadata} showMetadata={true} />);

      expect(screen.getByText('Show details')).toBeInTheDocument();
    });

    it('should expand metadata when details button clicked', () => {
      const messageWithMetadata = {
        ...mockMessage,
        metadata: {
          transcriptionConfidence: 0.95,
          processingTime: 250,
        },
      };

      render(<MessageBubble message={messageWithMetadata} showMetadata={true} />);

      fireEvent.click(screen.getByText('Show details'));

      expect(screen.getByText('Hide details')).toBeInTheDocument();
      expect(screen.getByText('Transcription confidence:')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('Processing time:')).toBeInTheDocument();
      expect(screen.getByText('250ms')).toBeInTheDocument();
    });

    it('should display error details in metadata', () => {
      const messageWithError = {
        ...mockMessage,
        status: MessageStatus.FAILED,
        metadata: {
          errorDetails: 'Network connection failed',
        },
      };

      render(<MessageBubble message={messageWithError} showMetadata={true} />);

      fireEvent.click(screen.getByText('Show details'));

      expect(screen.getByText('Error:')).toBeInTheDocument();
      expect(screen.getByText('Network connection failed')).toBeInTheDocument();
    });
  });

  describe('styling and appearance', () => {
    it('should apply user message styling', () => {
      render(<MessageBubble message={mockMessage} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('bg-primary');
    });

    it('should apply assistant message styling', () => {
      const assistantMessage = {
        ...mockMessage,
        type: 'assistant' as const,
      };

      render(<MessageBubble message={assistantMessage} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('bg-muted');
    });

    it('should apply error styling for failed messages', () => {
      const failedMessage = {
        ...mockMessage,
        status: MessageStatus.FAILED,
      };

      render(<MessageBubble message={failedMessage} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('border-2', 'border-destructive');
    });

    it('should apply partial message opacity', () => {
      const partialMessage = {
        ...mockMessage,
        status: MessageStatus.PARTIAL,
      };

      render(<MessageBubble message={partialMessage} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('opacity-70');
    });
  });

  describe('accessibility', () => {
    it('should handle text selection correctly', () => {
      render(<MessageBubble message={mockMessage} enableSelection={true} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('select-text');
    });

    it('should disable text selection when configured', () => {
      render(<MessageBubble message={mockMessage} enableSelection={false} />);

      const messageContent = screen.getByText('Hello, this is a test message').closest('div');
      expect(messageContent).toHaveClass('select-none');
    });

    it('should provide accessible button labels', async () => {
      render(
        <MessageBubble 
          message={mockMessage} 
          onRetry={mockOnRetry}
          onDelete={mockOnDelete}
          onCopy={mockOnCopy}
        />
      );

      const messageContainer = screen.getByText('Hello, this is a test message').closest('div');
      fireEvent.mouseEnter(messageContainer!);

      await waitFor(() => {
        expect(screen.getByTitle('Copy message')).toBeInTheDocument();
        expect(screen.getByTitle('Delete message')).toBeInTheDocument();
      });
    });
  });
});

describe('MessageBubbleGroup', () => {
  const mockMessages = [
    {
      id: 'msg-1',
      content: 'First message',
      type: 'user' as const,
      status: MessageStatus.SENT,
      timestamp: new Date('2023-12-01T10:00:00Z'),
    },
    {
      id: 'msg-2',
      content: 'Second message',
      type: 'user' as const,
      status: MessageStatus.SENT,
      timestamp: new Date('2023-12-01T10:01:00Z'),
    },
  ];

  it('should render multiple messages in a group', () => {
    render(<MessageBubbleGroup messages={mockMessages} />);

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('should show metadata only on last message', () => {
    render(<MessageBubbleGroup messages={mockMessages} showMetadata={true} />);

    // Only the last message should have metadata display logic
    const metadataToggles = screen.queryAllByText(/Show details|Hide details/);
    expect(metadataToggles.length).toBeLessThanOrEqual(1);
  });

  it('should show timestamp only on last message', () => {
    render(<MessageBubbleGroup messages={mockMessages} showTimestamp={true} />);

    // Only one "Just now" should appear (for the last message)
    const timestamps = screen.queryAllByText('Just now');
    expect(timestamps).toHaveLength(1);
  });

  it('should handle empty message array', () => {
    render(<MessageBubbleGroup messages={[]} />);

    expect(screen.queryByText('First message')).not.toBeInTheDocument();
  });
});

describe('TypingIndicator', () => {
  it('should render when visible', () => {
    render(<TypingIndicator isVisible={true} />);

    expect(screen.getByText('Assistant is typing')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<TypingIndicator isVisible={false} />);

    expect(screen.queryByText('Assistant is typing')).not.toBeInTheDocument();
  });

  it('should show custom sender name', () => {
    render(<TypingIndicator isVisible={true} sender="Custom Bot" />);

    expect(screen.getByText('Custom Bot is typing')).toBeInTheDocument();
  });

  it('should have animated dots', () => {
    render(<TypingIndicator isVisible={true} />);

    const dots = document.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });
});
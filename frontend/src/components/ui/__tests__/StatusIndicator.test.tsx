import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  StatusIndicator, 
  CompactStatusIndicator, 
  DetailedStatusPanel, 
  StatusBadge 
} from '../StatusIndicator';
import { WebSocketState } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * Test suite for StatusIndicator components
 * 
 * Tests status display, visual feedback, and user interactions
 * Rationale: Ensures system status is clearly communicated to users
 */

// Mock the enums since they're imported from the component
const RecordingStatus = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  ERROR: 'error'
} as const;

const TranscriptionStatus = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

describe('StatusIndicator', () => {
  const defaultProps = {
    connectionStatus: WebSocketState.CONNECTED,
    recordingStatus: RecordingStatus.IDLE,
    transcriptionStatus: TranscriptionStatus.IDLE,
  };

  describe('basic rendering', () => {
    it('should render all status indicators', () => {
      render(<StatusIndicator {...defaultProps} />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should show labels when enabled', () => {
      render(<StatusIndicator {...defaultProps} showLabels={true} />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should hide labels when disabled', () => {
      render(<StatusIndicator {...defaultProps} showLabels={false} />);

      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Idle')).not.toBeInTheDocument();
    });
  });

  describe('connection status display', () => {
    it('should show connected status correctly', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          connectionStatus={WebSocketState.CONNECTED} 
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      const statusDot = document.querySelector('.bg-green-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show connecting status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          connectionStatus={WebSocketState.CONNECTING} 
        />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });

    it('should show disconnected status', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          connectionStatus={WebSocketState.DISCONNECTED} 
        />
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      const statusDot = document.querySelector('.bg-gray-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show error status', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          connectionStatus={WebSocketState.ERROR} 
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
      const statusDot = document.querySelector('.bg-red-500');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show reconnecting status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          connectionStatus={WebSocketState.RECONNECTING} 
        />
      );

      expect(screen.getByText('Reconnecting')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });
  });

  describe('recording status display', () => {
    it('should show recording status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          recordingStatus={RecordingStatus.RECORDING} 
        />
      );

      expect(screen.getByText('Recording')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });

    it('should show paused status', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          recordingStatus={RecordingStatus.PAUSED} 
        />
      );

      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('should show processing status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          recordingStatus={RecordingStatus.PROCESSING} 
        />
      );

      expect(screen.getByText('Processing')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });

    it('should show error status', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          recordingStatus={RecordingStatus.ERROR} 
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('transcription status display', () => {
    it('should show listening status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          transcriptionStatus={TranscriptionStatus.LISTENING} 
        />
      );

      expect(screen.getByText('Listening')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });

    it('should show processing status with animation', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          transcriptionStatus={TranscriptionStatus.PROCESSING} 
        />
      );

      expect(screen.getByText('Processing')).toBeInTheDocument();
      const animatedDot = document.querySelector('.animate-pulse');
      expect(animatedDot).toBeInTheDocument();
    });

    it('should show completed status', () => {
      render(
        <StatusIndicator 
          {...defaultProps} 
          transcriptionStatus={TranscriptionStatus.COMPLETED} 
        />
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('layout options', () => {
    it('should render horizontal layout by default', () => {
      render(<StatusIndicator {...defaultProps} />);

      const container = screen.getByText('Connected').closest('div')?.parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'space-x-4');
    });

    it('should render vertical layout when specified', () => {
      render(<StatusIndicator {...defaultProps} layout="vertical" />);

      const container = screen.getByText('Connected').closest('div')?.parentElement;
      expect(container).toHaveClass('flex', 'flex-col', 'space-y-3');
    });

    it('should render compact layout when specified', () => {
      render(<StatusIndicator {...defaultProps} layout="compact" />);

      const container = screen.getByText('Connected').closest('div')?.parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'space-x-1');
    });
  });

  describe('size options', () => {
    it('should render small size correctly', () => {
      render(<StatusIndicator {...defaultProps} size="sm" />);

      const statusDots = document.querySelectorAll('.w-2.h-2');
      expect(statusDots.length).toBeGreaterThan(0);
    });

    it('should render large size correctly', () => {
      render(<StatusIndicator {...defaultProps} size="lg" />);

      const statusDots = document.querySelectorAll('.w-4.h-4');
      expect(statusDots.length).toBeGreaterThan(0);
    });
  });

  describe('tooltip functionality', () => {
    it('should show tooltip on hover when details enabled', async () => {
      render(<StatusIndicator {...defaultProps} showDetails={true} />);

      const statusItem = screen.getByText('Connected').closest('div');
      fireEvent.mouseEnter(statusItem!);

      await waitFor(() => {
        expect(screen.getByText('WebSocket connection is active')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(<StatusIndicator {...defaultProps} showDetails={true} />);

      const statusItem = screen.getByText('Connected').closest('div');
      fireEvent.mouseEnter(statusItem!);

      await waitFor(() => {
        expect(screen.getByText('WebSocket connection is active')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(statusItem!);

      await waitFor(() => {
        expect(screen.queryByText('WebSocket connection is active')).not.toBeInTheDocument();
      });
    });

    it('should show update timestamp in tooltip', async () => {
      render(<StatusIndicator {...defaultProps} showDetails={true} />);

      const statusItem = screen.getByText('Connected').closest('div');
      fireEvent.mouseEnter(statusItem!);

      await waitFor(() => {
        expect(screen.getByText(/Updated:/)).toBeInTheDocument();
      });
    });
  });
});

describe('CompactStatusIndicator', () => {
  const defaultProps = {
    connectionStatus: WebSocketState.CONNECTED,
    recordingStatus: RecordingStatus.IDLE,
    isActive: false,
  };

  it('should show error status when connection has error', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        connectionStatus={WebSocketState.ERROR} 
      />
    );

    const statusDot = document.querySelector('.bg-red-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('should show error status when recording has error', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        recordingStatus={RecordingStatus.ERROR} 
      />
    );

    const statusDot = document.querySelector('.bg-red-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('should show disconnected status', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        connectionStatus={WebSocketState.DISCONNECTED} 
      />
    );

    const statusDot = document.querySelector('.bg-gray-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('should show active status when active', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        isActive={true} 
      />
    );

    const statusDot = document.querySelector('.bg-green-500');
    expect(statusDot).toBeInTheDocument();
    const animatedDot = document.querySelector('.animate-pulse');
    expect(animatedDot).toBeInTheDocument();
  });

  it('should show connected status when not active', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        connectionStatus={WebSocketState.CONNECTED}
        isActive={false} 
      />
    );

    const statusDot = document.querySelector('.bg-blue-500');
    expect(statusDot).toBeInTheDocument();
  });

  it('should show connecting status with animation', () => {
    render(
      <CompactStatusIndicator 
        {...defaultProps} 
        connectionStatus={WebSocketState.CONNECTING} 
      />
    );

    const statusDot = document.querySelector('.bg-yellow-500');
    expect(statusDot).toBeInTheDocument();
    const animatedDot = document.querySelector('.animate-pulse');
    expect(animatedDot).toBeInTheDocument();
  });
});

describe('DetailedStatusPanel', () => {
  const defaultProps = {
    connectionStatus: WebSocketState.CONNECTED,
    recordingStatus: RecordingStatus.IDLE,
    transcriptionStatus: TranscriptionStatus.IDLE,
  };

  const mockStatistics = {
    uptime: 125000, // 2 minutes, 5 seconds
    messagesExchanged: 15,
    errorCount: 2,
    lastError: 'Connection timeout',
  };

  it('should render system status header', () => {
    render(<DetailedStatusPanel {...defaultProps} />);

    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('should show overall health status', () => {
    render(<DetailedStatusPanel {...defaultProps} />);

    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('should show error health when connection has error', () => {
    render(
      <DetailedStatusPanel 
        {...defaultProps} 
        connectionStatus={WebSocketState.ERROR} 
      />
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should show offline health when disconnected', () => {
    render(
      <DetailedStatusPanel 
        {...defaultProps} 
        connectionStatus={WebSocketState.DISCONNECTED} 
      />
    );

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('should display statistics when provided', () => {
    render(
      <DetailedStatusPanel 
        {...defaultProps} 
        statistics={mockStatistics} 
      />
    );

    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument(); // Formatted uptime
    expect(screen.getByText('15')).toBeInTheDocument(); // Messages
    expect(screen.getByText('2')).toBeInTheDocument(); // Errors
  });

  it('should show last error when provided', () => {
    render(
      <DetailedStatusPanel 
        {...defaultProps} 
        statistics={mockStatistics} 
      />
    );

    expect(screen.getByText('Last Error:')).toBeInTheDocument();
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('should render quick action buttons', () => {
    render(<DetailedStatusPanel {...defaultProps} />);

    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Test Connection')).toBeInTheDocument();
    expect(screen.getByText('View Logs')).toBeInTheDocument();
  });

  it('should format uptime correctly', () => {
    const statisticsWithLongUptime = {
      ...mockStatistics,
      uptime: 3665000, // 1 hour, 1 minute, 5 seconds
    };

    render(
      <DetailedStatusPanel 
        {...defaultProps} 
        statistics={statisticsWithLongUptime} 
      />
    );

    expect(screen.getByText('61m 5s')).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('should render online status correctly', () => {
    render(<StatusBadge status="online" label="Connected" />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
    const badge = screen.getByText('Connected').closest('span');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should render offline status correctly', () => {
    render(<StatusBadge status="offline" label="Disconnected" />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    const badge = screen.getByText('Disconnected').closest('span');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800');
  });

  it('should render error status correctly', () => {
    render(<StatusBadge status="error" label="Failed" />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    const badge = screen.getByText('Failed').closest('span');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should render warning status correctly', () => {
    render(<StatusBadge status="warning" label="Limited" />);

    expect(screen.getByText('Limited')).toBeInTheDocument();
    const badge = screen.getByText('Limited').closest('span');
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should render without label', () => {
    render(<StatusBadge status="online" />);

    const badge = document.querySelector('.bg-green-100');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBeFalsy();
  });

  it('should render small size correctly', () => {
    render(<StatusBadge status="online" size="sm" label="Online" />);

    const badge = screen.getByText('Online').closest('span');
    expect(badge).toHaveClass('px-2', 'py-1', 'text-xs');
  });

  it('should render medium size correctly', () => {
    render(<StatusBadge status="online" size="md" label="Online" />);

    const badge = screen.getByText('Online').closest('span');
    expect(badge).toHaveClass('px-3', 'py-1', 'text-sm');
  });

  it('should show status dot', () => {
    render(<StatusBadge status="online" label="Connected" />);

    const dot = document.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });
});
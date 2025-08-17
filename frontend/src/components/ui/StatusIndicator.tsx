'use client';

import React, { useState, useEffect } from 'react';
import { WebSocketState } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * StatusIndicator - Displays connection, recording, and error states
 * 
 * Why: Provides clear visual feedback about system status
 * Pattern: Presentational Component - shows status information clearly
 * Rationale: Users need immediate feedback about connection and recording status
 */

interface StatusIndicatorProps {
  connectionStatus: WebSocketState;
  recordingStatus: RecordingStatus;
  transcriptionStatus: TranscriptionStatus;
  className?: string;
  showLabels?: boolean;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'horizontal' | 'vertical' | 'compact';
}

enum RecordingStatus {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  ERROR = 'error'
}

enum TranscriptionStatus {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

interface StatusConfig {
  color: string;
  icon: string;
  label: string;
  description: string;
  animated?: boolean;
}

export function StatusIndicator({
  connectionStatus,
  recordingStatus,
  transcriptionStatus,
  className = '',
  showLabels = true,
  showDetails = false,
  size = 'md',
  layout = 'horizontal'
}: StatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Update timestamp when status changes
  useEffect(() => {
    setLastUpdate(new Date());
  }, [connectionStatus, recordingStatus, transcriptionStatus]);

  const getConnectionConfig = (status: WebSocketState): StatusConfig => {
    switch (status) {
      case WebSocketState.CONNECTED:
        return {
          color: 'bg-green-500',
          icon: '●',
          label: 'Connected',
          description: 'WebSocket connection is active'
        };
      case WebSocketState.CONNECTING:
        return {
          color: 'bg-yellow-500',
          icon: '●',
          label: 'Connecting',
          description: 'Establishing WebSocket connection',
          animated: true
        };
      case WebSocketState.RECONNECTING:
        return {
          color: 'bg-orange-500',
          icon: '●',
          label: 'Reconnecting',
          description: 'Attempting to reconnect',
          animated: true
        };
      case WebSocketState.DISCONNECTED:
        return {
          color: 'bg-gray-500',
          icon: '●',
          label: 'Disconnected',
          description: 'WebSocket connection is closed'
        };
      case WebSocketState.ERROR:
        return {
          color: 'bg-red-500',
          icon: '●',
          label: 'Error',
          description: 'Connection error occurred'
        };
      default:
        return {
          color: 'bg-gray-400',
          icon: '●',
          label: 'Unknown',
          description: 'Connection status unknown'
        };
    }
  };

  const getRecordingConfig = (status: RecordingStatus): StatusConfig => {
    switch (status) {
      case RecordingStatus.RECORDING:
        return {
          color: 'bg-red-500',
          icon: '🎤',
          label: 'Recording',
          description: 'Audio recording is active',
          animated: true
        };
      case RecordingStatus.PAUSED:
        return {
          color: 'bg-yellow-500',
          icon: '⏸️',
          label: 'Paused',
          description: 'Recording is paused'
        };
      case RecordingStatus.PROCESSING:
        return {
          color: 'bg-blue-500',
          icon: '⚙️',
          label: 'Processing',
          description: 'Processing audio data',
          animated: true
        };
      case RecordingStatus.ERROR:
        return {
          color: 'bg-red-600',
          icon: '❌',
          label: 'Error',
          description: 'Recording error occurred'
        };
      default:
        return {
          color: 'bg-gray-400',
          icon: '⭕',
          label: 'Idle',
          description: 'Not recording'
        };
    }
  };

  const getTranscriptionConfig = (status: TranscriptionStatus): StatusConfig => {
    switch (status) {
      case TranscriptionStatus.LISTENING:
        return {
          color: 'bg-green-500',
          icon: '👂',
          label: 'Listening',
          description: 'Listening for speech',
          animated: true
        };
      case TranscriptionStatus.PROCESSING:
        return {
          color: 'bg-blue-500',
          icon: '⚡',
          label: 'Processing',
          description: 'Processing speech to text',
          animated: true
        };
      case TranscriptionStatus.COMPLETED:
        return {
          color: 'bg-green-600',
          icon: '✅',
          label: 'Completed',
          description: 'Transcription completed'
        };
      case TranscriptionStatus.ERROR:
        return {
          color: 'bg-red-500',
          icon: '❌',
          label: 'Error',
          description: 'Transcription error occurred'
        };
      default:
        return {
          color: 'bg-gray-400',
          icon: '💤',
          label: 'Idle',
          description: 'Not transcribing'
        };
    }
  };

  const getSizeClasses = (size: string): { dot: string; text: string; container: string } => {
    switch (size) {
      case 'sm':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          container: 'space-x-2 space-y-1'
        };
      case 'lg':
        return {
          dot: 'w-4 h-4',
          text: 'text-base',
          container: 'space-x-4 space-y-2'
        };
      default:
        return {
          dot: 'w-3 h-3',
          text: 'text-sm',
          container: 'space-x-3 space-y-1.5'
        };
    }
  };

  const connectionConfig = getConnectionConfig(connectionStatus);
  const recordingConfig = getRecordingConfig(recordingStatus);
  const transcriptionConfig = getTranscriptionConfig(transcriptionStatus);
  const sizeClasses = getSizeClasses(size);

  const renderStatusItem = (config: StatusConfig, type: string) => (
    <div 
      key={type}
      className="flex items-center space-x-2 relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="relative">
        <div 
          className={`
            ${config.color} ${sizeClasses.dot} rounded-full
            ${config.animated ? 'animate-pulse' : ''}
          `}
        />
        {config.animated && (
          <div 
            className={`
              absolute inset-0 ${config.color} ${sizeClasses.dot} rounded-full 
              animate-ping opacity-30
            `}
          />
        )}
      </div>
      
      {showLabels && (
        <span className={`${sizeClasses.text} text-foreground font-medium`}>
          {config.label}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && showDetails && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-background border border-border rounded-md shadow-lg px-3 py-2 text-xs whitespace-nowrap">
            <div className="font-medium text-foreground">{config.label}</div>
            <div className="text-muted-foreground">{config.description}</div>
            <div className="text-muted-foreground mt-1">
              Updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const getLayoutClasses = (): string => {
    switch (layout) {
      case 'vertical':
        return 'flex flex-col space-y-3';
      case 'compact':
        return 'flex items-center space-x-1';
      default:
        return 'flex items-center space-x-4';
    }
  };

  return (
    <div className={`${getLayoutClasses()} ${className}`}>
      {renderStatusItem(connectionConfig, 'connection')}
      {renderStatusItem(recordingConfig, 'recording')}
      {renderStatusItem(transcriptionConfig, 'transcription')}
    </div>
  );
}

/**
 * CompactStatusIndicator - Minimal status display
 */
interface CompactStatusIndicatorProps {
  connectionStatus: WebSocketState;
  recordingStatus: RecordingStatus;
  isActive: boolean;
  className?: string;
}

export function CompactStatusIndicator({
  connectionStatus,
  recordingStatus,
  isActive,
  className = ''
}: CompactStatusIndicatorProps) {
  const getOverallStatus = (): { color: string; animated: boolean } => {
    if (connectionStatus === WebSocketState.ERROR || recordingStatus === RecordingStatus.ERROR) {
      return { color: 'bg-red-500', animated: false };
    }
    if (connectionStatus === WebSocketState.DISCONNECTED) {
      return { color: 'bg-gray-500', animated: false };
    }
    if (isActive) {
      return { color: 'bg-green-500', animated: true };
    }
    if (connectionStatus === WebSocketState.CONNECTED) {
      return { color: 'bg-blue-500', animated: false };
    }
    return { color: 'bg-yellow-500', animated: true };
  };

  const status = getOverallStatus();

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`
          w-3 h-3 rounded-full ${status.color}
          ${status.animated ? 'animate-pulse' : ''}
        `}
      />
      {status.animated && (
        <div 
          className={`
            absolute inset-0 w-3 h-3 rounded-full ${status.color}
            animate-ping opacity-30
          `}
        />
      )}
    </div>
  );
}

/**
 * DetailedStatusPanel - Comprehensive status information
 */
interface DetailedStatusPanelProps {
  connectionStatus: WebSocketState;
  recordingStatus: RecordingStatus;
  transcriptionStatus: TranscriptionStatus;
  statistics?: {
    uptime: number;
    messagesExchanged: number;
    errorCount: number;
    lastError?: string;
  };
  className?: string;
}

export function DetailedStatusPanel({
  connectionStatus,
  recordingStatus,
  transcriptionStatus,
  statistics,
  className = ''
}: DetailedStatusPanelProps) {
  const formatUptime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getOverallHealth = (): { status: string; color: string } => {
    if (connectionStatus === WebSocketState.ERROR || recordingStatus === RecordingStatus.ERROR) {
      return { status: 'Error', color: 'text-red-500' };
    }
    if (connectionStatus === WebSocketState.DISCONNECTED) {
      return { status: 'Offline', color: 'text-gray-500' };
    }
    if (connectionStatus === WebSocketState.CONNECTED && recordingStatus !== RecordingStatus.ERROR) {
      return { status: 'Healthy', color: 'text-green-500' };
    }
    return { status: 'Warning', color: 'text-yellow-500' };
  };

  const health = getOverallHealth();

  return (
    <div className={`p-4 bg-card border border-border rounded-lg space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">System Status</h3>
        <div className={`text-sm font-medium ${health.color}`}>
          {health.status}
        </div>
      </div>

      {/* Status Indicators */}
      <StatusIndicator
        connectionStatus={connectionStatus}
        recordingStatus={recordingStatus}
        transcriptionStatus={transcriptionStatus}
        showLabels={true}
        showDetails={true}
        layout="vertical"
      />

      {/* Statistics */}
      {statistics && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Statistics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uptime:</span>
              <div className="font-mono text-foreground">
                {formatUptime(statistics.uptime)}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Messages:</span>
              <div className="font-mono text-foreground">
                {statistics.messagesExchanged}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Errors:</span>
              <div className="font-mono text-foreground">
                {statistics.errorCount}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Health:</span>
              <div className={`font-mono ${health.color}`}>
                {health.status}
              </div>
            </div>
          </div>

          {/* Last Error */}
          {statistics.lastError && (
            <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs">
              <span className="text-destructive font-medium">Last Error:</span>
              <div className="text-destructive/80 mt-1">
                {statistics.lastError}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">
            Refresh
          </button>
          <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">
            Test Connection
          </button>
          <button className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/80">
            View Logs
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * StatusBadge - Simple status badge component
 */
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'error' | 'warning';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ 
  status, 
  label, 
  size = 'md', 
  className = '' 
}: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'online':
        return { color: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' };
      case 'offline':
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', dot: 'bg-gray-500' };
      case 'error':
        return { color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' };
      case 'warning':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', dot: 'bg-gray-500' };
    }
  };

  const config = getStatusConfig(status);
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className={`
      inline-flex items-center space-x-1.5 rounded-full border font-medium
      ${config.color} ${sizeClass} ${className}
    `}>
      <span className={`${dotSize} rounded-full ${config.dot}`} />
      {label && <span>{label}</span>}
    </span>
  );
}
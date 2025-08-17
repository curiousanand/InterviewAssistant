'use client';

import React from 'react';
import { ConnectionState } from '../../types';

/**
 * StatusIndicator - Displays connection status with visual feedback
 * 
 * Why: Provides clear visual feedback about system status
 * Pattern: Presentational Component - shows status information clearly
 * Rationale: Users need immediate feedback about connection and recording status
 */

interface StatusIndicatorProps {
  connectionState: ConnectionState;
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({
  connectionState,
  className = '',
  showDetails = false,
  size = 'md'
}: StatusIndicatorProps) {
  const getStatusInfo = () => {
    switch (connectionState.status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-600',
          icon: '●',
          text: 'Connected',
          description: 'Real-time communication active'
        };
      case 'connecting':
        return {
          color: 'bg-blue-500 animate-pulse',
          textColor: 'text-blue-600',
          icon: '○',
          text: 'Connecting',
          description: 'Establishing connection...'
        };
      case 'reconnecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          textColor: 'text-yellow-600',
          icon: '◐',
          text: 'Reconnecting',
          description: `Attempt ${connectionState.reconnectAttempts}`
        };
      case 'disconnected':
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-600',
          icon: '○',
          text: 'Disconnected',
          description: 'No connection to server'
        };
      case 'error':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-600',
          icon: '●',
          text: 'Error',
          description: connectionState.error || 'Connection error'
        };
      default:
        return {
          color: 'bg-gray-400',
          textColor: 'text-gray-500',
          icon: '?',
          text: 'Unknown',
          description: 'Status unknown'
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { dot: 'w-2 h-2', text: 'text-xs' };
      case 'lg':
        return { dot: 'w-4 h-4', text: 'text-base' };
      default:
        return { dot: 'w-3 h-3', text: 'text-sm' };
    }
  };

  const statusInfo = getStatusInfo();
  const sizeClasses = getSizeClasses();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses.dot} rounded-full ${statusInfo.color}`} />
      
      <div className="flex flex-col">
        <span className={`${sizeClasses.text} font-medium ${statusInfo.textColor}`}>
          {statusInfo.text}
        </span>
        
        {showDetails && (
          <span className="text-xs text-muted-foreground">
            {statusInfo.description}
          </span>
        )}
      </div>
      
      {connectionState.lastConnected && showDetails && (
        <span className="text-xs text-muted-foreground">
          Last: {connectionState.lastConnected.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

/**
 * ConnectionIndicator - Simple connection status indicator
 */
interface ConnectionIndicatorProps {
  isConnected: boolean;
  isConnecting?: boolean;
  className?: string;
  showText?: boolean;
}

export function ConnectionIndicator({
  isConnected,
  isConnecting = false,
  className = '',
  showText = true
}: ConnectionIndicatorProps) {
  const getStatus = () => {
    if (isConnecting) {
      return {
        color: 'bg-blue-500 animate-pulse',
        text: 'Connecting...',
        icon: '○'
      };
    } else if (isConnected) {
      return {
        color: 'bg-green-500',
        text: 'Connected',
        icon: '●'
      };
    } else {
      return {
        color: 'bg-red-500',
        text: 'Disconnected',
        icon: '○'
      };
    }
  };

  const status = getStatus();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${status.color}`} />
      {showText && (
        <span className="text-sm text-muted-foreground">
          {status.text}
        </span>
      )}
    </div>
  );
}

/**
 * RecordingIndicator - Shows recording status with audio level
 */
interface RecordingIndicatorProps {
  isRecording: boolean;
  isProcessing?: boolean;
  audioLevel?: number;
  className?: string;
  showWaveform?: boolean;
}

export function RecordingIndicator({
  isRecording,
  isProcessing = false,
  audioLevel = 0,
  className = '',
  showWaveform = false
}: RecordingIndicatorProps) {
  if (!isRecording && !isProcessing) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Recording Dot */}
      <div className="flex items-center space-x-2">
        <div 
          className={`w-3 h-3 rounded-full ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-500'
          }`} 
        />
        <span className="text-sm text-muted-foreground">
          {isRecording ? 'Recording' : 'Processing'}
        </span>
      </div>

      {/* Audio Level Waveform */}
      {showWaveform && isRecording && (
        <div className="flex items-center space-x-1">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-1 bg-green-500 rounded-full transition-all duration-100 ${
                i < Math.ceil(audioLevel * 5) ? 'h-4' : 'h-1'
              }`}
            />
          ))}
        </div>
      )}

      {/* Audio Level Percentage */}
      {isRecording && audioLevel > 0 && !showWaveform && (
        <span className="text-xs text-muted-foreground">
          {Math.round(audioLevel * 100)}%
        </span>
      )}
    </div>
  );
}
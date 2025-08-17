'use client';

import React, { useEffect, useState } from 'react';
import { RecordingState } from '../../types';

/**
 * MicrophoneButton - Recording control with visual feedback
 * 
 * Why: Provides intuitive recording controls with visual feedback
 * Pattern: Controlled Component - state managed by parent
 * Rationale: Follows PRD specifications for recording UI
 */

interface MicrophoneButtonProps {
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showAudioLevel?: boolean;
}

export function MicrophoneButton({
  recordingState,
  onStartRecording,
  onStopRecording,
  disabled = false,
  className = '',
  size = 'lg',
  showLabel = true,
  showAudioLevel = true
}: MicrophoneButtonProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  
  // Debug logging
  console.log('MicrophoneButton render:', {
    recordingState,
    isRecording: recordingState.isRecording,
    isProcessing: recordingState.isProcessing,
    disabled,
    timestamp: new Date().toISOString(),
    componentKey: React.useId()
  });

  useEffect(() => {
    console.log('useEffect triggered - recordingState.isRecording changed:', recordingState.isRecording);
    if (recordingState.isRecording) {
      setPulseAnimation(true);
    } else {
      setPulseAnimation(false);
    }
  }, [recordingState.isRecording]);

  // Force re-render when any recording state property changes
  useEffect(() => {
    console.log('useEffect triggered - recordingState changed:', {
      recordingState,
      timestamp: new Date().toISOString()
    });
  }, [recordingState, recordingState.isRecording, recordingState.isProcessing, recordingState.error]);

  // Debug: Force re-render counter
  const [renderCounter, setRenderCounter] = useState(0);
  useEffect(() => {
    setRenderCounter(prev => prev + 1);
  }, [recordingState]);

  const handleClick = () => {
    if (disabled || recordingState.isProcessing) {
      return;
    }

    if (recordingState.isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-12 h-12';
      case 'md':
        return 'w-16 h-16';
      case 'lg':
        return 'w-20 h-20';
      default:
        return 'w-20 h-20';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm':
        return 'w-5 h-5';
      case 'md':
        return 'w-6 h-6';
      case 'lg':
        return 'w-8 h-8';
      default:
        return 'w-8 h-8';
    }
  };

  const getButtonState = () => {
    console.log('getButtonState check:', {
      disabled,
      isProcessing: recordingState.isProcessing,
      isRecording: recordingState.isRecording,
      error: recordingState.error,
      recordingStateObject: recordingState
    });
    
    if (disabled) return 'disabled';
    if (recordingState.error) return 'error';
    if (recordingState.isRecording) return 'recording';  // Recording takes priority over processing
    if (recordingState.isProcessing) return 'processing';
    return 'idle';
  };

  // Calculate button state directly with explicit logic to avoid closure issues
  const buttonState = React.useMemo(() => {
    const debugInfo = {
      disabled,
      error: recordingState.error,
      isRecording: recordingState.isRecording,
      isProcessing: recordingState.isProcessing,
      fullRecordingState: recordingState,
      renderCounter,
      timestamp: new Date().toISOString()
    };
    console.log('Computing button state with values:', debugInfo);
    
    let state;
    if (disabled) {
      console.log('Button state: disabled (button is disabled)');
      state = 'disabled';
    } else if (recordingState.error) {
      console.log('Button state: error (has error)');
      state = 'error';
    } else if (recordingState.isRecording === true) {
      console.log('Button state: recording (isRecording is true)');
      state = 'recording';
    } else if (recordingState.isProcessing === true) {
      console.log('Button state: processing (isProcessing is true)');
      state = 'processing';
    } else {
      console.log('Button state: idle (default case)');
      state = 'idle';
    }
    
    console.log('Final button state:', state, 'for values:', debugInfo);
    return state;
  }, [disabled, recordingState.error, recordingState.isRecording, recordingState.isProcessing, recordingState, renderCounter]);

  const getButtonClasses = () => {
    const baseClasses = `
      relative rounded-full transition-all duration-200 focus:outline-none focus:ring-4
      ${getSizeClasses()}
      ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
    `;

    console.log('getButtonClasses - Button state:', buttonState, 'Recording:', recordingState.isRecording, 'Disabled:', disabled);

    // Force recording style if isRecording is true, regardless of computed state
    if (recordingState.isRecording === true && !disabled) {
      console.log('FORCING RECORDING STYLE - recordingState.isRecording is true');
      return `${baseClasses} bg-red-500 hover:bg-red-600 focus:ring-red-200 shadow-lg text-white ${pulseAnimation ? 'animate-pulse' : ''}`;
    }

    switch (buttonState) {
      case 'recording':
        console.log('Applying recording style via switch case');
        return `${baseClasses} bg-red-500 hover:bg-red-600 focus:ring-red-200 shadow-lg text-white ${pulseAnimation ? 'animate-pulse' : ''}`;
      case 'processing':
        console.log('Applying processing style');
        return `${baseClasses} bg-blue-500 focus:ring-blue-200 shadow-lg animate-spin text-white`;
      case 'error':
        console.log('Applying error style');
        return `${baseClasses} bg-red-400 hover:bg-red-500 focus:ring-red-200 text-white`;
      case 'disabled':
        console.log('Applying disabled style');
        return `${baseClasses} bg-gray-300 text-gray-500`;
      default:
        console.log('Applying default idle style');
        return `${baseClasses} bg-blue-500 hover:bg-blue-600 focus:ring-blue-200 shadow-md hover:shadow-lg text-white`;
    }
  };

  const getLabel = () => {
    switch (buttonState) {
      case 'recording':
        return 'Stop Recording';
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Error - Retry';
      case 'disabled':
        return 'Microphone Disabled';
      default:
        return 'Start Recording';
    }
  };

  const renderIcon = () => {
    const iconClasses = `${getIconSize()} text-white`;

    // Force stop icon if recording, regardless of computed state
    if (recordingState.isRecording === true && !disabled) {
      console.log('FORCING STOP ICON - recordingState.isRecording is true');
      return <StopIcon className={iconClasses} />;
    }

    console.log('Rendering icon for state:', buttonState);
    switch (buttonState) {
      case 'recording':
        console.log('Rendering stop icon via switch case');
        return <StopIcon className={iconClasses} />;
      case 'processing':
        console.log('Rendering loading icon');
        return <LoadingIcon className={iconClasses} />;
      case 'error':
        console.log('Rendering error icon');
        return <ErrorIcon className={iconClasses} />;
      default:
        console.log('Rendering microphone icon (default)');
        return <MicrophoneIcon className={iconClasses} />;
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-3 ${className}`}>
      {/* Audio Level Visualizer */}
      {showAudioLevel && recordingState.isRecording && (
        <AudioLevelVisualizer 
          level={recordingState.audioLevel} 
          size={size}
        />
      )}

      {/* Main Button */}
      <button
        onClick={handleClick}
        disabled={disabled || recordingState.isProcessing}
        className={getButtonClasses()}
        style={recordingState.isRecording ? { backgroundColor: '#ef4444', color: 'white' } : {}}
        aria-label={getLabel()}
        type="button"
      >
        {/* Audio Level Ring */}
        {recordingState.isRecording && recordingState.audioLevel > 0 && (
          <div 
            className="absolute inset-0 rounded-full border-4 border-white/30 transition-all duration-100"
            style={{
              transform: `scale(${1 + recordingState.audioLevel * 0.3})`,
              opacity: recordingState.audioLevel
            }}
          />
        )}

        {/* Icon */}
        <div className="flex items-center justify-center">
          {recordingState.isRecording ? <StopIcon className={`${getIconSize()} text-white`} /> : renderIcon()}
        </div>
      </button>

      {/* Label */}
      {showLabel && (
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">
            {recordingState.isRecording ? 'Stop Recording' : getLabel()}
          </div>
          {recordingState.error && (
            <div className="text-xs text-red-500 mt-1">
              {recordingState.error}
            </div>
          )}
        </div>
      )}

      {/* Recording Status */}
      {recordingState.isRecording && (
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>Recording...</span>
        </div>
      )}
    </div>
  );
}

/**
 * AudioLevelVisualizer - Shows audio level with animated bars
 */
interface AudioLevelVisualizerProps {
  level: number;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}

function AudioLevelVisualizer({ level, size, className = '' }: AudioLevelVisualizerProps) {
  const bars = 5;
  const activeBarCount = Math.ceil(level * bars);

  const getBarHeight = () => {
    switch (size) {
      case 'sm':
        return 'h-3';
      case 'md':
        return 'h-4';
      case 'lg':
        return 'h-5';
      default:
        return 'h-5';
    }
  };

  return (
    <div className={`flex items-end space-x-1 ${className}`}>
      {Array.from({ length: bars }, (_, index) => (
        <div
          key={index}
          className={`
            w-1 rounded-full transition-all duration-100
            ${getBarHeight()}
            ${index < activeBarCount 
              ? level > 0.7 ? 'bg-red-500' : level > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
              : 'bg-gray-300'
            }
          `}
          style={{
            transform: index < activeBarCount ? `scaleY(${0.3 + (level * 0.7)})` : 'scaleY(0.3)',
            transformOrigin: 'bottom'
          }}
        />
      ))}
    </div>
  );
}

/**
 * RecordingVisualizer - Circular waveform visualization
 */
interface RecordingVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
  size?: number;
  className?: string;
}

export function RecordingVisualizer({ 
  isRecording, 
  audioLevel, 
  size = 120,
  className = '' 
}: RecordingVisualizerProps) {
  const bars = 20;
  const radius = size / 2 - 10;

  if (!isRecording) return null;

  return (
    <div 
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0">
        {Array.from({ length: bars }, (_, index) => {
          const angle = (index / bars) * 2 * Math.PI;
          const barHeight = 5 + (audioLevel * 25 * Math.random());
          const x1 = size / 2 + Math.cos(angle) * radius;
          const y1 = size / 2 + Math.sin(angle) * radius;
          const x2 = size / 2 + Math.cos(angle) * (radius + barHeight);
          const y2 = size / 2 + Math.sin(angle) * (radius + barHeight);

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-primary transition-all duration-100"
              style={{
                opacity: 0.6 + (audioLevel * 0.4),
                animationDelay: `${index * 50}ms`
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

// Icon components
const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const StopIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h12v12H6z" />
  </svg>
);

const LoadingIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ErrorIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
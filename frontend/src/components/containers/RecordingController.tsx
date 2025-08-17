'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { AudioWorkflowService } from '@/services/AudioWorkflowService';
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * RecordingController - Controls audio recording lifecycle and status
 * 
 * Why: Provides comprehensive recording controls and status feedback
 * Pattern: Controller Component - manages recording state and user interactions
 * Rationale: Centralizes all recording-related functionality and UI state
 */

interface RecordingControllerProps {
  webSocketClient: IWebSocketClient;
  className?: string;
  onRecordingStart?: () => void;
  onRecordingStop?: (duration: number) => void;
  onError?: (error: Error) => void;
  onAudioLevel?: (level: number) => void;
  recordingMode?: RecordingMode;
  enableVAD?: boolean;
  maxDuration?: number; // in milliseconds
}

enum RecordingMode {
  MANUAL = 'manual',           // Push to talk
  CONTINUOUS = 'continuous',   // Always recording
  VOICE_ACTIVATED = 'voice_activated'  // Start/stop on voice detection
}

enum RecordingState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RECORDING = 'recording',
  PAUSED = 'paused',
  PROCESSING = 'processing',
  ERROR = 'error'
}

interface RecordingStats {
  duration: number;
  audioLevel: number;
  isVoiceActive: boolean;
  qualityScore: number;
  bytesTransmitted: number;
}

export function RecordingController({
  webSocketClient,
  className = '',
  onRecordingStart,
  onRecordingStop,
  onError,
  onAudioLevel,
  recordingMode = RecordingMode.MANUAL,
  enableVAD = true,
  maxDuration = 300000 // 5 minutes
}: RecordingControllerProps) {
  // State management
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [recordingStats, setRecordingStats] = useState<RecordingStats>({
    duration: 0,
    audioLevel: 0,
    isVoiceActive: false,
    qualityScore: 0,
    bytesTransmitted: 0
  });
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  // Refs
  const audioWorkflowRef = useRef<AudioWorkflowService | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);
  const audioLevelRef = useRef<number>(0);

  // Audio recording hook
  const audioRecording = useAudioRecording({
    onAudioData: (data) => {
      // Calculate audio level for visualization
      const level = calculateAudioLevel(data);
      audioLevelRef.current = level;
      onAudioLevel?.(level);
    },
    onError: (error) => {
      console.error('Audio recording error:', error);
      setRecordingState(RecordingState.ERROR);
      onError?.(error);
    }
  });

  // Initialize audio workflow service
  useEffect(() => {
    if (webSocketClient && !audioWorkflowRef.current) {
      audioWorkflowRef.current = new AudioWorkflowService(
        webSocketClient,
        {
          chunkSize: 100, // 100ms chunks
          sampleRate: 16000,
          channels: 1,
          enableVAD: enableVAD,
          vadThreshold: 0.3,
          silenceTimeout: 2000,
          maxRecordingDuration: maxDuration
        },
        {
          onStreamStarted: () => {
            setRecordingState(RecordingState.RECORDING);
            recordingStartTimeRef.current = Date.now();
            startDurationTimer();
            onRecordingStart?.();
          },
          onStreamStopped: (metrics) => {
            setRecordingState(RecordingState.IDLE);
            stopDurationTimer();
            const duration = Date.now() - recordingStartTimeRef.current;
            onRecordingStop?.(duration);
            
            setRecordingStats(prev => ({
              ...prev,
              bytesTransmitted: metrics.totalBytes
            }));
          },
          onVoiceActivityDetected: (isActive, confidence) => {
            setRecordingStats(prev => ({
              ...prev,
              isVoiceActive: isActive
            }));

            // Auto-start/stop for voice activated mode
            if (recordingMode === RecordingMode.VOICE_ACTIVATED) {
              if (isActive && recordingState === RecordingState.IDLE) {
                startRecording();
              } else if (!isActive && recordingState === RecordingState.RECORDING && confidence < 0.2) {
                // Stop after low confidence for a period
                setTimeout(() => {
                  if (recordingState === RecordingState.RECORDING && !recordingStats.isVoiceActive) {
                    stopRecording();
                  }
                }, 1500);
              }
            }
          },
          onQualityChanged: (score) => {
            setRecordingStats(prev => ({
              ...prev,
              qualityScore: score
            }));
          },
          onError: (error) => {
            console.error('Audio workflow error:', error);
            setRecordingState(RecordingState.ERROR);
            onError?.(new Error(error.message));
          }
        }
      );
    }
  }, [webSocketClient, enableVAD, maxDuration, recordingMode, recordingState, recordingStats.isVoiceActive, onRecordingStart, onRecordingStop, onError]);

  // Get available audio devices
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAvailableDevices(audioInputs);
        
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to get audio devices:', error);
      }
    };

    getAudioDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, [selectedDevice]);

  // Duration timer
  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = window.setInterval(() => {
      if (recordingStartTimeRef.current > 0) {
        const duration = Date.now() - recordingStartTimeRef.current;
        setRecordingStats(prev => ({
          ...prev,
          duration,
          audioLevel: audioLevelRef.current
        }));

        // Auto-stop at max duration
        if (duration >= maxDuration) {
          stopRecording();
        }
      }
    }, 100);
  }, [maxDuration]);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Recording control functions
  const startRecording = useCallback(async () => {
    if (recordingState !== RecordingState.IDLE) {
      return;
    }

    try {
      setRecordingState(RecordingState.INITIALIZING);
      
      if (audioWorkflowRef.current) {
        await audioWorkflowRef.current.startWorkflow();
      } else {
        await audioRecording.startRecording();
        setRecordingState(RecordingState.RECORDING);
        recordingStartTimeRef.current = Date.now();
        startDurationTimer();
        onRecordingStart?.();
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState(RecordingState.ERROR);
      onError?.(error as Error);
    }
  }, [recordingState, audioRecording, onRecordingStart, onError, startDurationTimer]);

  const stopRecording = useCallback(async () => {
    if (recordingState !== RecordingState.RECORDING) {
      return;
    }

    try {
      setRecordingState(RecordingState.PROCESSING);
      
      if (audioWorkflowRef.current) {
        const metrics = await audioWorkflowRef.current.stopWorkflow();
        setRecordingStats(prev => ({
          ...prev,
          bytesTransmitted: metrics.totalBytes
        }));
      } else {
        await audioRecording.stopRecording();
        stopDurationTimer();
        const duration = Date.now() - recordingStartTimeRef.current;
        onRecordingStop?.(duration);
      }
      
      setRecordingState(RecordingState.IDLE);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setRecordingState(RecordingState.ERROR);
      onError?.(error as Error);
    }
  }, [recordingState, audioRecording, onRecordingStop, onError, stopDurationTimer]);

  const pauseRecording = useCallback(async () => {
    if (recordingState === RecordingState.RECORDING) {
      if (audioWorkflowRef.current) {
        audioWorkflowRef.current.pauseWorkflow();
      }
      setRecordingState(RecordingState.PAUSED);
      stopDurationTimer();
    }
  }, [recordingState, stopDurationTimer]);

  const resumeRecording = useCallback(async () => {
    if (recordingState === RecordingState.PAUSED) {
      if (audioWorkflowRef.current) {
        audioWorkflowRef.current.resumeWorkflow();
      }
      setRecordingState(RecordingState.RECORDING);
      startDurationTimer();
    }
  }, [recordingState, startDurationTimer]);

  const toggleRecording = useCallback(async () => {
    if (recordingState === RecordingState.IDLE) {
      await startRecording();
    } else if (recordingState === RecordingState.RECORDING) {
      await stopRecording();
    }
  }, [recordingState, startRecording, stopRecording]);

  // Utility functions
  const calculateAudioLevel = (audioData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getRecordingStateColor = (): string => {
    switch (recordingState) {
      case RecordingState.RECORDING:
        return 'text-red-500';
      case RecordingState.PAUSED:
        return 'text-yellow-500';
      case RecordingState.PROCESSING:
        return 'text-blue-500';
      case RecordingState.ERROR:
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const isRecordingActive = recordingState === RecordingState.RECORDING;
  const canRecord = recordingState === RecordingState.IDLE;
  const canStop = recordingState === RecordingState.RECORDING;
  const canPause = recordingState === RecordingState.RECORDING && recordingMode !== RecordingMode.VOICE_ACTIVATED;
  const canResume = recordingState === RecordingState.PAUSED;

  return (
    <div className={`p-4 bg-card border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Recording Control</h3>
        <button
          onClick={() => setShowAdvancedControls(!showAdvancedControls)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvancedControls ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {/* Main Controls */}
      <div className="flex items-center space-x-4 mb-4">
        {/* Primary Record Button */}
        <button
          onClick={toggleRecording}
          disabled={recordingState === RecordingState.INITIALIZING || recordingState === RecordingState.PROCESSING}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isRecordingActive
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : canRecord
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={isRecordingActive ? 'Stop recording' : 'Start recording'}
        >
          {isRecordingActive ? (
            <StopIcon className="w-6 h-6" />
          ) : (
            <MicIcon className="w-6 h-6" />
          )}
        </button>

        {/* Pause/Resume */}
        {recordingMode !== RecordingMode.VOICE_ACTIVATED && (
          <>
            {canPause && (
              <button
                onClick={pauseRecording}
                className="p-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                title="Pause recording"
              >
                <PauseIcon className="w-4 h-4" />
              </button>
            )}
            
            {canResume && (
              <button
                onClick={resumeRecording}
                className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                title="Resume recording"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Status */}
        <div className="flex-1">
          <div className={`text-sm font-medium ${getRecordingStateColor()}`}>
            {recordingState.charAt(0).toUpperCase() + recordingState.slice(1)}
          </div>
          <div className="text-xs text-muted-foreground">
            {recordingMode.replace('_', ' ').charAt(0).toUpperCase() + recordingMode.slice(1).replace('_', ' ')} mode
          </div>
        </div>
      </div>

      {/* Stats Display */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-mono text-foreground">
            {formatDuration(recordingStats.duration)}
          </div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </div>
        
        <div className="text-center">
          <div className="text-lg font-mono text-foreground">
            {Math.round(recordingStats.qualityScore * 100)}%
          </div>
          <div className="text-xs text-muted-foreground">Quality</div>
        </div>
      </div>

      {/* Audio Level Visualizer */}
      <div className="mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm text-muted-foreground">Audio Level</span>
          {enableVAD && (
            <div className={`w-2 h-2 rounded-full ${
              recordingStats.isVoiceActive ? 'bg-green-500' : 'bg-gray-300'
            }`} title={recordingStats.isVoiceActive ? 'Voice detected' : 'No voice'} />
          )}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-100"
            style={{ width: `${Math.min(recordingStats.audioLevel * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Advanced Controls */}
      {showAdvancedControls && (
        <div className="border-t border-border pt-4 space-y-4">
          {/* Device Selection */}
          {availableDevices.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Microphone
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full p-2 border border-input rounded-md bg-background text-foreground"
                disabled={isRecordingActive}
              >
                {availableDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recording Mode */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Recording Mode
            </label>
            <div className="space-y-2">
              {Object.values(RecordingMode).map((mode) => (
                <label key={mode} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="recordingMode"
                    value={mode}
                    checked={recordingMode === mode}
                    onChange={() => {}} // Would be controlled by parent
                    disabled={isRecordingActive}
                    className="text-primary"
                  />
                  <span className="text-sm text-foreground">
                    {mode.replace('_', ' ').charAt(0).toUpperCase() + mode.slice(1).replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Data transmitted:</span>
              <div className="font-mono">{(recordingStats.bytesTransmitted / 1024).toFixed(1)} KB</div>
            </div>
            <div>
              <span className="text-muted-foreground">Max duration:</span>
              <div className="font-mono">{formatDuration(maxDuration)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components
const MicIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const StopIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
);

const PauseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a2 2 0 002 2h2a2 2 0 002-2v-4m-6 0a2 2 0 012-2h2a2 2 0 012 2m-6 0V6a2 2 0 012-2h2a2 2 0 012 2v4" />
  </svg>
);
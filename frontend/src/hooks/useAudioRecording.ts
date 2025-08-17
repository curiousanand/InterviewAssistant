import { useState, useCallback, useEffect, useRef } from 'react';
import { IAudioCapture } from '@/types';
import { ServiceFactory } from '@/lib/services/serviceFactory';

interface UseAudioRecordingOptions {
  onAudioData?: (data: Float32Array) => void;
  onError?: (error: Error) => void;
}

export function useAudioRecording(options: UseAudioRecordingOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const audioCaptureRef = useRef<IAudioCapture | null>(null);

  const initialize = useCallback(async () => {
    try {
      if (!audioCaptureRef.current) {
        audioCaptureRef.current = ServiceFactory.createAudioCapture();
        
        if (options.onAudioData) {
          audioCaptureRef.current.onAudioData(options.onAudioData);
        }
      }
      
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize audio');
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [options.onAudioData, options.onError]);

  const startRecording = useCallback(async () => {
    if (!audioCaptureRef.current) {
      await initialize();
    }

    try {
      await audioCaptureRef.current?.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to start recording');
      setError(error);
      setIsRecording(false);
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [initialize, options.onError]);

  const stopRecording = useCallback(async () => {
    try {
      await audioCaptureRef.current?.stop();
      setIsRecording(false);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to stop recording');
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
    }
  }, [options.onError]);

  useEffect(() => {
    return () => {
      if (audioCaptureRef.current) {
        audioCaptureRef.current.cleanup();
      }
    };
  }, []);

  return {
    isRecording,
    isInitialized,
    error,
    startRecording,
    stopRecording,
    initialize,
  };
}
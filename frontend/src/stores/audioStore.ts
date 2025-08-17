import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AudioState {
  isRecording: boolean;
  isInitialized: boolean;
  volume: number;
  error: string | null;
  recordingMode: 'continuous' | 'push-to-talk' | 'voice-activated';
  
  // Actions
  setRecording: (recording: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setVolume: (volume: number) => void;
  setError: (error: string | null) => void;
  setRecordingMode: (mode: 'continuous' | 'push-to-talk' | 'voice-activated') => void;
  reset: () => void;
}

export const useAudioStore = create<AudioState>()(
  devtools(
    (set) => ({
      isRecording: false,
      isInitialized: false,
      volume: 0,
      error: null,
      recordingMode: 'continuous',

      setRecording: (recording) => set({ isRecording: recording }),

      setInitialized: (initialized) => set({ isInitialized: initialized }),

      setVolume: (volume) => set({ volume }),

      setError: (error) => set({ error }),

      setRecordingMode: (mode) => set({ recordingMode: mode }),

      reset: () =>
        set({
          isRecording: false,
          isInitialized: false,
          volume: 0,
          error: null,
          recordingMode: 'continuous',
        }),
    }),
    {
      name: 'audio-store',
    }
  )
);
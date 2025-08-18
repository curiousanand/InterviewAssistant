/**
 * Integration tests for AudioStreamingService
 */

import { AudioStreamingService } from '../../../src/lib/services/AudioStreamingService';
import { InterviewWebSocketClient } from '../../../src/lib/websocket/InterviewWebSocketClient';
import { MockWebSocketClient } from '../../utils/test-utils';

jest.mock('../../../src/lib/websocket/InterviewWebSocketClient');

describe('AudioStreamingService Integration', () => {
  let audioService: AudioStreamingService;
  let mockWsClient: MockWebSocketClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWsClient = new MockWebSocketClient();
    (InterviewWebSocketClient as jest.Mock).mockImplementation(() => mockWsClient);
    audioService = new AudioStreamingService(mockWsClient as any);
  });

  afterEach(async () => {
    await audioService.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize audio capture system', async () => {
      await audioService.initialize();

      expect(audioService.isRecording()).toBe(false);
      expect(audioService.getAudioLevel()).toBe(0);
    });

    it('should handle initialization failure gracefully', async () => {
      // Mock getUserMedia failure
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
        new Error('Permission denied')
      );

      await expect(audioService.initialize()).rejects.toThrow('Permission denied');

      // Restore original
      navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    });
  });

  describe('Recording Lifecycle', () => {
    beforeEach(async () => {
      await audioService.initialize();
    });

    it('should start and stop recording', async () => {
      // Start recording
      await audioService.startRecording();
      
      expect(audioService.isRecording()).toBe(true);
      expect(mockWsClient.startSession).toHaveBeenCalled();

      // Stop recording
      await audioService.stopRecording();
      
      expect(audioService.isRecording()).toBe(false);
    });

    it('should not start recording if already recording', async () => {
      await audioService.startRecording();
      const firstState = audioService.getRecordingState();

      // Try to start again
      await audioService.startRecording();
      const secondState = audioService.getRecordingState();

      expect(firstState).toEqual(secondState);
      expect(mockWsClient.startSession).toHaveBeenCalledTimes(1);
    });

    it('should handle WebSocket disconnection during recording', async () => {
      mockWsClient.isConnected.mockReturnValue(false);

      await expect(audioService.startRecording()).rejects.toThrow(
        'Failed to establish WebSocket connection'
      );
    });

    it('should send audio data when connected', async () => {
      mockWsClient.isConnected.mockReturnValue(true);
      
      await audioService.startRecording();

      // Simulate audio data
      const audioData = new Float32Array([0.1, 0.2, 0.3]);
      const handler = (audioService as any).handleAudioData.bind(audioService);
      handler(audioData);

      expect(mockWsClient.sendAudioData).toHaveBeenCalled();
    });
  });

  describe('Audio Level Monitoring', () => {
    it('should update audio level during recording', async () => {
      await audioService.initialize();
      
      let audioLevelUpdates = 0;
      audioService.onRecordingStateChange((state) => {
        if (state.audioLevel > 0) {
          audioLevelUpdates++;
        }
      });

      await audioService.startRecording();

      // Simulate audio data with non-zero level
      const audioData = new Float32Array([0.5, 0.5, 0.5]);
      const handler = (audioService as any).handleAudioData.bind(audioService);
      handler(audioData);

      // Wait for audio level update
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(audioService.getAudioLevel()).toBeGreaterThan(0);
    });
  });

  describe('Voice Activity Detection', () => {
    it('should detect speech in audio data', () => {
      const performVAD = (audioService as any).performVAD.bind(audioService);
      
      // Silence
      const silentData = new Float32Array(100).fill(0);
      const silentResult = performVAD(silentData);
      expect(silentResult.isSpeech).toBe(false);

      // Speech (louder audio)
      const speechData = new Float32Array(100).fill(0.5);
      const speechResult = performVAD(speechData);
      expect(speechResult.isSpeech).toBe(true);
      expect(speechResult.audioLevel).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should emit errors through event handler', async () => {
      const errorHandler = jest.fn();
      audioService.onErrorOccurred(errorHandler);

      await audioService.initialize();

      // Trigger an error
      mockWsClient.sendAudioData.mockRejectedValue(new Error('Network error'));
      
      await audioService.startRecording();

      // Simulate audio data to trigger send
      const audioData = new Float32Array([0.1, 0.2, 0.3]);
      const handler = (audioService as any).handleAudioData.bind(audioService);
      handler(audioData);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalledWith('Error processing audio data');
    });
  });

  describe('State Management', () => {
    it('should maintain consistent recording state', async () => {
      await audioService.initialize();

      const states: any[] = [];
      audioService.onRecordingStateChange((state) => {
        states.push({ ...state });
      });

      await audioService.startRecording();
      await audioService.stopRecording();

      // Should have at least: processing start, recording true, recording false
      expect(states.length).toBeGreaterThanOrEqual(3);
      expect(states.some(s => s.isProcessing)).toBe(true);
      expect(states.some(s => s.isRecording)).toBe(true);
      expect(states[states.length - 1].isRecording).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      await audioService.initialize();
      await audioService.startRecording();
      
      await audioService.cleanup();

      expect(audioService.isRecording()).toBe(false);
      expect(audioService.getAudioLevel()).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      await audioService.initialize();
      
      // Mock cleanup error
      const stopMock = jest.fn().mockRejectedValue(new Error('Cleanup failed'));
      (audioService as any).audioCapture = { 
        stop: stopMock,
        removeAllListeners: jest.fn()
      };

      // Should not throw
      await expect(audioService.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Diagnostics', () => {
    it('should provide diagnostic information', async () => {
      await audioService.initialize();
      await audioService.startRecording();

      const diagnostics = await audioService.getDiagnostics();

      expect(diagnostics).toHaveProperty('isInitialized', true);
      expect(diagnostics).toHaveProperty('recordingState');
      expect(diagnostics).toHaveProperty('wsConnected', true);
      expect(diagnostics).toHaveProperty('audioCapabilities');
    });
  });
});
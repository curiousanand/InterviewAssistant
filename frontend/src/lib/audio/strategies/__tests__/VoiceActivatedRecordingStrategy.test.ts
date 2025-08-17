import { VoiceActivatedRecordingStrategy } from '../VoiceActivatedRecordingStrategy';

/**
 * Test suite for VoiceActivatedRecordingStrategy
 * 
 * Tests voice activity detection and automatic recording control
 * Rationale: Ensures hands-free recording functionality works correctly
 */

describe('VoiceActivatedRecordingStrategy', () => {
  let strategy: VoiceActivatedRecordingStrategy;
  let mockAudioCapture: any;
  let mockOnStart: jest.Mock;
  let mockOnStop: jest.Mock;
  let mockOnVoiceActivity: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOnStart = jest.fn();
    mockOnStop = jest.fn();
    mockOnVoiceActivity = jest.fn();

    mockAudioCapture = {
      start: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      isRecording: jest.fn(() => false),
      getCurrentLevel: jest.fn(() => 0),
    };

    strategy = new VoiceActivatedRecordingStrategy({
      threshold: 0.1,
      minSilenceDuration: 1000,
      maxRecordingDuration: 30000,
      onStart: mockOnStart,
      onStop: mockOnStop,
      onVoiceActivity: mockOnVoiceActivity,
    });
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultStrategy = new VoiceActivatedRecordingStrategy();

      expect(defaultStrategy.getConfiguration()).toEqual(
        expect.objectContaining({
          threshold: 0.05,
          minSilenceDuration: 2000,
          maxRecordingDuration: 60000,
        })
      );
    });

    it('should initialize with custom configuration', () => {
      const config = {
        threshold: 0.2,
        minSilenceDuration: 500,
        maxRecordingDuration: 15000,
      };

      const customStrategy = new VoiceActivatedRecordingStrategy(config);

      expect(customStrategy.getConfiguration()).toEqual(
        expect.objectContaining(config)
      );
    });
  });

  describe('audio capture setup', () => {
    it('should set up audio capture correctly', async () => {
      await strategy.setup(mockAudioCapture);

      expect(mockAudioCapture.addEventListener).toHaveBeenCalledWith(
        'audioLevel',
        expect.any(Function)
      );
    });

    it('should handle setup failure gracefully', async () => {
      mockAudioCapture.addEventListener.mockImplementation(() => {
        throw new Error('Setup failed');
      });

      await expect(strategy.setup(mockAudioCapture)).rejects.toThrow('Setup failed');
    });
  });

  describe('voice activity detection', () => {
    beforeEach(async () => {
      await strategy.setup(mockAudioCapture);
    });

    it('should detect voice activity above threshold', () => {
      // Get the audio level handler
      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Simulate audio level above threshold
      audioLevelHandler(0.15); // Above 0.1 threshold

      expect(mockOnVoiceActivity).toHaveBeenCalledWith(true);
    });

    it('should detect silence below threshold', () => {
      // First trigger voice activity
      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      audioLevelHandler(0.15); // Voice active
      expect(mockOnVoiceActivity).toHaveBeenCalledWith(true);

      // Then simulate silence
      audioLevelHandler(0.05); // Below threshold

      // Should still be considered active until silence duration met
      expect(strategy.isVoiceActive()).toBe(true);
    });

    it('should detect end of voice activity after silence duration', async () => {
      jest.useFakeTimers();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Start voice activity
      audioLevelHandler(0.15);
      expect(strategy.isVoiceActive()).toBe(true);

      // Drop below threshold
      audioLevelHandler(0.05);

      // Fast-forward past silence duration
      jest.advanceTimersByTime(1500); // Past 1000ms minSilenceDuration

      expect(mockOnVoiceActivity).toHaveBeenCalledWith(false);
      expect(strategy.isVoiceActive()).toBe(false);

      jest.useRealTimers();
    });

    it('should reset silence timer if voice returns', async () => {
      jest.useFakeTimers();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Start voice activity
      audioLevelHandler(0.15);

      // Drop below threshold
      audioLevelHandler(0.05);

      // Advance partially through silence duration
      jest.advanceTimersByTime(500);

      // Voice returns
      audioLevelHandler(0.12);

      // Advance past what would have been the original silence duration
      jest.advanceTimersByTime(600);

      // Should still be active since timer was reset
      expect(strategy.isVoiceActive()).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('recording control', () => {
    beforeEach(async () => {
      await strategy.setup(mockAudioCapture);
    });

    it('should start recording when voice detected', async () => {
      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Simulate voice activity
      audioLevelHandler(0.15);

      expect(mockAudioCapture.start).toHaveBeenCalled();
      expect(mockOnStart).toHaveBeenCalled();
      expect(strategy.isRecording()).toBe(true);
    });

    it('should stop recording after silence duration', async () => {
      jest.useFakeTimers();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Start voice activity and recording
      audioLevelHandler(0.15);
      mockAudioCapture.isRecording.mockReturnValue(true);

      // Simulate silence
      audioLevelHandler(0.05);

      // Fast-forward past silence duration
      jest.advanceTimersByTime(1500);

      expect(mockAudioCapture.stop).toHaveBeenCalled();
      expect(mockOnStop).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should stop recording at max duration', async () => {
      jest.useFakeTimers();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Start voice activity and recording
      audioLevelHandler(0.15);
      mockAudioCapture.isRecording.mockReturnValue(true);

      // Fast-forward to max recording duration
      jest.advanceTimersByTime(30500); // Past 30000ms maxRecordingDuration

      expect(mockAudioCapture.stop).toHaveBeenCalled();
      expect(mockOnStop).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not start multiple recordings simultaneously', async () => {
      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // First voice activity
      audioLevelHandler(0.15);
      mockAudioCapture.isRecording.mockReturnValue(true);

      // Second voice activity while already recording
      audioLevelHandler(0.20);

      // Should only call start once
      expect(mockAudioCapture.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('configuration updates', () => {
    it('should update threshold dynamically', async () => {
      await strategy.setup(mockAudioCapture);

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Test with original threshold (0.1)
      audioLevelHandler(0.08);
      expect(strategy.isVoiceActive()).toBe(false);

      // Update threshold
      strategy.updateConfiguration({ threshold: 0.05 });

      // Same level should now trigger voice activity
      audioLevelHandler(0.08);
      expect(strategy.isVoiceActive()).toBe(true);
    });

    it('should update silence duration dynamically', async () => {
      jest.useFakeTimers();

      await strategy.setup(mockAudioCapture);

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Start voice activity
      audioLevelHandler(0.15);

      // Update to shorter silence duration
      strategy.updateConfiguration({ minSilenceDuration: 500 });

      // Simulate silence
      audioLevelHandler(0.05);

      // Fast-forward past new shorter duration
      jest.advanceTimersByTime(600);

      expect(mockOnVoiceActivity).toHaveBeenCalledWith(false);

      jest.useRealTimers();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await strategy.setup(mockAudioCapture);
    });

    it('should handle audio capture start failure', async () => {
      mockAudioCapture.start.mockRejectedValue(new Error('Start failed'));

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Trigger voice activity
      audioLevelHandler(0.15);

      // Should handle error gracefully
      expect(strategy.isRecording()).toBe(false);
    });

    it('should handle audio capture stop failure', async () => {
      jest.useFakeTimers();

      mockAudioCapture.stop.mockRejectedValue(new Error('Stop failed'));

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Start recording
      audioLevelHandler(0.15);
      mockAudioCapture.isRecording.mockReturnValue(true);

      // Trigger stop via silence
      audioLevelHandler(0.05);
      jest.advanceTimersByTime(1500);

      // Should handle stop error gracefully
      expect(mockAudioCapture.stop).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('lifecycle management', () => {
    it('should stop strategy correctly', async () => {
      jest.useFakeTimers();

      await strategy.setup(mockAudioCapture);
      await strategy.start();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      // Start recording
      audioLevelHandler(0.15);
      mockAudioCapture.isRecording.mockReturnValue(true);

      await strategy.stop();

      expect(mockAudioCapture.stop).toHaveBeenCalled();
      expect(strategy.isRecording()).toBe(false);

      jest.useRealTimers();
    });

    it('should cleanup resources on destruction', async () => {
      await strategy.setup(mockAudioCapture);

      await strategy.cleanup();

      expect(mockAudioCapture.removeEventListener).toHaveBeenCalledWith(
        'audioLevel',
        expect.any(Function)
      );
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(async () => {
      await strategy.setup(mockAudioCapture);
    });

    it('should track voice activity statistics', async () => {
      jest.useFakeTimers();

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      await strategy.start();

      // Multiple voice activity sessions
      audioLevelHandler(0.15); // Voice 1 start
      jest.advanceTimersByTime(2000);
      audioLevelHandler(0.05); // Voice 1 end
      jest.advanceTimersByTime(1500);

      audioLevelHandler(0.20); // Voice 2 start
      jest.advanceTimersByTime(3000);
      audioLevelHandler(0.05); // Voice 2 end

      const stats = strategy.getStatistics();

      expect(stats.voiceActivitySessions).toBe(2);
      expect(stats.totalVoiceTime).toBeGreaterThan(0);
      expect(stats.averageVoiceLevel).toBeGreaterThan(0);

      jest.useRealTimers();
    });

    it('should provide current voice level', async () => {
      await strategy.setup(mockAudioCapture);

      const audioLevelHandler = mockAudioCapture.addEventListener.mock.calls
        .find(call => call[0] === 'audioLevel')?.[1];

      audioLevelHandler(0.15);

      expect(strategy.getCurrentVoiceLevel()).toBe(0.15);
    });
  });
});
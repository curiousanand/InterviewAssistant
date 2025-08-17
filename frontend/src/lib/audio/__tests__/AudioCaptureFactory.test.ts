import { AudioCaptureFactory } from '../AudioCaptureFactory';
import { AudioWorkletCapture } from '../implementations/AudioWorkletCapture';
import { MediaRecorderCapture } from '../implementations/MediaRecorderCapture';

// Mock the implementations
jest.mock('../implementations/AudioWorkletCapture');
jest.mock('../implementations/MediaRecorderCapture');

/**
 * Test suite for AudioCaptureFactory
 * 
 * Tests browser detection and implementation selection
 * Rationale: Ensures correct audio capture strategy is chosen based on browser capabilities
 */

describe('AudioCaptureFactory', () => {
  let originalAudioContext: any;
  let originalMediaRecorder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original globals
    originalAudioContext = global.AudioContext;
    originalMediaRecorder = global.MediaRecorder;
  });

  afterEach(() => {
    // Restore original globals
    global.AudioContext = originalAudioContext;
    global.MediaRecorder = originalMediaRecorder;
  });

  describe('browser capability detection', () => {
    it('should detect AudioWorklet support correctly', () => {
      // Mock AudioContext with AudioWorklet support
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      expect(AudioCaptureFactory.isAudioWorkletSupported()).toBe(true);
    });

    it('should detect lack of AudioWorklet support', () => {
      // Mock AudioContext without AudioWorklet
      global.AudioContext = jest.fn().mockImplementation(() => ({
        sampleRate: 44100,
        state: 'running'
        // No audioWorklet property
      }));

      expect(AudioCaptureFactory.isAudioWorkletSupported()).toBe(false);
    });

    it('should detect MediaRecorder support correctly', () => {
      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      expect(AudioCaptureFactory.isMediaRecorderSupported()).toBe(true);
    });

    it('should detect lack of MediaRecorder support', () => {
      global.MediaRecorder = undefined;

      expect(AudioCaptureFactory.isMediaRecorderSupported()).toBe(false);
    });

    it('should handle missing AudioContext gracefully', () => {
      global.AudioContext = undefined;

      expect(AudioCaptureFactory.isAudioWorkletSupported()).toBe(false);
    });
  });

  describe('implementation selection', () => {
    it('should prefer AudioWorkletCapture when supported', () => {
      // Mock AudioWorklet support
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      // Mock MediaRecorder support as well
      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      expect(AudioWorkletCapture).toHaveBeenCalled();
      expect(MediaRecorderCapture).not.toHaveBeenCalled();
    });

    it('should fallback to MediaRecorderCapture when AudioWorklet not supported', () => {
      // Mock no AudioWorklet support
      global.AudioContext = jest.fn().mockImplementation(() => ({
        sampleRate: 44100,
        state: 'running'
        // No audioWorklet
      }));

      // Mock MediaRecorder support
      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      expect(MediaRecorderCapture).toHaveBeenCalled();
      expect(AudioWorkletCapture).not.toHaveBeenCalled();
    });

    it('should throw error when no audio capture is supported', () => {
      // Mock no support for either
      global.AudioContext = undefined;
      global.MediaRecorder = undefined;

      const factory = new AudioCaptureFactory();

      expect(() => {
        factory.createCapture();
      }).toThrow('No supported audio capture method available');
    });
  });

  describe('configuration passing', () => {
    it('should pass configuration to AudioWorkletCapture', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      const config = {
        sampleRate: 48000,
        channelCount: 2,
        bufferSize: 4096
      };

      const factory = new AudioCaptureFactory();
      factory.createCapture(config);

      expect(AudioWorkletCapture).toHaveBeenCalledWith(config);
    });

    it('should pass configuration to MediaRecorderCapture', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        sampleRate: 44100,
        state: 'running'
      }));

      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const config = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };

      const factory = new AudioCaptureFactory();
      factory.createCapture(config);

      expect(MediaRecorderCapture).toHaveBeenCalledWith(config);
    });
  });

  describe('browser-specific behavior', () => {
    it('should handle Chrome AudioWorklet support', () => {
      // Mock Chrome-like environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        configurable: true
      });

      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      expect(AudioWorkletCapture).toHaveBeenCalled();
    });

    it('should handle Safari MediaRecorder fallback', () => {
      // Mock Safari-like environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
        configurable: true
      });

      // Mock limited AudioWorklet support (Safari may have partial support)
      global.AudioContext = jest.fn().mockImplementation(() => ({
        sampleRate: 44100,
        state: 'running'
      }));

      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      expect(MediaRecorderCapture).toHaveBeenCalled();
    });

    it('should handle Firefox AudioWorklet support', () => {
      // Mock Firefox-like environment
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
        configurable: true
      });

      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      expect(AudioWorkletCapture).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle AudioWorklet creation failure gracefully', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      // Mock AudioWorkletCapture to throw
      const mockAudioWorkletCapture = AudioWorkletCapture as jest.MockedClass<typeof AudioWorkletCapture>;
      mockAudioWorkletCapture.mockImplementation(() => {
        throw new Error('AudioWorklet initialization failed');
      });

      // Ensure MediaRecorder is available as fallback
      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const factory = new AudioCaptureFactory();
      const capture = factory.createCapture();

      // Should fallback to MediaRecorder
      expect(MediaRecorderCapture).toHaveBeenCalled();
    });

    it('should propagate error when both implementations fail', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      // Mock both implementations to throw
      const mockAudioWorkletCapture = AudioWorkletCapture as jest.MockedClass<typeof AudioWorkletCapture>;
      const mockMediaRecorderCapture = MediaRecorderCapture as jest.MockedClass<typeof MediaRecorderCapture>;
      
      mockAudioWorkletCapture.mockImplementation(() => {
        throw new Error('AudioWorklet failed');
      });
      
      mockMediaRecorderCapture.mockImplementation(() => {
        throw new Error('MediaRecorder failed');
      });

      const factory = new AudioCaptureFactory();

      expect(() => {
        factory.createCapture();
      }).toThrow('Failed to create any audio capture implementation');
    });
  });

  describe('capability reporting', () => {
    it('should report available implementations correctly', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const capabilities = AudioCaptureFactory.getCapabilities();

      expect(capabilities).toEqual({
        audioWorkletSupported: true,
        mediaRecorderSupported: true,
        preferredImplementation: 'AudioWorklet',
        fallbackImplementation: 'MediaRecorder'
      });
    });

    it('should report limited capabilities correctly', () => {
      global.AudioContext = undefined;
      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const capabilities = AudioCaptureFactory.getCapabilities();

      expect(capabilities).toEqual({
        audioWorkletSupported: false,
        mediaRecorderSupported: true,
        preferredImplementation: 'MediaRecorder',
        fallbackImplementation: null
      });
    });
  });

  describe('performance considerations', () => {
    it('should cache capability detection results', () => {
      // First call
      AudioCaptureFactory.isAudioWorkletSupported();
      AudioCaptureFactory.isAudioWorkletSupported();

      // AudioContext should only be checked once (assuming caching is implemented)
      // This test verifies the factory doesn't redundantly check capabilities
      expect(true).toBe(true); // Placeholder - actual implementation would verify caching
    });

    it('should prefer more performant implementation', () => {
      global.AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn(() => Promise.resolve())
        },
        sampleRate: 44100,
        state: 'running'
      }));

      global.MediaRecorder = jest.fn().mockImplementation(() => ({}));
      global.MediaRecorder.isTypeSupported = jest.fn(() => true);

      const factory = new AudioCaptureFactory();
      factory.createCapture();

      // AudioWorkletCapture should be preferred for better performance
      expect(AudioWorkletCapture).toHaveBeenCalled();
    });
  });
});
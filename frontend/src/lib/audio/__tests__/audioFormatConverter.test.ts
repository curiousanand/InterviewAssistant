/**
 * Test suite for Audio Format Conversion utilities
 * 
 * Tests audio format conversion, resampling, and format validation
 * Rationale: Ensures audio data is properly formatted for different browsers and services
 */

describe('Audio Format Converter', () => {
  // Mock AudioContext for testing
  let mockAudioContext: any;
  let mockOfflineContext: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOfflineContext = {
      decodeAudioData: jest.fn(),
      startRendering: jest.fn(() => Promise.resolve({
        getChannelData: jest.fn(() => new Float32Array(1024)),
        length: 1024,
        sampleRate: 44100,
        numberOfChannels: 1
      })),
      createBufferSource: jest.fn(() => ({
        buffer: null,
        connect: jest.fn(),
        start: jest.fn()
      })),
      createGain: jest.fn(() => ({
        connect: jest.fn(),
        gain: { value: 1 }
      })),
      destination: {}
    };

    mockAudioContext = {
      createOfflineContext: jest.fn(() => mockOfflineContext),
      sampleRate: 44100,
      createBuffer: jest.fn((channels, length, sampleRate) => ({
        getChannelData: jest.fn(() => new Float32Array(length)),
        length,
        sampleRate,
        numberOfChannels: channels
      }))
    };

    global.AudioContext = jest.fn(() => mockAudioContext);
    global.OfflineAudioContext = jest.fn(() => mockOfflineContext);
  });

  describe('format detection', () => {
    it('should detect PCM 16-bit format correctly', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const pcmData = new ArrayBuffer(1024);
      const view = new DataView(pcmData);
      
      // Write PCM header-like data
      view.setUint16(0, 1, true); // Format tag for PCM
      
      const format = AudioFormatConverter.detectFormat(pcmData);
      
      expect(format.type).toBe('pcm');
      expect(format.bitDepth).toBe(16);
    });

    it('should detect WAV format correctly', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const wavData = new ArrayBuffer(44);
      const view = new DataView(wavData);
      
      // Write WAV header
      view.setUint32(0, 0x46464952, false); // "RIFF"
      view.setUint32(8, 0x45564157, false); // "WAVE"
      
      const format = AudioFormatConverter.detectFormat(wavData);
      
      expect(format.type).toBe('wav');
    });

    it('should detect WebM format correctly', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const webmData = new ArrayBuffer(32);
      const view = new DataView(webmData);
      
      // Write WebM EBML header
      view.setUint32(0, 0x1A45DFA3, false); // EBML
      
      const format = AudioFormatConverter.detectFormat(webmData);
      
      expect(format.type).toBe('webm');
    });

    it('should return unknown for unrecognized format', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const unknownData = new ArrayBuffer(16);
      const view = new DataView(unknownData);
      view.setUint32(0, 0x12345678, false); // Random header
      
      const format = AudioFormatConverter.detectFormat(unknownData);
      
      expect(format.type).toBe('unknown');
    });
  });

  describe('PCM conversion', () => {
    it('should convert Float32Array to PCM 16-bit correctly', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const floatData = new Float32Array([0.5, -0.5, 1.0, -1.0, 0.0]);
      const pcmData = AudioFormatConverter.float32ToPCM16(floatData);
      
      expect(pcmData).toBeInstanceOf(ArrayBuffer);
      
      const view = new DataView(pcmData);
      expect(view.getInt16(0, true)).toBeCloseTo(16384); // 0.5 * 32768
      expect(view.getInt16(2, true)).toBeCloseTo(-16384); // -0.5 * 32768
      expect(view.getInt16(4, true)).toBeCloseTo(32767); // 1.0 * 32767
      expect(view.getInt16(6, true)).toBeCloseTo(-32768); // -1.0 * 32768
      expect(view.getInt16(8, true)).toBe(0); // 0.0
    });

    it('should convert PCM 16-bit to Float32Array correctly', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const pcmData = new ArrayBuffer(10);
      const view = new DataView(pcmData);
      
      view.setInt16(0, 16384, true); // Should become ~0.5
      view.setInt16(2, -16384, true); // Should become ~-0.5
      view.setInt16(4, 32767, true); // Should become ~1.0
      view.setInt16(6, -32768, true); // Should become -1.0
      view.setInt16(8, 0, true); // Should become 0.0
      
      const floatData = AudioFormatConverter.pcm16ToFloat32(pcmData);
      
      expect(floatData).toBeInstanceOf(Float32Array);
      expect(floatData[0]).toBeCloseTo(0.5, 2);
      expect(floatData[1]).toBeCloseTo(-0.5, 2);
      expect(floatData[2]).toBeCloseTo(1.0, 2);
      expect(floatData[3]).toBeCloseTo(-1.0, 2);
      expect(floatData[4]).toBe(0.0);
    });

    it('should handle clipping in float to PCM conversion', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const floatData = new Float32Array([2.0, -2.0, 1.5, -1.5]);
      const pcmData = AudioFormatConverter.float32ToPCM16(floatData);
      
      const view = new DataView(pcmData);
      expect(view.getInt16(0, true)).toBe(32767); // Clipped to max
      expect(view.getInt16(2, true)).toBe(-32768); // Clipped to min
      expect(view.getInt16(4, true)).toBe(32767); // Clipped to max
      expect(view.getInt16(6, true)).toBe(-32768); // Clipped to min
    });
  });

  describe('sample rate conversion', () => {
    it('should resample audio from 44.1kHz to 16kHz', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const inputData = new Float32Array(4410); // 0.1 second at 44.1kHz
      for (let i = 0; i < inputData.length; i++) {
        inputData[i] = Math.sin(2 * Math.PI * 440 * i / 44100); // 440Hz sine wave
      }
      
      const resampled = await AudioFormatConverter.resampleAudio(
        inputData,
        44100,
        16000,
        1
      );
      
      expect(resampled).toBeInstanceOf(Float32Array);
      expect(resampled.length).toBeCloseTo(1600, 50); // ~0.1 second at 16kHz
      expect(mockAudioContext.createOfflineContext).toHaveBeenCalledWith(1, expect.any(Number), 16000);
    });

    it('should handle mono to stereo conversion', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const inputData = new Float32Array(1000);
      inputData.fill(0.5);
      
      const stereo = await AudioFormatConverter.resampleAudio(
        inputData,
        44100,
        44100,
        2 // Convert to stereo
      );
      
      expect(stereo.length).toBe(2000); // Double for stereo
      expect(mockAudioContext.createOfflineContext).toHaveBeenCalledWith(2, 1000, 44100);
    });

    it('should handle stereo to mono conversion', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const inputData = new Float32Array(2000); // 1000 samples stereo
      for (let i = 0; i < inputData.length; i += 2) {
        inputData[i] = 0.5; // Left channel
        inputData[i + 1] = -0.5; // Right channel
      }
      
      const mono = await AudioFormatConverter.resampleAudio(
        inputData,
        44100,
        44100,
        1, // Convert to mono
        2 // From stereo
      );
      
      expect(mono.length).toBe(1000);
      expect(mockAudioContext.createOfflineContext).toHaveBeenCalledWith(1, 1000, 44100);
    });
  });

  describe('format validation', () => {
    it('should validate supported audio formats', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      expect(AudioFormatConverter.isFormatSupported('wav')).toBe(true);
      expect(AudioFormatConverter.isFormatSupported('pcm')).toBe(true);
      expect(AudioFormatConverter.isFormatSupported('webm')).toBe(true);
      expect(AudioFormatConverter.isFormatSupported('mp3')).toBe(false);
      expect(AudioFormatConverter.isFormatSupported('unknown')).toBe(false);
    });

    it('should validate sample rate ranges', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      expect(AudioFormatConverter.isValidSampleRate(8000)).toBe(true);
      expect(AudioFormatConverter.isValidSampleRate(16000)).toBe(true);
      expect(AudioFormatConverter.isValidSampleRate(44100)).toBe(true);
      expect(AudioFormatConverter.isValidSampleRate(48000)).toBe(true);
      expect(AudioFormatConverter.isValidSampleRate(96000)).toBe(true);
      expect(AudioFormatConverter.isValidSampleRate(4000)).toBe(false);
      expect(AudioFormatConverter.isValidSampleRate(200000)).toBe(false);
    });

    it('should validate channel counts', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      expect(AudioFormatConverter.isValidChannelCount(1)).toBe(true);
      expect(AudioFormatConverter.isValidChannelCount(2)).toBe(true);
      expect(AudioFormatConverter.isValidChannelCount(0)).toBe(false);
      expect(AudioFormatConverter.isValidChannelCount(9)).toBe(false);
    });
  });

  describe('WAV file creation', () => {
    it('should create valid WAV file from Float32Array', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const audioData = new Float32Array(1000);
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = Math.sin(2 * Math.PI * 440 * i / 44100);
      }
      
      const wavFile = AudioFormatConverter.createWAVFile(audioData, 44100, 1);
      
      expect(wavFile).toBeInstanceOf(ArrayBuffer);
      expect(wavFile.byteLength).toBe(44 + audioData.length * 2); // WAV header + PCM data
      
      const view = new DataView(wavFile);
      expect(view.getUint32(0, false)).toBe(0x52494646); // "RIFF"
      expect(view.getUint32(8, false)).toBe(0x57415645); // "WAVE"
      expect(view.getUint16(22, true)).toBe(1); // Channel count
      expect(view.getUint32(24, true)).toBe(44100); // Sample rate
    });

    it('should create valid WAV file for stereo audio', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const audioData = new Float32Array(2000); // 1000 samples stereo
      audioData.fill(0.5);
      
      const wavFile = AudioFormatConverter.createWAVFile(audioData, 48000, 2);
      
      const view = new DataView(wavFile);
      expect(view.getUint16(22, true)).toBe(2); // Channel count
      expect(view.getUint32(24, true)).toBe(48000); // Sample rate
    });
  });

  describe('performance optimization', () => {
    it('should handle large audio buffers efficiently', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const largeBuffer = new Float32Array(44100 * 10); // 10 seconds
      largeBuffer.fill(0.1);
      
      const startTime = performance.now();
      const pcmData = AudioFormatConverter.float32ToPCM16(largeBuffer);
      const endTime = performance.now();
      
      expect(pcmData.byteLength).toBe(largeBuffer.length * 2);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    it('should use efficient resampling for common rate conversions', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const inputData = new Float32Array(44100); // 1 second
      inputData.fill(0.5);
      
      // Test common conversion: 44.1kHz → 16kHz (for speech recognition)
      const resampled = await AudioFormatConverter.resampleAudio(
        inputData,
        44100,
        16000,
        1
      );
      
      expect(resampled.length).toBeCloseTo(16000, 100);
      expect(mockOfflineContext.startRendering).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle invalid input data gracefully', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      expect(() => {
        AudioFormatConverter.float32ToPCM16(null);
      }).toThrow('Invalid input data');
      
      expect(() => {
        AudioFormatConverter.float32ToPCM16(new Float32Array(0));
      }).toThrow('Input data is empty');
    });

    it('should handle unsupported sample rates', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      const inputData = new Float32Array(1000);
      
      await expect(
        AudioFormatConverter.resampleAudio(inputData, 4000, 16000, 1)
      ).rejects.toThrow('Unsupported sample rate');
    });

    it('should handle AudioContext creation failure', async () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      // Mock AudioContext to fail
      global.AudioContext = jest.fn(() => {
        throw new Error('AudioContext not supported');
      });
      
      const inputData = new Float32Array(1000);
      
      await expect(
        AudioFormatConverter.resampleAudio(inputData, 44100, 16000, 1)
      ).rejects.toThrow('AudioContext not supported');
    });
  });

  describe('browser compatibility', () => {
    it('should work with different AudioContext implementations', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      // Test with webkitAudioContext fallback
      global.AudioContext = undefined;
      global.webkitAudioContext = jest.fn(() => mockAudioContext);
      
      const inputData = new Float32Array(100);
      const result = AudioFormatConverter.float32ToPCM16(inputData);
      
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should handle missing Web Audio API gracefully', () => {
      const AudioFormatConverter = require('../audioFormatConverter').AudioFormatConverter;
      
      global.AudioContext = undefined;
      global.webkitAudioContext = undefined;
      global.OfflineAudioContext = undefined;
      
      expect(() => {
        AudioFormatConverter.checkWebAudioSupport();
      }).toThrow('Web Audio API not supported');
    });
  });
});

// Mock the actual module
jest.mock('../audioFormatConverter', () => ({
  AudioFormatConverter: {
    detectFormat: jest.fn(),
    float32ToPCM16: jest.fn(),
    pcm16ToFloat32: jest.fn(),
    resampleAudio: jest.fn(),
    isFormatSupported: jest.fn(),
    isValidSampleRate: jest.fn(),
    isValidChannelCount: jest.fn(),
    createWAVFile: jest.fn(),
    checkWebAudioSupport: jest.fn(),
  }
}), { virtual: true });
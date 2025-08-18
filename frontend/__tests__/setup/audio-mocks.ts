/**
 * Audio API Mocks for Testing
 */

// Mock AudioCaptureFactory
export class MockAudioCaptureFactory {
  static instance: MockAudioCaptureFactory;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new MockAudioCaptureFactory();
    }
    return this.instance;
  }

  async checkMicrophonePermissions() {
    return { granted: true, state: 'granted' };
  }

  async requestMicrophonePermissions() {
    return true;
  }

  getRecommendedConfiguration() {
    return {
      sampleRate: 16000,
      channels: 1,
      chunkDuration: 100,
      silenceDetection: true,
      silenceThreshold: 0.01,
      audioLevelMonitoring: true,
    };
  }

  async createCapture(config: any) {
    return new MockAudioCapture();
  }

  async testCapabilities() {
    return {
      audioWorklet: true,
      mediaRecorder: true,
      webAudio: true,
    };
  }
}

// Mock AudioCapture implementation
export class MockAudioCapture {
  private isStarted = false;
  private audioDataCallback?: (data: Float32Array) => void;

  async start() {
    this.isStarted = true;
    // Simulate audio data
    if (this.audioDataCallback) {
      setInterval(() => {
        if (this.isStarted && this.audioDataCallback) {
          const audioData = new Float32Array(1024);
          for (let i = 0; i < audioData.length; i++) {
            audioData[i] = Math.random() * 0.1; // Low level audio
          }
          this.audioDataCallback(audioData);
        }
      }, 100);
    }
  }

  async stop() {
    this.isStarted = false;
  }

  onAudioData(callback: (data: Float32Array) => void) {
    this.audioDataCallback = callback;
  }

  removeAllListeners() {
    this.audioDataCallback = undefined;
  }
}

// Mock Web Audio API
export const mockWebAudioAPI = () => {
  global.AudioContext = jest.fn().mockImplementation(() => ({
    createMediaStreamSource: jest.fn(),
    createScriptProcessor: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: null,
    })),
    createAnalyser: jest.fn(() => ({
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getFloatFrequencyData: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      gain: { value: 1 },
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    destination: {},
    close: jest.fn(),
    sampleRate: 48000,
    state: 'running',
    suspend: jest.fn(),
    resume: jest.fn(),
  }));

  global.MediaStream = jest.fn().mockImplementation(() => ({
    getTracks: () => [],
    getAudioTracks: () => [{
      stop: jest.fn(),
      enabled: true,
      kind: 'audio',
      readyState: 'live',
    }],
    getVideoTracks: () => [],
    addTrack: jest.fn(),
    removeTrack: jest.fn(),
    active: true,
  }));

  // Mock navigator.mediaDevices with proper permissions
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(new MediaStream()),
      enumerateDevices: jest.fn().mockResolvedValue([
        {
          deviceId: 'default',
          kind: 'audioinput',
          label: 'Default - Mock Microphone',
          groupId: 'mock-group',
        }
      ]),
    },
    writable: true,
  });
};
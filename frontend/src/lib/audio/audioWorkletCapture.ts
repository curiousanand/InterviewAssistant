import { IAudioCapture, AudioFormat } from '@/types';

export class AudioWorkletCapture implements IAudioCapture {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;

  async start(): Promise<void> {
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      // Add audio worklet processor
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-data' && this.audioDataCallback) {
          this.audioDataCallback(event.data.audioData);
        }
      };

      source.connect(this.workletNode);
    } catch (error) {
      console.error('Failed to start AudioWorklet capture:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  onAudioData(callback: (data: Float32Array) => void): void {
    this.audioDataCallback = callback;
  }

  cleanup(): void {
    this.stop();
  }
}
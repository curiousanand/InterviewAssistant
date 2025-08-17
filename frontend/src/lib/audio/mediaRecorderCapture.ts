import { IAudioCapture } from '@/types';

export class MediaRecorderCapture implements IAudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioDataCallback: ((data: Float32Array) => void) | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          this.processAudioChunk(event.data);
        }
      };

      this.mediaRecorder.start(200); // 200ms chunks
    } catch (error) {
      console.error('Failed to start MediaRecorder capture:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.chunks = [];
  }

  onAudioData(callback: (data: Float32Array) => void): void {
    this.audioDataCallback = callback;
  }

  cleanup(): void {
    this.stop();
  }

  private async processAudioChunk(chunk: Blob): Promise<void> {
    if (!this.audioDataCallback) return;

    try {
      const arrayBuffer = await chunk.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to Float32Array (mono, 16kHz)
      const channelData = audioBuffer.getChannelData(0);
      this.audioDataCallback(channelData);
      
      await audioContext.close();
    } catch (error) {
      console.warn('Failed to process audio chunk:', error);
    }
  }
}
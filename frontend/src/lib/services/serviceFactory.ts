import { IAudioCapture, IWebSocketClient } from '@/types';
import { AudioWorkletCapture } from '../audio/audioWorkletCapture';
import { MediaRecorderCapture } from '../audio/mediaRecorderCapture';
import { ReconnectingWebSocketClient } from '../websocket/reconnectingWebSocketClient';

export class ServiceFactory {
  static createAudioCapture(): IAudioCapture {
    // Check browser capabilities and return appropriate implementation
    if (window.AudioWorklet && window.AudioContext) {
      try {
        return new AudioWorkletCapture();
      } catch (error) {
        console.warn('AudioWorklet not available, falling back to MediaRecorder');
      }
    }
    
    return new MediaRecorderCapture();
  }

  static createWebSocketClient(): IWebSocketClient {
    return new ReconnectingWebSocketClient();
  }
}

export const audioFactory = {
  createCapture: () => ServiceFactory.createAudioCapture(),
};

export const wsFactory = {
  createClient: () => ServiceFactory.createWebSocketClient(),
};
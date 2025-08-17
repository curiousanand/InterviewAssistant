import { IWebSocketClient } from '@/types';

export class ReconnectingWebSocketClient implements IWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: (string | ArrayBuffer)[] = [];
  
  private messageCallback: ((data: MessageEvent) => void) | null = null;
  private errorCallback: ((error: Event) => void) | null = null;
  private closeCallback: ((event: CloseEvent) => void) | null = null;

  async connect(url: string): Promise<void> {
    this.url = url;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event) => {
          if (this.messageCallback) {
            this.messageCallback(event);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.errorCallback) {
            this.errorCallback(error);
          }
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          if (this.closeCallback) {
            this.closeCallback(event);
          }
          
          // Attempt reconnection if not manually closed
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnection();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  sendMessage(message: string | ArrayBuffer): void {
    if (this.isConnected()) {
      this.ws!.send(message);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  onMessage(callback: (data: MessageEvent) => void): void {
    this.messageCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.errorCallback = callback;
  }

  onClose(callback: (event: CloseEvent) => void): void {
    this.closeCallback = callback;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private scheduleReconnection(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect(this.url).catch(() => {
        // Reconnection failed, will try again unless max attempts reached
      });
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }
}
export interface IAudioCapture {
  start(): Promise<void>;
  stop(): Promise<void>;
  onAudioData(callback: (data: Float32Array) => void): void;
  cleanup(): void;
}

export interface IWebSocketClient {
  connect(url: string): Promise<void>;
  disconnect(): void;
  sendMessage(message: string | ArrayBuffer): void;
  onMessage(callback: (data: MessageEvent) => void): void;
  onError(callback: (error: Event) => void): void;
  onClose(callback: (event: CloseEvent) => void): void;
  isConnected(): boolean;
}

export interface IRecordingStrategy {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRecording(): boolean;
  configure(options: RecordingOptions): void;
}

export interface RecordingOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  chunkDuration?: number;
}

export interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
}

export interface Session {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  messages: Message[];
  language?: string;
  status: 'active' | 'idle' | 'closed';
}

export interface TranscriptionEvent {
  type: 'transcript.partial' | 'transcript.final';
  sessionId: string;
  text: string;
  confidence: number;
  language?: string;
}

export interface AIResponseEvent {
  type: 'assistant.delta' | 'assistant.done';
  sessionId: string;
  delta?: string;
  complete?: boolean;
  messageId?: string;
}

export interface ErrorEvent {
  type: 'error';
  sessionId: string;
  error: string;
  code?: number;
}

export type WebSocketEvent = TranscriptionEvent | AIResponseEvent | ErrorEvent;
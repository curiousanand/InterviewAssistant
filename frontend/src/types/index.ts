// Audio interfaces
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

// Backend WebSocket message types (matching Java backend exactly)
export enum WebSocketMessageType {
  // Client to server
  AUDIO_DATA = 'AUDIO_DATA',
  SESSION_START = 'SESSION_START',
  SESSION_END = 'SESSION_END',
  HEARTBEAT = 'HEARTBEAT',
  
  // Server to client (matching backend dot notation)
  TRANSCRIPT_PARTIAL = 'transcript.partial',
  TRANSCRIPT_FINAL = 'transcript.final',
  ASSISTANT_DELTA = 'assistant.delta',
  ASSISTANT_DONE = 'assistant.done',
  ERROR = 'error',
  SESSION_READY = 'SESSION_READY',
  
  // Bidirectional
  PING = 'PING',
  PONG = 'PONG'
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  sessionId: string;
  payload?: any;
  timestamp?: string;
  messageId?: string;
  metadata?: Record<string, any>;
}

export interface TranscriptPayload {
  text: string;
  confidence: number;
  isFinal: boolean;
  language?: string;
}

export interface ErrorPayload {
  message: string;
  code: string;
  details?: string;
}

// UI Domain models
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
  isPartial?: boolean;
}

export interface Session {
  id: string;
  status: 'ACTIVE' | 'IDLE' | 'CLOSED';
  targetLanguage: string;
  autoDetectLanguage: boolean;
  createdAt: Date;
  messageCount: number;
}

export interface CreateSessionRequest {
  targetLanguage?: string;
  autoDetect?: boolean;
}

export interface SessionResponse {
  id: string;
  status: string;
  targetLanguage: string;
  autoDetectLanguage: boolean;
  createdAt: string;
  messageCount: number;
}

// Connection states
export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  error?: string;
  lastConnected?: Date;
  reconnectAttempts: number;
}

// Recording states
export interface RecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  error?: string | null;
}

// Language options
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)', nativeName: 'English' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English' },
  { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español' },
  { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский' }
];

// Event types for UI state management
export type AppEvent = 
  | { type: 'connection.established'; sessionId: string }
  | { type: 'connection.lost'; error?: string }
  | { type: 'recording.started' }
  | { type: 'recording.stopped' }
  | { type: 'transcript.received'; text: string; confidence: number; isFinal: boolean }
  | { type: 'assistant.response.started' }
  | { type: 'assistant.response.delta'; text: string }
  | { type: 'assistant.response.completed'; fullText: string }
  | { type: 'error.occurred'; error: string; code?: string };

// Voice Activity Detection
export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  audioLevel: number;
}

// Theme and UI preferences
export interface UIPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoScroll: boolean;
  showConfidence: boolean;
  compactMode: boolean;
}
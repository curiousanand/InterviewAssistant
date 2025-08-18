/**
 * Type definitions for modern conversation orchestration system
 */

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    processingTime?: number;
    model?: string;
    interrupted?: boolean;
    [key: string]: any;
  };
}

export interface TranscriptBuffer {
  text: string;
  confidence: number;
  timestamp: Date;
  isFinal: boolean;
  segments?: TranscriptSegment[];
}

export interface TranscriptSegment {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
}

export interface ContextState {
  currentTopic: string;
  entities: string[];
  conversationHistory: ConversationMessage[];
  userPreferences: Record<string, any>;
  sessionContext?: {
    startTime: Date;
    messageCount: number;
    averageResponseTime: number;
  };
}

export interface VoiceActivityState {
  isActive: boolean;
  confidence: number;
  energy: number;
  silenceDuration?: number;
  speechDuration?: number;
  state: 'listening' | 'speaking' | 'pausing' | 'waiting';
}

export interface AIProcessingState {
  isThinking: boolean;
  isSpeaking: boolean;
  currentResponse: string;
  processingStage: 'idle' | 'analyzing' | 'generating' | 'streaming' | 'complete';
  metadata?: {
    model: string;
    temperature: number;
    tokensGenerated: number;
    processingTime: number;
  };
}

export interface ConversationState {
  messages: ConversationMessage[];
  liveTranscript: string;
  confirmedTranscript: string;
  aiResponse: string;
  isListening: boolean;
  isAiThinking: boolean;
  isAiSpeaking: boolean;
  context: ContextState;
  voiceActivity?: VoiceActivityState;
  aiProcessing?: AIProcessingState;
}

export interface SystemStatus {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  audioStatus: 'inactive' | 'ready' | 'listening' | 'speaking' | 'error';
  processingStatus: 'idle' | 'thinking' | 'responding' | 'interrupted' | 'error';
  errors: SystemError[];
  latency: {
    transcription: number;
    aiResponse: number;
    totalRoundTrip: number;
  };
  performance?: {
    audioDropouts: number;
    reconnections: number;
    averageLatency: number;
  };
}

export interface SystemError {
  message: string;
  timestamp: Date;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  details?: any;
}

export interface SettingsConfig {
  language: string;
  autoDetectLanguage: boolean;
  voiceActivityThresholds: {
    shortPause: number;   // ms - natural gap
    mediumPause: number;  // ms - end of thought
    longPause: number;    // ms - user waiting
  };
  audioSettings: {
    sampleRate: number;
    channels: number;
    bitDepth: number;
    bufferSize?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
  };
  aiSettings: {
    provider: 'azure-openai' | 'openai' | 'mock';
    model: string;
    temperature: number;
    maxTokens: number;
    streamingEnabled: boolean;
    systemPrompt?: string;
  };
  uiSettings: {
    theme: 'modern-dark' | 'modern-light' | 'classic';
    showLiveTranscript: boolean;
    showConfidenceScores: boolean;
    enableInterruptions: boolean;
    animationsEnabled?: boolean;
    compactMode?: boolean;
  };
}

// Component Props Interfaces
export interface ConversationInterfaceProps {
  conversationState: ConversationState;
  systemStatus: SystemStatus;
  settings: SettingsConfig;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onInterruptAI: () => void;
}

export interface ModernHeaderProps {
  systemStatus: SystemStatus;
  isListening: boolean;
  onToggleSettings: () => void;
  onClearConversation: () => void;
  messagesCount: number;
}

export interface StatusBarProps {
  systemStatus: SystemStatus;
  conversationState: ConversationState;
  onClearError: (index: number) => void;
}

export interface SettingsPanelProps {
  settings: SettingsConfig;
  onSettingsChange: (settings: SettingsConfig) => void;
  onClose: () => void;
}

export interface LoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
}

// Audio Processing Types
export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

export interface VADResult {
  hasVoice: boolean;
  confidence: number;
  energy: number;
  timestamp: number;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  payload?: any;
  timestamp?: string;
}

export interface TranscriptMessage {
  text: string;
  isFinal: boolean;
  confidence: number;
  language?: string;
  timestamp: string;
}

export interface AIResponseMessage {
  content: string;
  isComplete: boolean;
  metadata?: {
    model: string;
    processingTime: number;
    tokensGenerated: number;
  };
}

// Event Types
export type ConversationEvent = 
  | 'initialized'
  | 'listeningStarted'
  | 'listingStopped'
  | 'transcriptReceived'
  | 'aiThinking'
  | 'aiSpeaking'
  | 'aiComplete'
  | 'aiInterrupted'
  | 'conversationCleared'
  | 'settingsUpdated'
  | 'error';

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ConversationStateUpdate = DeepPartial<ConversationState>;
export type SystemStatusUpdate = DeepPartial<SystemStatus>;
export type SettingsUpdate = DeepPartial<SettingsConfig>;
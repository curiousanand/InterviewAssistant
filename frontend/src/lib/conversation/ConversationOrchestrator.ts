import { EventEmitter } from 'events';
import { 
  ConversationState, 
  SystemStatus, 
  SettingsConfig, 
  ConversationMessage,
  TranscriptBuffer,
  ContextState,
  VoiceActivityState,
  AIProcessingState
} from '../../types/conversation';
import { RealTimeAudioCapture } from '../audio/RealTimeAudioCapture';
import { SmartTranscriptManager } from './SmartTranscriptManager';
import { ContextualConversationManager } from './ContextualConversationManager';
import { StreamingAICoordinator } from './StreamingAICoordinator';
import { WebSocketOrchestrator } from './WebSocketOrchestrator';

/**
 * Central orchestration system for real-time multimodal conversation
 * 
 * Implements the complete control loop:
 * Audio Capture → VAD → Transcript Buffers → Context → AI Processing → Response Streaming
 * 
 * Key Features:
 * - Always-listening with smart pause detection
 * - Dual transcript buffers (live + confirmed)
 * - Context-aware conversation management
 * - Parallel processing coordination
 * - User interruption handling
 * - Real-time response streaming
 */
export class ConversationOrchestrator extends EventEmitter {
  private audioCapture: RealTimeAudioCapture;
  private transcriptManager: SmartTranscriptManager;
  private conversationManager: ContextualConversationManager;
  private aiCoordinator: StreamingAICoordinator;
  private webSocketOrchestrator: WebSocketOrchestrator;
  
  private settings: SettingsConfig;
  private state: ConversationState;
  private systemStatus: SystemStatus;
  
  private isInitialized = false;
  private isListening = false;
  private isProcessing = false;
  
  // Performance monitoring
  private performanceMetrics = {
    transcriptionLatency: new Array<number>(),
    aiResponseLatency: new Array<number>(),
    totalRoundTripLatency: new Array<number>()
  };

  constructor(config: {
    wsUrl: string;
    apiKey: string;
    settings: SettingsConfig;
  }) {
    super();
    
    this.settings = config.settings;
    
    // Initialize state
    this.state = {
      messages: [],
      liveTranscript: '',
      confirmedTranscript: '',
      aiResponse: '',
      isListening: false,
      isAiThinking: false,
      isAiSpeaking: false,
      context: {
        currentTopic: '',
        entities: [],
        conversationHistory: [],
        userPreferences: {}
      }
    };
    
    this.systemStatus = {
      connectionStatus: 'disconnected',
      audioStatus: 'inactive',
      processingStatus: 'idle',
      errors: [],
      latency: {
        transcription: 0,
        aiResponse: 0,
        totalRoundTrip: 0
      }
    };
    
    // Initialize core components
    this.webSocketOrchestrator = new WebSocketOrchestrator({
      url: config.wsUrl,
      apiKey: config.apiKey
    });
    
    this.audioCapture = new RealTimeAudioCapture(this.settings.audioSettings);
    
    this.transcriptManager = new SmartTranscriptManager({
      voiceActivityThresholds: this.settings.voiceActivityThresholds
    });
    
    this.conversationManager = new ContextualConversationManager();
    
    this.aiCoordinator = new StreamingAICoordinator({
      settings: this.settings.aiSettings,
      webSocket: this.webSocketOrchestrator
    });
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the entire orchestration system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('ConversationOrchestrator already initialized');
      return;
    }
    
    try {
      console.log('🚀 Initializing conversation orchestration components...');
      
      // Initialize WebSocket connection first
      await this.webSocketOrchestrator.connect();
      this.updateSystemStatus({ connectionStatus: 'connected' });
      
      // Initialize audio capture system to request permission on page load
      await this.audioCapture.initialize();
      this.updateSystemStatus({ audioStatus: 'ready' });
      
      // Initialize transcript processing
      await this.transcriptManager.initialize();
      
      // Initialize conversation context manager
      await this.conversationManager.initialize();
      
      // Initialize AI coordination
      await this.aiCoordinator.initialize();
      
      this.isInitialized = true;
      this.updateSystemStatus({ processingStatus: 'ready' });
      
      console.log('✅ Conversation orchestration system initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize conversation orchestration:', error);
      this.addError('System initialization failed', 'error');
      throw error;
    }
  }

  /**
   * Start always-listening mode with smart conversation flow
   */
  async startAlwaysListening(): Promise<void> {
    console.log('startAlwaysListening called - isInitialized:', this.isInitialized, 'isListening:', this.isListening);
    
    if (!this.isInitialized) {
      throw new Error('System not initialized. Call initialize() first.');
    }
    
    if (this.isListening) {
      console.warn('Already in listening mode');
      return;
    }
    
    try {
      console.log('🎤 Starting always-listening mode...');
      
      // Start audio capture with continuous streaming
      await this.audioCapture.startContinuousCapture((audioChunk) => {
        this.handleAudioChunk(audioChunk);
      });
      
      // Update state
      this.isListening = true;
      this.updateState({ isListening: true });
      this.updateSystemStatus({ audioStatus: 'listening' });
      
      console.log('✅ Always-listening mode activated');
      
      this.emit('listeningStarted');
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.addError('Failed to start audio capture', 'error');
      throw error;
    }
  }

  /**
   * Stop listening mode
   */
  async stopListening(): Promise<void> {
    console.log('stopListening called - isListening:', this.isListening);
    
    if (!this.isListening) {
      console.log('Not listening, returning early');
      return;
    }
    
    try {
      console.log('🔇 Stopping listening mode...');
      
      await this.audioCapture.stopCapture();
      
      this.isListening = false;
      this.updateState({ isListening: false });
      this.updateSystemStatus({ audioStatus: 'inactive' });
      
      console.log('✅ Listening mode deactivated');
      
      this.emit('listingStopped');
    } catch (error) {
      console.error('❌ Failed to stop listening:', error);
      this.addError('Failed to stop audio capture', 'warning');
    }
  }

  /**
   * Handle incoming audio chunks in real-time
   */
  private async handleAudioChunk(audioChunk: Float32Array): Promise<void> {
    if (!this.isListening) return;
    
    try {
      const startTime = performance.now();
      
      // Send audio to backend via WebSocket
      await this.webSocketOrchestrator.sendAudioChunk(audioChunk);
      
      // Process voice activity detection locally for immediate feedback
      const vadResult = await this.transcriptManager.processAudioForVAD(audioChunk);
      
      // Update live transcript buffer if voice detected
      if (vadResult.hasVoice && vadResult.confidence > 0.5) {
        this.updateSystemStatus({ audioStatus: 'speaking' });
      } else {
        // Check for pause conditions
        await this.handlePauseDetection(vadResult);
      }
      
      // Track performance
      const latency = performance.now() - startTime;
      this.updateLatencyMetric('transcription', latency);
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      this.addError('Audio processing error', 'warning');
    }
  }

  /**
   * Handle pause detection and trigger AI processing
   */
  private async handlePauseDetection(vadResult: VoiceActivityState): Promise<void> {
    const pauseDuration = vadResult.silenceDuration || 0;
    const { shortPause, mediumPause, longPause } = this.settings.voiceActivityThresholds;
    
    // Smart pause logic
    if (pauseDuration >= longPause) {
      // User is waiting - AI must respond now
      await this.triggerAIResponse('user_waiting');
    } else if (pauseDuration >= mediumPause) {
      // End of thought - prepare AI response
      await this.triggerAIResponse('end_of_thought');
    } else if (pauseDuration >= shortPause) {
      // Natural gap - continue listening but prepare context
      this.transcriptManager.prepareContext();
    }
  }

  /**
   * Trigger AI response processing
   */
  private async triggerAIResponse(trigger: 'end_of_thought' | 'user_waiting'): Promise<void> {
    if (this.isProcessing) {
      console.log('AI already processing, skipping trigger');
      return;
    }
    
    try {
      const startTime = performance.now();
      this.isProcessing = true;
      
      // Get confirmed transcript
      const transcript = await this.transcriptManager.getConfirmedTranscript();
      if (!transcript.text.trim()) {
        this.isProcessing = false;
        return;
      }
      
      // Update state
      this.updateState({ 
        confirmedTranscript: transcript.text,
        isAiThinking: true 
      });
      this.updateSystemStatus({ processingStatus: 'thinking' });
      
      // Build conversation context
      const context = await this.conversationManager.buildContext(transcript.text);
      this.updateState({ context });
      
      // Process with AI (streaming response)
      await this.aiCoordinator.processQuery({
        text: transcript.text,
        context: context,
        trigger: trigger,
        onStreamingToken: (token) => {
          this.handleAIStreamingToken(token);
        },
        onComplete: (response) => {
          this.handleAIResponseComplete(response, startTime);
        },
        onError: (error) => {
          this.handleAIError(error);
        }
      });
      
    } catch (error) {
      console.error('Error triggering AI response:', error);
      this.addError('AI processing failed', 'error');
      this.isProcessing = false;
      this.updateState({ isAiThinking: false });
    }
  }

  /**
   * Handle streaming AI tokens
   */
  private handleAIStreamingToken(token: string): void {
    if (!this.state.isAiSpeaking) {
      // First token - start speaking state
      this.updateState({ 
        isAiThinking: false, 
        isAiSpeaking: true 
      });
      this.updateSystemStatus({ processingStatus: 'responding' });
    }
    
    // Accumulate response
    const currentResponse = this.state.aiResponse + token;
    this.updateState({ aiResponse: currentResponse });
    
    this.emit('aiToken', token);
  }

  /**
   * Handle AI response completion
   */
  private handleAIResponseComplete(response: string, startTime: number): void {
    const latency = performance.now() - startTime;
    
    // Add to conversation history
    const userMessage: ConversationMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      content: this.state.confirmedTranscript,
      timestamp: new Date(),
      metadata: {
        confidence: 1.0,
        processingTime: 0
      }
    };
    
    const aiMessage: ConversationMessage = {
      id: Date.now().toString() + '-assistant',
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: {
        processingTime: latency,
        model: this.settings.aiSettings.model
      }
    };
    
    // Update conversation
    this.conversationManager.addMessages([userMessage, aiMessage]);
    
    // Update state
    this.updateState({
      messages: [...this.state.messages, userMessage, aiMessage],
      confirmedTranscript: '',
      aiResponse: '',
      isAiSpeaking: false
    });
    
    // Update metrics
    this.updateLatencyMetric('aiResponse', latency);
    this.updateSystemStatus({ processingStatus: 'idle' });
    
    this.isProcessing = false;
    
    console.log(`✅ AI response completed in ${latency.toFixed(0)}ms`);
    this.emit('aiComplete', response);
  }

  /**
   * Handle AI processing errors
   */
  private handleAIError(error: string): void {
    console.error('AI processing error:', error);
    this.addError(`AI processing failed: ${error}`, 'error');
    
    this.updateState({
      isAiThinking: false,
      isAiSpeaking: false,
      aiResponse: ''
    });
    
    this.updateSystemStatus({ processingStatus: 'error' });
    this.isProcessing = false;
  }

  /**
   * Interrupt AI response (user started speaking)
   */
  interruptAIResponse(): void {
    if (!this.state.isAiSpeaking && !this.state.isAiThinking) {
      return;
    }
    
    console.log('⚡ Interrupting AI response');
    
    // Stop AI processing
    this.aiCoordinator.interrupt();
    
    // Reset state
    this.updateState({
      isAiThinking: false,
      isAiSpeaking: false,
      aiResponse: ''
    });
    
    this.updateSystemStatus({ processingStatus: 'interrupted' });
    this.isProcessing = false;
    
    this.emit('aiInterrupted');
  }

  /**
   * Clear conversation history
   */
  clearConversation(): void {
    this.conversationManager.clear();
    this.updateState({
      messages: [],
      liveTranscript: '',
      confirmedTranscript: '',
      aiResponse: '',
      context: {
        currentTopic: '',
        entities: [],
        conversationHistory: [],
        userPreferences: {}
      }
    });
    
    console.log('🗑️ Conversation cleared');
    this.emit('conversationCleared');
  }

  /**
   * Update system settings
   */
  async updateSettings(newSettings: SettingsConfig): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    
    // Update component settings
    await this.audioCapture.updateSettings(newSettings.audioSettings);
    await this.transcriptManager.updateSettings({ 
      voiceActivityThresholds: newSettings.voiceActivityThresholds 
    });
    await this.aiCoordinator.updateSettings(newSettings.aiSettings);
    
    console.log('⚙️ Settings updated');
    this.emit('settingsUpdated', newSettings);
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // WebSocket events
    this.webSocketOrchestrator.on('connected', () => {
      this.updateSystemStatus({ connectionStatus: 'connected' });
    });
    
    this.webSocketOrchestrator.on('disconnected', () => {
      this.updateSystemStatus({ connectionStatus: 'disconnected' });
    });
    
    this.webSocketOrchestrator.on('transcript', (data) => {
      this.handleTranscriptFromBackend(data);
    });
    
    this.webSocketOrchestrator.on('error', (error) => {
      this.addError(`Connection error: ${error}`, 'error');
    });
    
    // Transcript manager events
    this.transcriptManager.on('liveTranscript', (text) => {
      this.updateState({ liveTranscript: text });
    });
    
    this.transcriptManager.on('confirmedTranscript', (text) => {
      // Will be handled in triggerAIResponse
    });
    
    // Conversation manager events
    this.conversationManager.on('contextUpdated', (context) => {
      this.updateState({ context });
    });
    
    // AI coordinator events
    this.aiCoordinator.on('thinking', () => {
      this.updateState({ isAiThinking: true });
    });
    
    this.aiCoordinator.on('speaking', () => {
      this.updateState({ isAiThinking: false, isAiSpeaking: true });
    });
  }

  /**
   * Handle transcript updates from backend
   */
  private handleTranscriptFromBackend(data: any): void {
    if (data.isFinal) {
      this.transcriptManager.setConfirmedTranscript(data.text, data.confidence);
    } else {
      this.transcriptManager.setLiveTranscript(data.text, data.confidence);
      this.updateState({ liveTranscript: data.text });
    }
  }

  /**
   * Update conversation state and notify listeners
   */
  private updateState(updates: Partial<ConversationState>): void {
    this.state = { ...this.state, ...updates };
    console.log('📡 Emitting state change:', updates);
    this.emit('stateChange', this.state);
  }

  /**
   * Update system status and notify listeners
   */
  private updateSystemStatus(updates: Partial<SystemStatus>): void {
    this.systemStatus = { ...this.systemStatus, ...updates };
    this.emit('statusChange', this.systemStatus);
  }

  /**
   * Add error to system status
   */
  private addError(message: string, severity: 'error' | 'warning' | 'info'): void {
    const error = {
      message,
      timestamp: new Date(),
      severity
    };
    
    this.systemStatus.errors.push(error);
    this.emit('statusChange', this.systemStatus);
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetric(type: 'transcription' | 'aiResponse', value: number): void {
    const metrics = this.performanceMetrics[`${type}Latency`];
    metrics.push(value);
    
    // Keep only last 10 measurements
    if (metrics.length > 10) {
      metrics.shift();
    }
    
    // Update average latency
    const average = metrics.reduce((a, b) => a + b, 0) / metrics.length;
    this.systemStatus.latency[type] = Math.round(average);
    
    this.emit('statusChange', this.systemStatus);
  }

  /**
   * Event handler setters
   */
  onStateChange(handler: (state: ConversationState) => void): void {
    this.on('stateChange', handler);
  }

  onStatusChange(handler: (status: SystemStatus) => void): void {
    this.on('statusChange', handler);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up conversation orchestrator...');
    
    try {
      if (this.isListening) {
        await this.stopListening();
      }
      
      await this.audioCapture.cleanup();
      await this.webSocketOrchestrator.disconnect();
      this.removeAllListeners();
      
      this.isInitialized = false;
      console.log('✅ Conversation orchestrator cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}
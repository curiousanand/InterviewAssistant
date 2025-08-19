'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ConversationOrchestrator } from '../lib/conversation/ConversationOrchestrator';
import { ConversationInterface } from '../components/conversation/ConversationInterface';
import { ModernHeader } from '../components/ui/ModernHeader';
import { StatusBar } from '../components/ui/StatusBar';
import { SettingsPanel } from '../components/ui/SettingsPanel';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ConversationState, SystemStatus, SettingsConfig } from '../types/conversation';

/**
 * Modern Real-time Multimodal Conversation Assistant
 * 
 * Features:
 * - Always listening with smart pause detection
 * - Dual transcript buffers (live + confirmed)
 * - Context-aware conversation management  
 * - Parallel processing (listening while AI responds)
 * - User interruption handling
 * - Live streaming responses
 */
export default function ConversationApp() {
  // Core orchestration system
  const [orchestrator, setOrchestrator] = useState<ConversationOrchestrator | null>(null);
  
  // Application state
  const [conversationState, setConversationState] = useState<ConversationState>({
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
  });
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    connectionStatus: 'disconnected',
    audioStatus: 'inactive',
    processingStatus: 'idle',
    errors: [],
    latency: {
      transcription: 0,
      aiResponse: 0,
      totalRoundTrip: 0
    }
  });
  
  const [settings, setSettings] = useState<SettingsConfig>({
    language: 'en-US',
    autoDetectLanguage: true,
    voiceActivityThresholds: {
      shortPause: 500,   // Natural gap
      mediumPause: 1000, // End of thought  
      longPause: 3000    // User waiting
    },
    audioSettings: {
      sampleRate: 16000,
      channels: 1,
      bitDepth: 16
    },
    aiSettings: {
      provider: 'azure-openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      streamingEnabled: true
    },
    uiSettings: {
      theme: 'modern-dark',
      showLiveTranscript: true,
      showConfidenceScores: false,
      enableInterruptions: true
    }
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize conversation orchestrator
  useEffect(() => {
    console.log('useEffect for orchestrator initialization triggered');
    let mounted = true;
    let localOrchestrator: ConversationOrchestrator | null = null;
    
    const initializeSystem = async () => {
      try {
        console.log('🚀 Initializing conversation orchestration system...');
        
        const newOrchestrator = new ConversationOrchestrator({
          wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws/stream',
          apiKey: process.env.NEXT_PUBLIC_API_KEY || '',
          settings
        });

        // Setup event handlers for state updates
        newOrchestrator.onStateChange((state) => {
          if (mounted) {
            setConversationState(state);
            // Expose state for testing
            if (typeof window !== 'undefined') {
              (window as any).__conversationState = state;
            }
          }
        });

        newOrchestrator.onStatusChange((status) => {
          if (mounted) {
            setSystemStatus(status);
          }
        });

        // Initialize the orchestrator
        await newOrchestrator.initialize();
        
        if (mounted) {
          localOrchestrator = newOrchestrator;
          setOrchestrator(newOrchestrator);
          setIsInitialized(true);
          console.log('✅ Conversation orchestration system initialized');
        }
      } catch (error) {
        console.error('❌ Failed to initialize system:', error);
        if (mounted) {
          setSystemStatus(prev => ({
            ...prev,
            errors: [...prev.errors, {
              message: error instanceof Error ? error.message : 'System initialization failed',
              timestamp: new Date(),
              severity: 'error'
            }]
          }));
        }
      }
    };

    initializeSystem();
    
    return () => {
      mounted = false;
      if (localOrchestrator) {
        localOrchestrator.cleanup();
      }
    };
  }, []); // Empty dependency - initialize once

  // Handle settings changes
  const handleSettingsChange = useCallback(async (newSettings: SettingsConfig) => {
    setSettings(newSettings);
    
    if (orchestrator) {
      try {
        await orchestrator.updateSettings(newSettings);
        console.log('⚙️ Settings updated successfully');
      } catch (error) {
        console.error('Failed to update settings:', error);
      }
    }
  }, [orchestrator]);

  // Start always-listening mode
  const startListening = useCallback(async () => {
    console.log('startListening callback triggered, orchestrator:', !!orchestrator);
    if (!orchestrator) {
      console.warn('Cannot start listening: orchestrator not initialized');
      return;
    }

    try {
      await orchestrator.startAlwaysListening();
      console.log('🎤 Always-listening mode activated');
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  }, [orchestrator]);

  // Stop listening mode
  const stopListening = useCallback(async () => {
    console.log('stopListening callback triggered, orchestrator:', !!orchestrator);
    if (!orchestrator) return;

    try {
      await orchestrator.stopListening();
      console.log('🔇 Listening mode deactivated');
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }, [orchestrator]);

  // Interrupt AI response
  const interruptAI = useCallback(() => {
    if (!orchestrator) return;
    
    orchestrator.interruptAIResponse();
    console.log('⚡ AI response interrupted by user');
  }, [orchestrator]);

  // Clear conversation
  const clearConversation = useCallback(() => {
    if (!orchestrator) return;
    
    orchestrator.clearConversation();
    console.log('🗑️ Conversation cleared');
  }, [orchestrator]);

  // Handle errors
  const clearError = useCallback((errorIndex: number) => {
    setSystemStatus(prev => ({
      ...prev,
      errors: prev.errors.filter((_, index) => index !== errorIndex)
    }));
  }, []);

  if (!isInitialized) {
    return (
      <LoadingScreen 
        message="Initializing conversation orchestration system..."
        error={systemStatus.errors.length > 0 ? systemStatus.errors[0]?.message : null}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col">
      {/* Modern Header */}
      <ModernHeader
        systemStatus={systemStatus}
        isListening={conversationState.isListening}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onClearConversation={clearConversation}
        messagesCount={conversationState.messages.length}
      />

      {/* Status Bar */}
      <div data-testid="status-bar">
        <StatusBar
          systemStatus={systemStatus}
          conversationState={conversationState}
          onClearError={clearError}
        />
      </div>

      {/* Settings Panel (Slide-in) */}
      {showSettings && (
        <div data-testid="settings-panel">
          <SettingsPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}

      {/* Main Conversation Interface */}
      <main className="flex-1 overflow-hidden" data-testid="conversation-interface">
        <ConversationInterface
          conversationState={conversationState}
          systemStatus={systemStatus}
          settings={settings}
          isListening={conversationState.isListening}
          onStartListening={startListening}
          onStopListening={stopListening}
          onInterruptAI={interruptAI}
        />
      </main>
    </div>
  );
}
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useConversation } from '@/hooks/useConversation';
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';
import { 
  ConversationSettings, 
  ConversationStatistics,
  ConversationError
} from '@/hooks/useConversation';

/**
 * ConversationManager - Manages conversation settings and lifecycle
 * 
 * Why: Provides high-level conversation management and configuration
 * Pattern: Manager Component - handles complex conversation operations
 * Rationale: Centralizes conversation lifecycle and settings management
 */

interface ConversationManagerProps {
  webSocketClient: IWebSocketClient;
  className?: string;
  onSettingsChange?: (settings: ConversationSettings) => void;
  onSessionCreated?: (sessionId: string) => void;
  onSessionRestored?: (sessionId: string) => void;
  onError?: (error: ConversationError) => void;
  enableAutoSave?: boolean;
  enableSessionPersistence?: boolean;
}

interface SessionInfo {
  id: string;
  name: string;
  createdAt: Date;
  lastActiveAt: Date;
  messageCount: number;
  language: string;
}

interface ExportOptions {
  format: 'json' | 'txt' | 'csv';
  includeMetadata: boolean;
  includeTimestamps: boolean;
  filterByDateRange?: {
    start: Date;
    end: Date;
  };
}

export function ConversationManager({
  webSocketClient,
  className = '',
  onSettingsChange,
  onSessionCreated,
  onSessionRestored,
  onError,
  enableAutoSave = true,
  enableSessionPersistence = true
}: ConversationManagerProps) {
  // State management
  const [settings, setSettings] = useState<ConversationSettings>({
    language: 'en-US',
    autoDetectLanguage: true,
    enableTranscription: true,
    enableAudioResponse: false,
    maxMessageHistory: 100,
    summarizationThreshold: 50
  });
  
  const [savedSessions, setSavedSessions] = useState<SessionInfo[]>([]);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeMetadata: true,
    includeTimestamps: true
  });
  const [newSessionName, setNewSessionName] = useState('');

  // Conversation hook
  const conversation = useConversation(webSocketClient, {
    persistToLocalStorage: enableSessionPersistence,
    defaultSettings: settings,
    onError: (error) => {
      console.error('Conversation error:', error);
      onError?.(error);
    }
  });

  // Refs
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const lastSavedStateRef = useRef<string>('');

  // Load saved sessions on mount
  useEffect(() => {
    if (enableSessionPersistence) {
      loadSavedSessions();
    }
  }, [enableSessionPersistence]);

  // Auto-save conversation state
  useEffect(() => {
    if (enableAutoSave && conversation.state.sessionId) {
      const currentState = JSON.stringify({
        messages: conversation.state.messages,
        settings: conversation.state.settings,
        statistics: conversation.state.statistics
      });

      if (currentState !== lastSavedStateRef.current) {
        // Debounce auto-save
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = window.setTimeout(() => {
          saveCurrentSession();
          lastSavedStateRef.current = currentState;
        }, 2000); // Save after 2 seconds of inactivity
      }
    }
  }, [conversation.state, enableAutoSave]);

  // Settings management
  const updateSettings = useCallback(async (newSettings: Partial<ConversationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    
    try {
      conversation.actions.updateSettings(updatedSettings);
      onSettingsChange?.(updatedSettings);
      
      // Save to localStorage
      if (enableSessionPersistence) {
        localStorage.setItem('conversation-settings', JSON.stringify(updatedSettings));
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      onError?.({
        type: 'unknown_error',
        message: `Failed to update settings: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [settings, conversation.actions, onSettingsChange, enableSessionPersistence, onError]);

  // Session management
  const createNewSession = useCallback(async (sessionName?: string) => {
    try {
      // End current session if active
      if (conversation.state.isActive) {
        await conversation.actions.endConversation();
      }

      // Clear current conversation
      conversation.actions.clearHistory();

      // Start new session
      await conversation.actions.startConversation(settings);

      if (conversation.state.sessionId) {
        const sessionInfo: SessionInfo = {
          id: conversation.state.sessionId,
          name: sessionName || `Session ${new Date().toLocaleDateString()}`,
          createdAt: new Date(),
          lastActiveAt: new Date(),
          messageCount: 0,
          language: settings.language
        };

        // Update saved sessions
        setSavedSessions(prev => [sessionInfo, ...prev]);
        
        if (enableSessionPersistence) {
          saveSessionInfo(sessionInfo);
        }

        onSessionCreated?.(conversation.state.sessionId);
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
      onError?.({
        type: 'connection_failed',
        message: `Failed to create session: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [conversation, settings, enableSessionPersistence, onSessionCreated, onError]);

  const restoreSession = useCallback(async (sessionId: string) => {
    try {
      // End current session if active
      if (conversation.state.isActive) {
        await conversation.actions.endConversation();
      }

      // Restore session
      await conversation.actions.restoreSession(sessionId);

      // Update session last active time
      setSavedSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? { ...session, lastActiveAt: new Date() }
            : session
        )
      );

      onSessionRestored?.(sessionId);
    } catch (error) {
      console.error('Failed to restore session:', error);
      onError?.({
        type: 'session_expired',
        message: `Failed to restore session: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [conversation, onSessionRestored, onError]);

  const deleteSession = useCallback((sessionId: string) => {
    setSavedSessions(prev => prev.filter(session => session.id !== sessionId));
    
    if (enableSessionPersistence) {
      const sessions = JSON.parse(localStorage.getItem('saved-sessions') || '[]');
      const updatedSessions = sessions.filter((session: SessionInfo) => session.id !== sessionId);
      localStorage.setItem('saved-sessions', JSON.stringify(updatedSessions));
      localStorage.removeItem(`session-${sessionId}`);
    }
  }, [enableSessionPersistence]);

  const saveCurrentSession = useCallback(() => {
    if (!conversation.state.sessionId || !enableSessionPersistence) return;

    const sessionData = {
      id: conversation.state.sessionId,
      messages: conversation.state.messages,
      settings: conversation.state.settings,
      statistics: conversation.state.statistics,
      savedAt: new Date()
    };

    localStorage.setItem(`session-${conversation.state.sessionId}`, JSON.stringify(sessionData));

    // Update session info
    setSavedSessions(prev => 
      prev.map(session => 
        session.id === conversation.state.sessionId 
          ? { 
              ...session, 
              lastActiveAt: new Date(),
              messageCount: conversation.state.messages.length
            }
          : session
      )
    );
  }, [conversation.state, enableSessionPersistence]);

  // Export functionality
  const exportConversation = useCallback(async () => {
    try {
      const messages = conversation.state.messages;
      const settings = conversation.state.settings;
      const statistics = conversation.state.statistics;

      let exportData: any;
      let fileName: string;
      let mimeType: string;

      switch (exportOptions.format) {
        case 'json':
          exportData = {
            sessionId: conversation.state.sessionId,
            exportedAt: new Date(),
            ...(exportOptions.includeMetadata && { settings, statistics }),
            messages: messages.map(msg => ({
              id: msg.id,
              type: msg.type,
              content: msg.content,
              ...(exportOptions.includeTimestamps && { timestamp: msg.timestamp }),
              ...(exportOptions.includeMetadata && { status: msg.status, metadata: msg.metadata })
            }))
          };
          fileName = `conversation-${conversation.state.sessionId || 'export'}.json`;
          mimeType = 'application/json';
          break;

        case 'txt':
          exportData = messages.map(msg => {
            const timestamp = exportOptions.includeTimestamps 
              ? `[${msg.timestamp.toLocaleString()}] `
              : '';
            const sender = msg.type === 'user' ? 'You' : 'Assistant';
            return `${timestamp}${sender}: ${msg.content}`;
          }).join('\n\n');
          fileName = `conversation-${conversation.state.sessionId || 'export'}.txt`;
          mimeType = 'text/plain';
          break;

        case 'csv':
          const headers = ['Type', 'Content'];
          if (exportOptions.includeTimestamps) headers.unshift('Timestamp');
          if (exportOptions.includeMetadata) headers.push('Status', 'Confidence');

          const csvRows = [
            headers.join(','),
            ...messages.map(msg => {
              const row = [msg.type, `"${msg.content.replace(/"/g, '""')}"`];
              if (exportOptions.includeTimestamps) row.unshift(msg.timestamp.toISOString());
              if (exportOptions.includeMetadata) {
                row.push(msg.status || '');
                row.push(msg.metadata?.transcriptionConfidence?.toString() || '');
              }
              return row.join(',');
            })
          ];
          exportData = csvRows.join('\n');
          fileName = `conversation-${conversation.state.sessionId || 'export'}.csv`;
          mimeType = 'text/csv';
          break;
      }

      // Create and download file
      const blob = new Blob([typeof exportData === 'string' ? exportData : JSON.stringify(exportData, null, 2)], 
        { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
    } catch (error) {
      console.error('Failed to export conversation:', error);
      onError?.({
        type: 'unknown_error',
        message: `Failed to export conversation: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: error
      });
    }
  }, [conversation.state, exportOptions, onError]);

  // Utility functions
  const loadSavedSessions = () => {
    try {
      const sessions = JSON.parse(localStorage.getItem('saved-sessions') || '[]');
      setSavedSessions(sessions.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        lastActiveAt: new Date(session.lastActiveAt)
      })));
    } catch (error) {
      console.error('Failed to load saved sessions:', error);
    }
  };

  const saveSessionInfo = (sessionInfo: SessionInfo) => {
    try {
      const sessions = JSON.parse(localStorage.getItem('saved-sessions') || '[]');
      const updatedSessions = [sessionInfo, ...sessions.filter((s: SessionInfo) => s.id !== sessionInfo.id)];
      localStorage.setItem('saved-sessions', JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to save session info:', error);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Session Controls */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Session Management</h3>
        
        <div className="flex items-center space-x-3 mb-4">
          <button
            onClick={() => createNewSession()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            New Session
          </button>
          
          <button
            onClick={() => setShowSessionManager(!showSessionManager)}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            Manage Sessions ({savedSessions.length})
          </button>
          
          <button
            onClick={() => setShowExportDialog(true)}
            disabled={conversation.state.messages.length === 0}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export
          </button>
        </div>

        {/* Current Session Info */}
        {conversation.state.sessionId && (
          <div className="p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">Current Session</span>
                <div className="text-xs text-muted-foreground">
                  ID: {conversation.state.sessionId.substring(0, 8)}...
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-foreground">
                  {conversation.state.messages.length} messages
                </div>
                <div className="text-xs text-muted-foreground">
                  {conversation.state.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conversation Settings */}
      <div className="p-4 bg-card border border-border rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Conversation Settings</h3>
        
        <div className="space-y-4">
          {/* Language Settings */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Language
            </label>
            <div className="flex items-center space-x-3">
              <select
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value })}
                className="flex-1 p-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Spanish (Spain)</option>
                <option value="es-MX">Spanish (Mexico)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="it-IT">Italian</option>
                <option value="pt-BR">Portuguese (Brazil)</option>
                <option value="ja-JP">Japanese</option>
                <option value="ko-KR">Korean</option>
                <option value="zh-CN">Chinese (Simplified)</option>
              </select>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.autoDetectLanguage}
                  onChange={(e) => updateSettings({ autoDetectLanguage: e.target.checked })}
                  className="text-primary"
                />
                <span className="text-sm text-foreground">Auto-detect</span>
              </label>
            </div>
          </div>

          {/* Feature Settings */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.enableTranscription}
                onChange={(e) => updateSettings({ enableTranscription: e.target.checked })}
                className="text-primary"
              />
              <span className="text-sm text-foreground">Enable Transcription</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.enableAudioResponse}
                onChange={(e) => updateSettings({ enableAudioResponse: e.target.checked })}
                className="text-primary"
              />
              <span className="text-sm text-foreground">Audio Response</span>
            </label>
          </div>

          {/* Advanced Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Max Messages
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={settings.maxMessageHistory}
                onChange={(e) => updateSettings({ maxMessageHistory: parseInt(e.target.value) })}
                className="w-full p-2 border border-input rounded-md bg-background text-foreground"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Summarization Threshold
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={settings.summarizationThreshold}
                onChange={(e) => updateSettings({ summarizationThreshold: parseInt(e.target.value) })}
                className="w-full p-2 border border-input rounded-md bg-background text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Session Manager Modal */}
      {showSessionManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Saved Sessions</h3>
              <button
                onClick={() => setShowSessionManager(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-96 space-y-3">
              {savedSessions.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No saved sessions
                </div>
              ) : (
                savedSessions.map((session) => (
                  <div key={session.id} className="p-3 border border-border rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{session.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {session.messageCount} messages • {session.language}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Created: {formatDate(session.createdAt)} • 
                          Last active: {formatDate(session.lastActiveAt)}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => restoreSession(session.id)}
                          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Export Conversation</h3>
              <button
                onClick={() => setShowExportDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Format</label>
                <select
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'json' | 'txt' | 'csv' }))}
                  className="w-full p-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="json">JSON</option>
                  <option value="txt">Text</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeTimestamps}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeTimestamps: e.target.checked }))}
                    className="text-primary"
                  />
                  <span className="text-sm text-foreground">Include timestamps</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportOptions.includeMetadata}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                    className="text-primary"
                  />
                  <span className="text-sm text-foreground">Include metadata</span>
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={exportConversation}
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Export
                </button>
                <button
                  onClick={() => setShowExportDialog(false)}
                  className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {conversation.state.statistics.totalMessages > 0 && (
        <div className="p-4 bg-card border border-border rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4">Statistics</h3>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {conversation.state.statistics.totalMessages}
              </div>
              <div className="text-sm text-muted-foreground">Total Messages</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(conversation.state.statistics.averageResponseTime)}ms
              </div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold text-foreground">
                {Math.round(conversation.state.statistics.transcriptionAccuracy * 100)}%
              </div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useState } from 'react';
import { SettingsPanelProps } from '../../types/conversation';

/**
 * Modern Settings Panel with slide-in animation
 */
export function SettingsPanel({
  settings,
  onSettingsChange,
  onClose
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'audio' | 'ai' | 'ui'>('general');

  const updateSettings = (section: string, updates: any) => {
    onSettingsChange({
      ...settings,
      [section]: {
        ...settings[section as keyof typeof settings],
        ...updates
      }
    });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '🌐' },
    { id: 'audio', label: 'Audio', icon: '🎤' },
    { id: 'ai', label: 'AI', icon: '🤖' },
    { id: 'ui', label: 'Interface', icon: '🎨' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div 
        className="ml-auto w-96 h-full bg-slate-900/90 backdrop-blur-xl border-l border-white/10
                   transform transition-transform duration-300 ease-out
                   shadow-2xl shadow-purple-500/20"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mt-4 bg-white/5 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all
                          ${activeTab === tab.id 
                            ? 'bg-white/10 text-white' 
                            : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 h-full overflow-y-auto">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings('language', e.target.value)}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="zh-CN">Chinese</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white">
                  Auto-detect Language
                </label>
                <button
                  onClick={() => updateSettings('autoDetectLanguage', !settings.autoDetectLanguage)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.autoDetectLanguage ? 'bg-purple-500' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.autoDetectLanguage ? 'translate-x-6' : 'translate-x-0.5'
                    } top-0.5`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Audio Settings */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-4">
                  Voice Activity Thresholds
                </label>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Short Pause (Natural gap)
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="2000"
                      step="100"
                      value={settings.voiceActivityThresholds.shortPause}
                      onChange={(e) => updateSettings('voiceActivityThresholds', {
                        ...settings.voiceActivityThresholds,
                        shortPause: parseInt(e.target.value)
                      })}
                      className="w-full accent-purple-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {settings.voiceActivityThresholds.shortPause}ms
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Medium Pause (End of thought)
                    </label>
                    <input
                      type="range"
                      min="500"
                      max="3000"
                      step="100"
                      value={settings.voiceActivityThresholds.mediumPause}
                      onChange={(e) => updateSettings('voiceActivityThresholds', {
                        ...settings.voiceActivityThresholds,
                        mediumPause: parseInt(e.target.value)
                      })}
                      className="w-full accent-purple-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {settings.voiceActivityThresholds.mediumPause}ms
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Long Pause (User waiting)
                    </label>
                    <input
                      type="range"
                      min="1000"
                      max="5000"
                      step="250"
                      value={settings.voiceActivityThresholds.longPause}
                      onChange={(e) => updateSettings('voiceActivityThresholds', {
                        ...settings.voiceActivityThresholds,
                        longPause: parseInt(e.target.value)
                      })}
                      className="w-full accent-purple-500"
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {settings.voiceActivityThresholds.longPause}ms
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Sample Rate
                </label>
                <select
                  value={settings.audioSettings.sampleRate}
                  onChange={(e) => updateSettings('audioSettings', {
                    ...settings.audioSettings,
                    sampleRate: parseInt(e.target.value)
                  })}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value={8000}>8 kHz</option>
                  <option value={16000}>16 kHz (Recommended)</option>
                  <option value={44100}>44.1 kHz</option>
                  <option value={48000}>48 kHz</option>
                </select>
              </div>
            </div>
          )}

          {/* AI Settings */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  AI Provider
                </label>
                <select
                  value={settings.aiSettings.provider}
                  onChange={(e) => updateSettings('aiSettings', {
                    ...settings.aiSettings,
                    provider: e.target.value
                  })}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="azure-openai">Azure OpenAI</option>
                  <option value="openai">OpenAI</option>
                  <option value="mock">Mock (Development)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Model
                </label>
                <select
                  value={settings.aiSettings.model}
                  onChange={(e) => updateSettings('aiSettings', {
                    ...settings.aiSettings,
                    model: e.target.value
                  })}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Temperature: {settings.aiSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.aiSettings.temperature}
                  onChange={(e) => updateSettings('aiSettings', {
                    ...settings.aiSettings,
                    temperature: parseFloat(e.target.value)
                  })}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  step="100"
                  value={settings.aiSettings.maxTokens}
                  onChange={(e) => updateSettings('aiSettings', {
                    ...settings.aiSettings,
                    maxTokens: parseInt(e.target.value)
                  })}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white">
                  Enable Streaming
                </label>
                <button
                  onClick={() => updateSettings('aiSettings', {
                    ...settings.aiSettings,
                    streamingEnabled: !settings.aiSettings.streamingEnabled
                  })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.aiSettings.streamingEnabled ? 'bg-purple-500' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.aiSettings.streamingEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    } top-0.5`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* UI Settings */}
          {activeTab === 'ui' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Theme
                </label>
                <select
                  value={settings.uiSettings.theme}
                  onChange={(e) => updateSettings('uiSettings', {
                    ...settings.uiSettings,
                    theme: e.target.value
                  })}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white
                           focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="modern-dark">Modern Dark</option>
                  <option value="modern-light">Modern Light</option>
                  <option value="classic">Classic</option>
                </select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Show Live Transcript
                  </label>
                  <button
                    onClick={() => updateSettings('uiSettings', {
                      ...settings.uiSettings,
                      showLiveTranscript: !settings.uiSettings.showLiveTranscript
                    })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.uiSettings.showLiveTranscript ? 'bg-purple-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.uiSettings.showLiveTranscript ? 'translate-x-6' : 'translate-x-0.5'
                      } top-0.5`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Show Confidence Scores
                  </label>
                  <button
                    onClick={() => updateSettings('uiSettings', {
                      ...settings.uiSettings,
                      showConfidenceScores: !settings.uiSettings.showConfidenceScores
                    })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.uiSettings.showConfidenceScores ? 'bg-purple-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.uiSettings.showConfidenceScores ? 'translate-x-6' : 'translate-x-0.5'
                      } top-0.5`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Enable Interruptions
                  </label>
                  <button
                    onClick={() => updateSettings('uiSettings', {
                      ...settings.uiSettings,
                      enableInterruptions: !settings.uiSettings.enableInterruptions
                    })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.uiSettings.enableInterruptions ? 'bg-purple-500' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.uiSettings.enableInterruptions ? 'translate-x-6' : 'translate-x-0.5'
                      } top-0.5`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-blue-500 
                     text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-600
                     transition-all duration-200 transform hover:scale-105"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
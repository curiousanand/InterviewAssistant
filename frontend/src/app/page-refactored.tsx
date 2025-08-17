'use client';

import React, { useEffect, useState } from 'react';
import { useInterviewAssistant } from '../hooks/useInterviewAssistant';
import { Header } from '../components/interview/Header';
import { ChatArea } from '../components/interview/ChatArea';
import { RecordingControls } from '../components/interview/RecordingControls';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { LoadingScreen } from '../components/ui/LoadingScreen';

/**
 * Refactored Interview Assistant Application
 * Clean, modular architecture with separated concerns
 */
export default function InterviewAssistantPage() {
  const {
    isInitialized,
    connectionState,
    recordingState,
    messages,
    currentTranscript,
    currentAssistantResponse,
    error,
    initialize,
    startRecording,
    stopRecording,
    clearConversation,
    changeLanguage,
    setError,
    cleanup
  } = useInterviewAssistant();

  // UI state
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);

  // Initialize on mount
  useEffect(() => {
    initialize(selectedLanguage, autoDetectLanguage);
    return cleanup;
  }, []);

  // Handle language change
  const handleLanguageChange = async (languageCode: string) => {
    setSelectedLanguage(languageCode);
    await changeLanguage(languageCode, autoDetectLanguage);
  };

  // Loading state
  if (!isInitialized) {
    return <LoadingScreen error={error} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        connectionState={connectionState}
        onLanguageSettingsToggle={() => setShowLanguageSettings(!showLanguageSettings)}
        onClearConversation={clearConversation}
        messagesCount={messages.length}
      />

      {/* Language Settings Panel */}
      {showLanguageSettings && (
        <div className="container mx-auto px-4">
          <div className="mt-4 p-4 border border-border rounded-lg bg-muted/50">
            <LanguageSelector
              selectedLanguage={selectedLanguage}
              onLanguageChange={handleLanguageChange}
              autoDetectLanguage={autoDetectLanguage}
              onAutoDetectChange={setAutoDetectLanguage}
              variant="dropdown"
              searchable
              showFlags
              showNativeNames
              className="max-w-md"
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <ChatArea
          messages={messages}
          currentTranscript={currentTranscript}
          currentAssistantResponse={currentAssistantResponse}
          isProcessing={recordingState.isProcessing}
          error={error}
        />

        <RecordingControls
          recordingState={recordingState}
          connectionState={connectionState}
          error={error}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onClearError={() => setError(null)}
        />
      </main>
    </div>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import { useInterviewAssistant } from '../hooks/useInterviewAssistant';
import { Header } from '../components/interview/Header';
import { ChatArea } from '../components/interview/ChatArea';
import { RecordingControls } from '../components/interview/RecordingControls';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { LoadingScreen } from '../components/ui/LoadingScreen';

/**
 * Clean, refactored Interview Assistant application
 */
export default function HomePage() {
  const assistant = useInterviewAssistant();
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);

  useEffect(() => {
    assistant.initialize(selectedLanguage, autoDetectLanguage);
    return () => {
      assistant.cleanup();
    };
  }, []);

  const handleLanguageChange = async (languageCode: string) => {
    setSelectedLanguage(languageCode);
    await assistant.changeLanguage(languageCode, autoDetectLanguage);
  };

  if (!assistant.isInitialized) {
    return <LoadingScreen error={assistant.error} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        connectionState={assistant.connectionState}
        onLanguageSettingsToggle={() => setShowLanguageSettings(!showLanguageSettings)}
        onClearConversation={assistant.clearConversation}
        messagesCount={assistant.messages.length}
      />

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

      <main className="flex-1 overflow-hidden flex flex-col">
        <ChatArea
          messages={assistant.messages}
          currentTranscript={assistant.currentTranscript}
          currentAssistantResponse={assistant.currentAssistantResponse}
          isProcessing={assistant.recordingState.isProcessing}
          error={assistant.error}
        />

        <RecordingControls
          recordingState={assistant.recordingState}
          connectionState={assistant.connectionState}
          error={assistant.error}
          onStartRecording={assistant.startRecording}
          onStopRecording={assistant.stopRecording}
          onClearError={() => assistant.setError(null)}
        />
      </main>
    </div>
  );
}
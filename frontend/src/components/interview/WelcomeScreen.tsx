'use client';

import React from 'react';

interface WelcomeScreenProps {
  error: string | null;
}

export function WelcomeScreen({ error }: WelcomeScreenProps) {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-4">Welcome to Interview Assistant</h2>
      <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
        Start a conversation by clicking the microphone button. I can help you with questions, 
        provide information, and assist with interview preparation in multiple languages.
      </p>
      
      {error?.includes('microphone') && (
        <MicrophoneAccessInfo />
      )}
      
      <FeatureCards />
    </div>
  );
}

function MicrophoneAccessInfo() {
  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-2xl mx-auto">
      <p className="text-blue-800 text-sm">
        <strong>Microphone Access:</strong> Please allow microphone access when prompted by your browser. 
        If blocked, click the 🔒 icon in your address bar to enable microphone permissions.
        <br />
        <em>Note: The demo will work with simulated audio if microphone access is unavailable.</em>
      </p>
    </div>
  );
}

function FeatureCards() {
  const features = [
    { icon: '🎙️', title: 'Voice Input', description: 'Real-time speech recognition' },
    { icon: '🤖', title: 'AI Responses', description: 'Intelligent context-aware answers' },
    { icon: '🌍', title: 'Multilingual', description: 'Support for 15+ languages' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
      {features.map((feature, index) => (
        <div key={index} className="p-4 border border-border rounded-lg">
          <div className="text-lg mb-2">{feature.icon}</div>
          <div className="font-medium">{feature.title}</div>
          <div className="text-muted-foreground">{feature.description}</div>
        </div>
      ))}
    </div>
  );
}
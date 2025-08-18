'use client';

import React from 'react';
import { ConversationMessage } from '../../types/conversation';

interface MessageBubbleProps {
  message: ConversationMessage;
  isLatest: boolean;
  showConfidence: boolean;
}

/**
 * Modern Message Bubble Component
 */
export function MessageBubble({ message, isLatest, showConfidence }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
          isUser 
            ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white ml-12' 
            : 'bg-white/10 text-white mr-12 backdrop-blur-sm'
        } ${isLatest ? 'animate-fadeIn' : ''}`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        
        {/* Message metadata */}
        <div className="flex items-center justify-between mt-2 text-xs opacity-70">
          <span>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          
          {showConfidence && message.metadata?.confidence && (
            <span className="ml-2">
              {Math.round(message.metadata.confidence * 100)}%
            </span>
          )}
          
          {message.metadata?.processingTime && (
            <span className="ml-2">
              {message.metadata.processingTime}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
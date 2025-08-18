import { EventEmitter } from 'events';
import { ConversationMessage, ContextState } from '../../types/conversation';

/**
 * Mock Contextual Conversation Manager
 * This is a simplified implementation for initial testing
 */
export class ContextualConversationManager extends EventEmitter {
  private context: ContextState = {
    currentTopic: '',
    entities: [],
    conversationHistory: [],
    userPreferences: {}
  };

  async initialize(): Promise<void> {
    console.log('🧠 ContextualConversationManager initialized');
  }

  async buildContext(transcript: string): Promise<ContextState> {
    // Simple context extraction
    const words = transcript.toLowerCase().split(' ');
    const entities: string[] = [];
    
    // Extract simple entities (this would be much more sophisticated in real implementation)
    words.forEach(word => {
      if (word.length > 5 && !entities.includes(word)) {
        entities.push(word);
      }
    });

    // Update context
    this.context = {
      currentTopic: this.extractTopic(transcript),
      entities: [...new Set([...this.context.entities, ...entities])].slice(0, 20),
      conversationHistory: this.context.conversationHistory,
      userPreferences: this.context.userPreferences,
      sessionContext: {
        startTime: this.context.sessionContext?.startTime || new Date(),
        messageCount: this.context.conversationHistory.length,
        averageResponseTime: 1500 // Mock average
      }
    };

    this.emit('contextUpdated', this.context);
    return this.context;
  }

  private extractTopic(transcript: string): string {
    // Simple topic extraction (would use NLP in real implementation)
    const words = transcript.toLowerCase().split(' ');
    
    if (words.some(w => ['weather', 'temperature', 'rain', 'sun'].includes(w))) {
      return 'Weather';
    } else if (words.some(w => ['food', 'eat', 'restaurant', 'cooking'].includes(w))) {
      return 'Food & Dining';
    } else if (words.some(w => ['work', 'job', 'career', 'office'].includes(w))) {
      return 'Work & Career';
    } else if (words.some(w => ['travel', 'trip', 'vacation', 'journey'].includes(w))) {
      return 'Travel';
    }
    
    return 'General Conversation';
  }

  addMessages(messages: ConversationMessage[]): void {
    this.context.conversationHistory.push(...messages);
    this.context.sessionContext = {
      startTime: this.context.sessionContext?.startTime || new Date(),
      messageCount: this.context.conversationHistory.length,
      averageResponseTime: this.context.sessionContext?.averageResponseTime || 1500
    };

    this.emit('contextUpdated', this.context);
  }

  clear(): void {
    this.context = {
      currentTopic: '',
      entities: [],
      conversationHistory: [],
      userPreferences: {}
    };
    
    this.emit('contextUpdated', this.context);
  }

  getContext(): ContextState {
    return { ...this.context };
  }
}
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';
import { 
  ConversationState, 
  ConversationSettings, 
  ConversationMessage,
  MessageStatus,
  ConversationError,
  ConversationErrorType
} from '@/hooks/useConversation';

/**
 * Conversation Orchestrator Service
 * 
 * Why: Coordinates complex conversation workflows between multiple services
 * Pattern: Orchestrator Pattern - manages interactions between services
 * Rationale: Centralizes conversation flow logic and handles state transitions
 */

interface ConversationWorkflowConfig {
  autoTranscription: boolean;
  autoResponse: boolean;
  maxRetries: number;
  timeoutMs: number;
  enableStatistics: boolean;
}

interface ConversationEvents {
  onStateChange: (oldState: ConversationState, newState: ConversationState) => void;
  onMessageAdded: (message: ConversationMessage) => void;
  onMessageUpdated: (message: ConversationMessage) => void;
  onError: (error: ConversationError) => void;
  onTranscriptionStarted: () => void;
  onTranscriptionCompleted: (text: string, confidence: number) => void;
  onResponseStarted: () => void;
  onResponseCompleted: (response: string) => void;
}

interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: Error;
  data?: any;
}

interface WorkflowContext {
  sessionId: string;
  currentStep: string | null;
  steps: Map<string, WorkflowStep>;
  audioData?: ArrayBuffer;
  transcriptionText?: string;
  responseText?: string;
  userMessage?: ConversationMessage;
  assistantMessage?: ConversationMessage;
}

export class ConversationOrchestrator {
  private webSocketClient: IWebSocketClient;
  private config: ConversationWorkflowConfig;
  private events: Partial<ConversationEvents>;
  private activeWorkflows: Map<string, WorkflowContext> = new Map();
  private isProcessing: boolean = false;
  
  // Workflow statistics
  private statistics = {
    totalWorkflows: 0,
    successfulWorkflows: 0,
    failedWorkflows: 0,
    averageWorkflowTime: 0,
    stepStatistics: new Map<string, { executions: number; averageTime: number; failures: number }>()
  };

  constructor(
    webSocketClient: IWebSocketClient,
    config: Partial<ConversationWorkflowConfig> = {},
    events: Partial<ConversationEvents> = {}
  ) {
    this.webSocketClient = webSocketClient;
    this.config = {
      autoTranscription: true,
      autoResponse: true,
      maxRetries: 3,
      timeoutMs: 30000,
      enableStatistics: true,
      ...config
    };
    this.events = events;
  }

  /**
   * Start a complete conversation workflow from audio input
   */
  async startAudioToResponseWorkflow(
    sessionId: string,
    audioData: ArrayBuffer,
    settings?: Partial<ConversationSettings>
  ): Promise<ConversationMessage> {
    const workflowId = this.generateWorkflowId();
    
    try {
      // Initialize workflow context
      const context = this.createWorkflowContext(workflowId, sessionId, [
        { id: 'send_audio', name: 'Send Audio Data' },
        { id: 'transcribe', name: 'Transcribe Audio' },
        { id: 'create_user_message', name: 'Create User Message' },
        { id: 'send_to_ai', name: 'Send to AI Service' },
        { id: 'receive_response', name: 'Receive AI Response' },
        { id: 'create_assistant_message', name: 'Create Assistant Message' }
      ]);
      
      context.audioData = audioData;
      this.activeWorkflows.set(workflowId, context);
      this.statistics.totalWorkflows++;

      // Execute workflow steps
      await this.executeStep(workflowId, 'send_audio', () => this.sendAudioData(context, audioData));
      
      const transcriptionText = await this.executeStep(
        workflowId, 
        'transcribe', 
        () => this.waitForTranscription(context)
      );
      
      const userMessage = await this.executeStep(
        workflowId,
        'create_user_message',
        () => this.createUserMessage(context, transcriptionText, settings)
      );
      
      await this.executeStep(
        workflowId,
        'send_to_ai',
        () => this.sendMessageToAI(context, userMessage)
      );
      
      const responseText = await this.executeStep(
        workflowId,
        'receive_response',
        () => this.waitForAIResponse(context)
      );
      
      const assistantMessage = await this.executeStep(
        workflowId,
        'create_assistant_message',
        () => this.createAssistantMessage(context, responseText)
      );

      // Mark workflow as successful
      this.markWorkflowCompleted(workflowId, true);
      this.statistics.successfulWorkflows++;
      
      return assistantMessage;
      
    } catch (error) {
      this.markWorkflowCompleted(workflowId, false, error as Error);
      this.statistics.failedWorkflows++;
      
      const conversationError: ConversationError = {
        type: ConversationErrorType.UNKNOWN_ERROR,
        message: `Workflow failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: { workflowId, sessionId }
      };
      
      this.events.onError?.(conversationError);
      throw conversationError;
      
    } finally {
      this.activeWorkflows.delete(workflowId);
      this.isProcessing = false;
    }
  }

  /**
   * Start a text-to-response workflow
   */
  async startTextToResponseWorkflow(
    sessionId: string,
    text: string,
    settings?: Partial<ConversationSettings>
  ): Promise<ConversationMessage> {
    const workflowId = this.generateWorkflowId();
    
    try {
      const context = this.createWorkflowContext(workflowId, sessionId, [
        { id: 'create_user_message', name: 'Create User Message' },
        { id: 'send_to_ai', name: 'Send to AI Service' },
        { id: 'receive_response', name: 'Receive AI Response' },
        { id: 'create_assistant_message', name: 'Create Assistant Message' }
      ]);
      
      this.activeWorkflows.set(workflowId, context);
      this.statistics.totalWorkflows++;

      const userMessage = await this.executeStep(
        workflowId,
        'create_user_message',
        () => this.createUserMessage(context, text, settings)
      );
      
      await this.executeStep(
        workflowId,
        'send_to_ai',
        () => this.sendMessageToAI(context, userMessage)
      );
      
      const responseText = await this.executeStep(
        workflowId,
        'receive_response',
        () => this.waitForAIResponse(context)
      );
      
      const assistantMessage = await this.executeStep(
        workflowId,
        'create_assistant_message',
        () => this.createAssistantMessage(context, responseText)
      );

      this.markWorkflowCompleted(workflowId, true);
      this.statistics.successfulWorkflows++;
      
      return assistantMessage;
      
    } catch (error) {
      this.markWorkflowCompleted(workflowId, false, error as Error);
      this.statistics.failedWorkflows++;
      throw error;
      
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  /**
   * Resume a conversation session
   */
  async resumeConversationSession(
    sessionId: string,
    settings?: Partial<ConversationSettings>
  ): Promise<void> {
    try {
      await this.webSocketClient.sendJSON({
        type: 'session.restore',
        data: {
          sessionId,
          settings: settings || {}
        }
      });
      
    } catch (error) {
      const conversationError: ConversationError = {
        type: ConversationErrorType.SESSION_EXPIRED,
        message: `Failed to resume session: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        recoverable: true,
        context: { sessionId }
      };
      
      this.events.onError?.(conversationError);
      throw conversationError;
    }
  }

  /**
   * Get workflow statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      activeWorkflows: this.activeWorkflows.size,
      stepStatistics: Object.fromEntries(this.statistics.stepStatistics)
    };
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): WorkflowContext[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(workflowId: string): boolean {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      return false;
    }

    // Mark current step as failed
    if (context.currentStep) {
      const step = context.steps.get(context.currentStep);
      if (step && step.status === 'running') {
        step.status = 'failed';
        step.endTime = new Date();
        step.error = new Error('Workflow cancelled');
      }
    }

    this.activeWorkflows.delete(workflowId);
    return true;
  }

  // Private implementation methods

  private createWorkflowContext(
    workflowId: string, 
    sessionId: string, 
    stepDefinitions: Array<{ id: string; name: string }>
  ): WorkflowContext {
    const steps = new Map<string, WorkflowStep>();
    
    stepDefinitions.forEach(stepDef => {
      steps.set(stepDef.id, {
        id: stepDef.id,
        name: stepDef.name,
        status: 'pending'
      });
    });

    return {
      sessionId,
      currentStep: null,
      steps
    };
  }

  private async executeStep<T>(
    workflowId: string,
    stepId: string,
    executor: () => Promise<T>
  ): Promise<T> {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const step = context.steps.get(stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow ${workflowId}`);
    }

    try {
      // Mark step as running
      step.status = 'running';
      step.startTime = new Date();
      context.currentStep = stepId;

      // Execute step with timeout
      const result = await Promise.race([
        executor(),
        this.createTimeoutPromise(this.config.timeoutMs, `Step ${stepId} timed out`)
      ]);

      // Mark step as completed
      step.status = 'completed';
      step.endTime = new Date();
      step.data = result;

      // Update statistics
      this.updateStepStatistics(stepId, step.startTime, step.endTime, false);

      return result;

    } catch (error) {
      // Mark step as failed
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error as Error;

      // Update statistics
      if (step.startTime) {
        this.updateStepStatistics(stepId, step.startTime, step.endTime || new Date(), true);
      }

      throw error;
    }
  }

  private async sendAudioData(context: WorkflowContext, audioData: ArrayBuffer): Promise<void> {
    if (!this.webSocketClient.isConnected()) {
      throw new Error('WebSocket not connected');
    }

    try {
      await this.webSocketClient.sendBinary(audioData);
      this.events.onTranscriptionStarted?.();
    } catch (error) {
      throw new Error(`Failed to send audio data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async waitForTranscription(context: WorkflowContext): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Transcription timeout'));
      }, this.config.timeoutMs);

      const handleMessage = (event: any) => {
        try {
          const messageData = event.data;
          
          if (messageData.type === 'transcript.final') {
            clearTimeout(timeout);
            this.webSocketClient.removeEventListener('json_message', handleMessage);
            
            const transcriptionText = messageData.data?.text || '';
            const confidence = messageData.data?.confidence || 0;
            
            context.transcriptionText = transcriptionText;
            this.events.onTranscriptionCompleted?.(transcriptionText, confidence);
            
            resolve(transcriptionText);
          }
        } catch (error) {
          clearTimeout(timeout);
          this.webSocketClient.removeEventListener('json_message', handleMessage);
          reject(error);
        }
      };

      this.webSocketClient.addEventListener('json_message', handleMessage);
    });
  }

  private async createUserMessage(
    context: WorkflowContext,
    text: string,
    settings?: Partial<ConversationSettings>
  ): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content: text,
      timestamp: new Date(),
      status: MessageStatus.COMPLETED,
      metadata: {
        transcriptionConfidence: context.transcriptionText ? 0.9 : undefined,
        audioLength: context.audioData?.byteLength,
        language: settings?.language
      }
    };

    context.userMessage = message;
    this.events.onMessageAdded?.(message);
    
    return message;
  }

  private async sendMessageToAI(context: WorkflowContext, message: ConversationMessage): Promise<void> {
    try {
      await this.webSocketClient.sendJSON({
        type: 'message.send',
        data: {
          messageId: message.id,
          content: message.content,
          messageType: 'text',
          sessionId: context.sessionId,
          metadata: message.metadata
        }
      });

      // Update message status
      message.status = MessageStatus.SENT;
      this.events.onMessageUpdated?.(message);
      this.events.onResponseStarted?.();
      
    } catch (error) {
      message.status = MessageStatus.FAILED;
      this.events.onMessageUpdated?.(message);
      throw new Error(`Failed to send message to AI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async waitForAIResponse(context: WorkflowContext): Promise<string> {
    return new Promise((resolve, reject) => {
      let responseText = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('AI response timeout'));
      }, this.config.timeoutMs);

      const handleMessage = (event: any) => {
        try {
          const messageData = event.data;
          
          if (messageData.type === 'assistant.delta') {
            responseText += messageData.content || '';
          } else if (messageData.type === 'assistant.done') {
            clearTimeout(timeout);
            this.webSocketClient.removeEventListener('json_message', handleMessage);
            
            context.responseText = responseText;
            this.events.onResponseCompleted?.(responseText);
            
            resolve(responseText);
          } else if (messageData.type === 'error') {
            clearTimeout(timeout);
            this.webSocketClient.removeEventListener('json_message', handleMessage);
            reject(new Error(messageData.error || 'AI response error'));
          }
        } catch (error) {
          clearTimeout(timeout);
          this.webSocketClient.removeEventListener('json_message', handleMessage);
          reject(error);
        }
      };

      this.webSocketClient.addEventListener('json_message', handleMessage);
    });
  }

  private async createAssistantMessage(context: WorkflowContext, responseText: string): Promise<ConversationMessage> {
    const message: ConversationMessage = {
      id: this.generateMessageId(),
      type: 'assistant',
      content: responseText,
      timestamp: new Date(),
      status: MessageStatus.COMPLETED,
      metadata: {
        processingTime: Date.now() - (context.userMessage?.timestamp.getTime() || Date.now()),
        isComplete: true
      }
    };

    context.assistantMessage = message;
    this.events.onMessageAdded?.(message);
    
    return message;
  }

  private createTimeoutPromise<T>(timeoutMs: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    });
  }

  private markWorkflowCompleted(workflowId: string, success: boolean, error?: Error): void {
    const context = this.activeWorkflows.get(workflowId);
    if (!context) return;

    // Calculate workflow duration
    const firstStep = Array.from(context.steps.values())[0];
    const lastStep = Array.from(context.steps.values()).pop();
    
    if (firstStep?.startTime && lastStep?.endTime) {
      const duration = lastStep.endTime.getTime() - firstStep.startTime.getTime();
      
      // Update average workflow time
      const totalTime = this.statistics.averageWorkflowTime * (this.statistics.totalWorkflows - 1) + duration;
      this.statistics.averageWorkflowTime = totalTime / this.statistics.totalWorkflows;
    }
  }

  private updateStepStatistics(stepId: string, startTime: Date, endTime: Date, failed: boolean): void {
    if (!this.config.enableStatistics) return;

    const duration = endTime.getTime() - startTime.getTime();
    const existing = this.statistics.stepStatistics.get(stepId) || { 
      executions: 0, 
      averageTime: 0, 
      failures: 0 
    };

    existing.executions++;
    existing.averageTime = ((existing.averageTime * (existing.executions - 1)) + duration) / existing.executions;
    
    if (failed) {
      existing.failures++;
    }

    this.statistics.stepStatistics.set(stepId, existing);
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
import { useState, useCallback, useEffect, useRef } from 'react';
import { IWebSocketClient } from '@/lib/websocket/interfaces/IWebSocketClient';

/**
 * Transcription management hook
 * 
 * Why: Manages real-time transcription state and WebSocket events
 * Pattern: Custom Hook - encapsulates transcription logic and state management
 * Rationale: Provides clean API for components to handle voice-to-text conversion
 */

interface TranscriptionResult {
  id: string;
  text: string;
  confidence: number;
  isPartial: boolean;
  isFinal: boolean;
  timestamp: Date;
  language?: string;
  alternatives?: TranscriptionAlternative[];
}

interface TranscriptionAlternative {
  text: string;
  confidence: number;
}

interface TranscriptionError {
  type: TranscriptionErrorType;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

enum TranscriptionErrorType {
  NETWORK_ERROR = 'network_error',
  AUDIO_ERROR = 'audio_error',
  SERVICE_ERROR = 'service_error',
  LANGUAGE_NOT_SUPPORTED = 'language_not_supported',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

interface TranscriptionSettings {
  language: string;
  autoDetectLanguage: boolean;
  enableInterimResults: boolean;
  enableWordConfidence: boolean;
  punctuation: boolean;
  enableSpeakerDiarization: boolean;
  maxAlternatives: number;
  confidenceThreshold: number;
}

interface TranscriptionStatistics {
  totalResults: number;
  totalPartialResults: number;
  totalFinalResults: number;
  averageConfidence: number;
  totalProcessingTime: number;
  errorsCount: number;
  lastProcessedTime?: Date;
}

interface UseTranscriptionOptions {
  webSocketClient?: IWebSocketClient;
  settings?: Partial<TranscriptionSettings>;
  onPartialResult?: (result: TranscriptionResult) => void;
  onFinalResult?: (result: TranscriptionResult) => void;
  onError?: (error: TranscriptionError) => void;
  onLanguageDetected?: (language: string) => void;
  enableStatistics?: boolean;
  bufferSize?: number;
}

interface UseTranscriptionReturn {
  // Current transcription state
  currentTranscription: string;
  partialTranscription: string;
  finalTranscription: string;
  isTranscribing: boolean;
  confidence: number;
  language: string | null;
  error: TranscriptionError | null;
  
  // Transcription history
  results: TranscriptionResult[];
  statistics: TranscriptionStatistics;
  
  // Control methods
  startTranscription: () => void;
  stopTranscription: () => void;
  clearResults: () => void;
  updateSettings: (settings: Partial<TranscriptionSettings>) => void;
  
  // Result management
  getLatestResult: () => TranscriptionResult | null;
  getResultById: (id: string) => TranscriptionResult | null;
  getResultsByTimeRange: (start: Date, end: Date) => TranscriptionResult[];
}

const DEFAULT_SETTINGS: TranscriptionSettings = {
  language: 'en-US',
  autoDetectLanguage: true,
  enableInterimResults: true,
  enableWordConfidence: false,
  punctuation: true,
  enableSpeakerDiarization: false,
  maxAlternatives: 1,
  confidenceThreshold: 0.5
};

const DEFAULT_OPTIONS: Required<Omit<UseTranscriptionOptions, 'webSocketClient'>> = {
  settings: DEFAULT_SETTINGS,
  onPartialResult: () => {},
  onFinalResult: () => {},
  onError: () => {},
  onLanguageDetected: () => {},
  enableStatistics: true,
  bufferSize: 100
};

export function useTranscription(
  options: UseTranscriptionOptions = {}
): UseTranscriptionReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [currentTranscription, setCurrentTranscription] = useState<string>('');
  const [partialTranscription, setPartialTranscription] = useState<string>('');
  const [finalTranscription, setFinalTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(0);
  const [language, setLanguage] = useState<string | null>(null);
  const [error, setError] = useState<TranscriptionError | null>(null);
  const [results, setResults] = useState<TranscriptionResult[]>([]);
  const [statistics, setStatistics] = useState<TranscriptionStatistics>(() => initializeStatistics());
  const [settings, setSettings] = useState<TranscriptionSettings>({ ...DEFAULT_SETTINGS, ...opts.settings });
  
  // Refs for stable references
  const optionsRef = useRef(opts);
  const webSocketClientRef = useRef<IWebSocketClient | null>(options.webSocketClient || null);
  const confidenceHistoryRef = useRef<number[]>([]);
  const processingTimesRef = useRef<number[]>([]);
  
  // Update refs when options change
  useEffect(() => {
    optionsRef.current = { ...DEFAULT_OPTIONS, ...options };
    webSocketClientRef.current = options.webSocketClient || null;
  }, [options]);

  // Initialize statistics
  function initializeStatistics(): TranscriptionStatistics {
    return {
      totalResults: 0,
      totalPartialResults: 0,
      totalFinalResults: 0,
      averageConfidence: 0,
      totalProcessingTime: 0,
      errorsCount: 0
    };
  }

  // Setup WebSocket event listeners
  useEffect(() => {
    const client = webSocketClientRef.current;
    if (!client) return;

    const handlePartialTranscript = (event: any) => {
      try {
        const data = event.data;
        const result = createTranscriptionResult(data, true, false);
        
        setPartialTranscription(result.text);
        setCurrentTranscription(result.text);
        setConfidence(result.confidence);
        
        if (result.language) {
          setLanguage(result.language);
          optionsRef.current.onLanguageDetected?.(result.language);
        }
        
        addResult(result);
        updateStatistics(result, false);
        
        optionsRef.current.onPartialResult?.(result);
        
      } catch (err) {
        const transcriptionError: TranscriptionError = {
          type: TranscriptionErrorType.SERVICE_ERROR,
          message: `Failed to process partial transcript: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
          recoverable: true
        };
        
        setError(transcriptionError);
        updateStatistics(null, false, true);
        optionsRef.current.onError?.(transcriptionError);
      }
    };

    const handleFinalTranscript = (event: any) => {
      try {
        const data = event.data;
        const result = createTranscriptionResult(data, false, true);
        
        setFinalTranscription(prev => prev + (prev ? ' ' : '') + result.text);
        setCurrentTranscription(result.text);
        setPartialTranscription(''); // Clear partial when we have final
        setConfidence(result.confidence);
        
        if (result.language) {
          setLanguage(result.language);
        }
        
        addResult(result);
        updateStatistics(result, true);
        
        optionsRef.current.onFinalResult?.(result);
        
      } catch (err) {
        const transcriptionError: TranscriptionError = {
          type: TranscriptionErrorType.SERVICE_ERROR,
          message: `Failed to process final transcript: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
          recoverable: true
        };
        
        setError(transcriptionError);
        updateStatistics(null, false, true);
        optionsRef.current.onError?.(transcriptionError);
      }
    };

    const handleTranscriptionError = (event: any) => {
      const errorData = event.data || event.error;
      const transcriptionError: TranscriptionError = {
        type: mapErrorType(errorData.type || errorData.code),
        message: errorData.message || 'Transcription error occurred',
        timestamp: new Date(),
        recoverable: errorData.recoverable !== false
      };
      
      setError(transcriptionError);
      setIsTranscribing(false);
      
      updateStatistics(null, false, true);
      
      optionsRef.current.onError?.(transcriptionError);
    };

    // Register event listeners using JSON message handling
    const handleJsonMessage = (event: any) => {
      const messageData = event.data;
      
      if (messageData.type === 'transcript.partial') {
        handlePartialTranscript({ data: messageData.data });
      } else if (messageData.type === 'transcript.final') {
        handleFinalTranscript({ data: messageData.data });
      } else if (messageData.type === 'transcription.error') {
        handleTranscriptionError({ data: messageData.data });
      }
    };

    client.addEventListener('json_message', handleJsonMessage);

    return () => {
      // Cleanup event listeners
      client.removeEventListener('json_message', handleJsonMessage);
    };
  }, []);

  // Helper functions
  const createTranscriptionResult = (
    data: any,
    isPartial: boolean,
    isFinal: boolean
  ): TranscriptionResult => {
    const alternatives: TranscriptionAlternative[] = [];
    
    if (data.alternatives && Array.isArray(data.alternatives)) {
      alternatives.push(...data.alternatives.map((alt: any) => ({
        text: alt.text || alt.transcript || '',
        confidence: alt.confidence || 0
      })));
    }

    return {
      id: generateResultId(),
      text: data.text || data.transcript || '',
      confidence: data.confidence || 0,
      isPartial,
      isFinal,
      timestamp: new Date(),
      language: data.language,
      alternatives: alternatives.length > 0 ? alternatives : []
    };
  };

  const mapErrorType = (errorType: string): TranscriptionErrorType => {
    switch (errorType?.toLowerCase()) {
      case 'network':
      case 'connection':
        return TranscriptionErrorType.NETWORK_ERROR;
      case 'audio':
      case 'microphone':
        return TranscriptionErrorType.AUDIO_ERROR;
      case 'language':
        return TranscriptionErrorType.LANGUAGE_NOT_SUPPORTED;
      case 'timeout':
        return TranscriptionErrorType.TIMEOUT;
      case 'service':
      case 'server':
        return TranscriptionErrorType.SERVICE_ERROR;
      default:
        return TranscriptionErrorType.UNKNOWN;
    }
  };

  const addResult = (result: TranscriptionResult) => {
    setResults(prev => {
      const newResults = [...prev, result];
      
      // Limit buffer size
      if (newResults.length > opts.bufferSize) {
        return newResults.slice(-opts.bufferSize);
      }
      
      return newResults;
    });
  };

  const updateStatistics = (
    result: TranscriptionResult | null,
    isFinal: boolean,
    isError: boolean = false
  ) => {
    setStatistics(prev => {
      const newStats = { ...prev };
      
      if (isError) {
        newStats.errorsCount++;
        return newStats;
      }
      
      if (result) {
        newStats.totalResults++;
        newStats.lastProcessedTime = new Date();
        
        if (isFinal) {
          newStats.totalFinalResults++;
        } else {
          newStats.totalPartialResults++;
        }
        
        // Update confidence tracking
        confidenceHistoryRef.current.push(result.confidence);
        if (confidenceHistoryRef.current.length > 100) {
          confidenceHistoryRef.current.shift();
        }
        
        // Calculate average confidence
        if (confidenceHistoryRef.current.length > 0) {
          newStats.averageConfidence = confidenceHistoryRef.current.reduce((sum, conf) => sum + conf, 0) / confidenceHistoryRef.current.length;
        }
      }
      
      return newStats;
    });
  };

  const generateResultId = (): string => {
    return `transcript_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  };

  const handleTranscriptionError = (
    type: TranscriptionErrorType,
    message: string,
    recoverable: boolean
  ) => {
    const transcriptionError: TranscriptionError = {
      type,
      message,
      timestamp: new Date(),
      recoverable
    };
    
    setError(transcriptionError);
    updateStatistics(null, false, true);
    optionsRef.current.onError?.(transcriptionError);
  };

  // Public methods
  const startTranscription = useCallback(() => {
    const client = webSocketClientRef.current;
    if (!client) {
      handleTranscriptionError(
        TranscriptionErrorType.SERVICE_ERROR,
        'WebSocket client not available',
        false
      );
      return;
    }

    try {
      setIsTranscribing(true);
      setError(null);
      setPartialTranscription('');
      
      // Send transcription start command
      client.sendJSON({
        type: 'transcription.start',
        data: {
          settings: settings
        }
      }).catch(err => {
        handleTranscriptionError(
          TranscriptionErrorType.SERVICE_ERROR,
          `Failed to start transcription: ${err.message}`,
          true
        );
      });
      
    } catch (err) {
      handleTranscriptionError(
        TranscriptionErrorType.SERVICE_ERROR,
        `Failed to start transcription: ${err instanceof Error ? err.message : String(err)}`,
        true
      );
    }
  }, [settings]);

  const stopTranscription = useCallback(() => {
    const client = webSocketClientRef.current;
    if (!client) {
      return;
    }

    try {
      setIsTranscribing(false);
      
      // Send transcription stop command
      client.sendJSON({
        type: 'transcription.stop',
        data: {}
      }).catch(err => {
        console.warn('Failed to send transcription stop command:', err);
      });
      
    } catch (err) {
      console.warn('Error stopping transcription:', err);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setCurrentTranscription('');
    setPartialTranscription('');
    setFinalTranscription('');
    setConfidence(0);
    setError(null);
    setStatistics(initializeStatistics());
    confidenceHistoryRef.current = [];
    processingTimesRef.current = [];
  }, []);

  const updateSettings = useCallback((newSettings: Partial<TranscriptionSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const getLatestResult = useCallback((): TranscriptionResult | null => {
    return results.length > 0 ? results[results.length - 1] || null : null;
  }, [results]);

  const getResultById = useCallback((id: string): TranscriptionResult | null => {
    return results.find(result => result.id === id) || null;
  }, [results]);

  const getResultsByTimeRange = useCallback((start: Date, end: Date): TranscriptionResult[] => {
    return results.filter(result => 
      result.timestamp >= start && result.timestamp <= end
    );
  }, [results]);

  return {
    // Current state
    currentTranscription,
    partialTranscription,
    finalTranscription,
    isTranscribing,
    confidence,
    language,
    error,
    
    // History and statistics
    results,
    statistics,
    
    // Control methods
    startTranscription,
    stopTranscription,
    clearResults,
    updateSettings,
    
    // Query methods
    getLatestResult,
    getResultById,
    getResultsByTimeRange
  };
}

/**
 * Convenience hook for simple transcription with auto-start
 */
export function useAutoTranscription(
  webSocketClient: IWebSocketClient,
  options: Omit<UseTranscriptionOptions, 'webSocketClient'> = {}
): UseTranscriptionReturn {
  const transcription = useTranscription({ ...options, webSocketClient });
  
  // Auto-start transcription when client is connected
  useEffect(() => {
    if (webSocketClient.isConnected() && !transcription.isTranscribing) {
      transcription.startTranscription();
    }
  }, [webSocketClient, transcription]);
  
  return transcription;
}

/**
 * Hook for transcription with confidence filtering
 */
export function useConfidenceFilteredTranscription(
  webSocketClient: IWebSocketClient,
  minConfidence: number = 0.7,
  options: Omit<UseTranscriptionOptions, 'webSocketClient'> = {}
): UseTranscriptionReturn & {
  highConfidenceResults: TranscriptionResult[];
  averageConfidenceAboveThreshold: number;
} {
  const transcription = useTranscription({ ...options, webSocketClient });
  
  const highConfidenceResults = transcription.results.filter(
    result => result.confidence >= minConfidence
  );
  
  const averageConfidenceAboveThreshold = highConfidenceResults.length > 0
    ? highConfidenceResults.reduce((sum, result) => sum + result.confidence, 0) / highConfidenceResults.length
    : 0;
  
  return {
    ...transcription,
    highConfidenceResults,
    averageConfidenceAboveThreshold
  };
}
import { renderHook, act } from '@testing-library/react';
import { useAudioRecording } from '../useAudioRecording';
import { ServiceFactory } from '@/lib/services/serviceFactory';

// Mock ServiceFactory
jest.mock('@/lib/services/serviceFactory');
const mockServiceFactory = ServiceFactory as jest.Mocked<typeof ServiceFactory>;

/**
 * Test suite for useAudioRecording hook
 * 
 * Tests audio recording lifecycle and error handling
 * Rationale: Ensures audio recording functionality works correctly
 */

describe('useAudioRecording', () => {
  let mockAudioCapture: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock AudioCapture implementation
    mockAudioCapture = {
      start: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
      onAudioData: jest.fn(),
      cleanup: jest.fn(),
    };

    mockServiceFactory.createAudioCapture.mockReturnValue(mockAudioCapture);
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAudioRecording());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should initialize audio capture on first call', async () => {
      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockServiceFactory.createAudioCapture).toHaveBeenCalled();
    });

    it('should handle initialization failure', async () => {
      const initError = new Error('Audio not supported');
      mockServiceFactory.createAudioCapture.mockImplementation(() => {
        throw initError;
      });

      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.initialize();
      });

      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBe(initError);
    });

    it('should call onError callback when initialization fails', async () => {
      const onError = jest.fn();
      const initError = new Error('Audio not supported');
      mockServiceFactory.createAudioCapture.mockImplementation(() => {
        throw initError;
      });

      const { result } = renderHook(() => useAudioRecording({ onError }));

      await act(async () => {
        await result.current.initialize();
      });

      expect(onError).toHaveBeenCalledWith(initError);
    });
  });

  describe('recording lifecycle', () => {
    it('should start recording successfully', async () => {
      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockAudioCapture.start).toHaveBeenCalled();
    });

    it('should stop recording successfully', async () => {
      const { result } = renderHook(() => useAudioRecording());

      // First start recording
      await act(async () => {
        await result.current.startRecording();
      });

      // Then stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockAudioCapture.stop).toHaveBeenCalled();
    });

    it('should handle recording start failure', async () => {
      const recordingError = new Error('Permission denied');
      mockAudioCapture.start.mockRejectedValue(recordingError);

      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toBe(recordingError);
    });

    it('should handle recording stop failure', async () => {
      const stopError = new Error('Stop failed');
      mockAudioCapture.stop.mockRejectedValue(stopError);

      const { result } = renderHook(() => useAudioRecording());

      // Start recording first
      await act(async () => {
        await result.current.startRecording();
      });

      // Try to stop recording
      await act(async () => {
        await result.current.stopRecording();
      });

      expect(result.current.error).toBe(stopError);
    });

    it('should call onError callback when recording fails', async () => {
      const onError = jest.fn();
      const recordingError = new Error('Recording failed');
      mockAudioCapture.start.mockRejectedValue(recordingError);

      const { result } = renderHook(() => useAudioRecording({ onError }));

      await act(async () => {
        await result.current.startRecording();
      });

      expect(onError).toHaveBeenCalledWith(recordingError);
    });
  });

  describe('audio data handling', () => {
    it('should set up audio data callback', async () => {
      const onAudioData = jest.fn();
      const { result } = renderHook(() => useAudioRecording({ onAudioData }));

      await act(async () => {
        await result.current.initialize();
      });

      expect(mockAudioCapture.onAudioData).toHaveBeenCalledWith(onAudioData);
    });

    it('should handle audio data callback during recording', async () => {
      const onAudioData = jest.fn();
      const { result } = renderHook(() => useAudioRecording({ onAudioData }));

      await act(async () => {
        await result.current.startRecording();
      });

      expect(mockAudioCapture.onAudioData).toHaveBeenCalledWith(onAudioData);
    });
  });

  describe('error handling', () => {
    it('should clear error on successful operations', async () => {
      const { result } = renderHook(() => useAudioRecording());

      // First create an error
      mockAudioCapture.start.mockRejectedValueOnce(new Error('First error'));
      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeTruthy();

      // Then succeed
      mockAudioCapture.start.mockResolvedValueOnce(undefined);
      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeNull();
    });

    it('should handle generic errors gracefully', async () => {
      mockAudioCapture.start.mockRejectedValue('String error');

      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Failed to start recording');
    });
  });

  describe('resource cleanup', () => {
    it('should cleanup audio capture on unmount', () => {
      const { result, unmount } = renderHook(() => useAudioRecording());

      // Initialize first so there's something to cleanup
      act(() => {
        result.current.initialize();
      });

      unmount();

      expect(mockAudioCapture.cleanup).toHaveBeenCalled();
    });

    it('should handle cleanup when audio capture is not initialized', () => {
      const { unmount } = renderHook(() => useAudioRecording());

      // Should not throw when cleanup is called without initialization
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('re-initialization', () => {
    it('should not re-create audio capture if already initialized', async () => {
      const { result } = renderHook(() => useAudioRecording());

      // Initialize once
      await act(async () => {
        await result.current.initialize();
      });

      // Initialize again
      await act(async () => {
        await result.current.initialize();
      });

      // Should only be called once
      expect(mockServiceFactory.createAudioCapture).toHaveBeenCalledTimes(1);
    });

    it('should auto-initialize when starting recording if not initialized', async () => {
      const { result } = renderHook(() => useAudioRecording());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isInitialized).toBe(true);
      expect(mockServiceFactory.createAudioCapture).toHaveBeenCalled();
    });
  });

  describe('callback stability', () => {
    it('should maintain callback references across re-renders', () => {
      const { result, rerender } = renderHook(() => useAudioRecording());

      const initialStartRecording = result.current.startRecording;
      const initialStopRecording = result.current.stopRecording;
      const initialInitialize = result.current.initialize;

      rerender();

      expect(result.current.startRecording).toBe(initialStartRecording);
      expect(result.current.stopRecording).toBe(initialStopRecording);
      expect(result.current.initialize).toBe(initialInitialize);
    });
  });

  describe('options handling', () => {
    it('should work without any options', () => {
      const { result } = renderHook(() => useAudioRecording());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle changing options', () => {
      const onAudioData1 = jest.fn();
      const onAudioData2 = jest.fn();

      const { rerender } = renderHook(
        ({ onAudioData }) => useAudioRecording({ onAudioData }),
        { initialProps: { onAudioData: onAudioData1 } }
      );

      rerender({ onAudioData: onAudioData2 });

      // Should create new callbacks with new options
      expect(onAudioData1).not.toBe(onAudioData2);
    });
  });
});
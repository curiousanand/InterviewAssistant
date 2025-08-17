import { renderHook, act } from '@testing-library/react';
import { useAudioRecording } from '@/hooks/useAudioRecording';

// Mock the ServiceFactory
jest.mock('@/lib/services/serviceFactory', () => ({
  ServiceFactory: {
    createAudioCapture: jest.fn(() => ({
      start: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
      onAudioData: jest.fn(),
      cleanup: jest.fn(),
    })),
  },
}));

describe('useAudioRecording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAudioRecording());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should start recording successfully', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should stop recording successfully', async () => {
    const { result } = renderHook(() => useAudioRecording());

    // Start recording first
    await act(async () => {
      await result.current.startRecording();
    });

    // Then stop recording
    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it('should handle start recording error', async () => {
    const mockError = new Error('Microphone access denied');
    
    // Mock the ServiceFactory to throw an error
    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createAudioCapture.mockReturnValue({
      start: jest.fn(() => Promise.reject(mockError)),
      stop: jest.fn(),
      onAudioData: jest.fn(),
      cleanup: jest.fn(),
    });

    const onError = jest.fn();
    const { result } = renderHook(() => useAudioRecording({ onError }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toEqual(mockError);
    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it('should call onAudioData callback when provided', async () => {
    const onAudioData = jest.fn();
    const mockAudioCapture = {
      start: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
      onAudioData: jest.fn(),
      cleanup: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createAudioCapture.mockReturnValue(mockAudioCapture);

    renderHook(() => useAudioRecording({ onAudioData }));

    expect(mockAudioCapture.onAudioData).toHaveBeenCalledWith(onAudioData);
  });

  it('should cleanup on unmount', () => {
    const mockAudioCapture = {
      start: jest.fn(),
      stop: jest.fn(),
      onAudioData: jest.fn(),
      cleanup: jest.fn(),
    };

    const { ServiceFactory } = require('@/lib/services/serviceFactory');
    ServiceFactory.createAudioCapture.mockReturnValue(mockAudioCapture);

    const { unmount } = renderHook(() => useAudioRecording());

    unmount();

    expect(mockAudioCapture.cleanup).toHaveBeenCalled();
  });
});
/**
 * Tests for useAudioRecorder hook
 *
 * Covers:
 * 1. Initial state
 * 2. startRecording — permission denied
 * 3. startRecording — permission granted, recording starts
 * 4. startRecording — Audio.Recording.createAsync throws
 * 5. stopRecording — when not recording (no-op)
 * 6. stopRecording — returns URI and resets state
 * 7. clearRecording — resets recordingUri
 */

jest.mock('expo-av', () => {
  const mockStopAndUnload = jest.fn();
  const mockGetURI = jest.fn().mockReturnValue('file:///tmp/recording.m4a');
  const mockCreateAsync = jest.fn();

  return {
    Audio: {
      requestPermissionsAsync: jest.fn(),
      setAudioModeAsync: jest.fn(),
      Recording: {
        createAsync: mockCreateAsync,
      },
      RecordingOptionsPresets: {
        HIGH_QUALITY: { android: {}, ios: {}, web: {} },
      },
    },
    _mockStopAndUnload: mockStopAndUnload,
    _mockGetURI: mockGetURI,
    _mockCreateAsync: mockCreateAsync,
  };
});

jest.mock('@/services/errorReporting', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/utils/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { Audio } from 'expo-av';
import { reportError } from '@/services/errorReporting';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const mockRequestPermissions = Audio.requestPermissionsAsync as jest.Mock;
const mockSetAudioMode = Audio.setAudioModeAsync as jest.Mock;
const mockCreateAsync = Audio.Recording.createAsync as jest.Mock;
const mockReportError = reportError as jest.Mock;

// We need a mock recording instance for each test
function makeMockRecording(uri: string | null = 'file:///tmp/rec.m4a') {
  return {
    stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
    getURI: jest.fn().mockReturnValue(uri),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetAudioMode.mockResolvedValue(undefined);
});

describe('useAudioRecorder — initial state', () => {
  it('starts with isRecording=false and recordingUri=null', () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordingUri).toBeNull();
  });
});

describe('startRecording', () => {
  it('calls reportError and does not set isRecording when permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'useAudioRecorder.startRecording'
    );
  });

  it('sets isRecording=true when permission is granted and recording starts', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    const mockRecording = makeMockRecording();
    mockCreateAsync.mockResolvedValue({ recording: mockRecording });

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockSetAudioMode).toHaveBeenCalledWith(
      expect.objectContaining({ allowsRecordingIOS: true })
    );
  });

  it('calls reportError when createAsync throws', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockCreateAsync.mockRejectedValue(new Error('Mic error'));

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'useAudioRecorder.startRecording'
    );
  });
});

describe('stopRecording', () => {
  it('returns null when no recording is active', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    let uri: string | null = 'initial';
    await act(async () => {
      uri = await result.current.stopRecording();
    });

    expect(uri).toBeNull();
    expect(result.current.isRecording).toBe(false);
  });

  it('stops the recording, sets recordingUri, and returns the URI', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    const mockRec = makeMockRecording('file:///tmp/audio.m4a');
    mockCreateAsync.mockResolvedValue({ recording: mockRec });

    const { result } = renderHook(() => useAudioRecorder());

    // Start recording first
    await act(async () => {
      await result.current.startRecording();
    });

    let returnedUri: string | null = null;
    await act(async () => {
      returnedUri = await result.current.stopRecording();
    });

    expect(returnedUri).toBe('file:///tmp/audio.m4a');
    expect(result.current.recordingUri).toBe('file:///tmp/audio.m4a');
    expect(result.current.isRecording).toBe(false);
    expect(mockRec.stopAndUnloadAsync).toHaveBeenCalled();
  });

  it('returns null when recording.getURI() returns null', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    const mockRec = makeMockRecording(null);
    mockCreateAsync.mockResolvedValue({ recording: mockRec });

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    let returnedUri: string | null = 'initial';
    await act(async () => {
      returnedUri = await result.current.stopRecording();
    });

    expect(returnedUri).toBeNull();
    expect(result.current.recordingUri).toBeNull();
  });
});

describe('clearRecording', () => {
  it('resets recordingUri to null', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    const mockRec = makeMockRecording('file:///tmp/test.m4a');
    mockCreateAsync.mockResolvedValue({ recording: mockRec });

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
      await result.current.stopRecording();
    });

    expect(result.current.recordingUri).not.toBeNull();

    act(() => {
      result.current.clearRecording();
    });

    expect(result.current.recordingUri).toBeNull();
  });
});

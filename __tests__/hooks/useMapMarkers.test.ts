/**
 * Tests for useMapMarkers hook
 *
 * Covers:
 * 1. canReadMessage — within/outside 100m radius, null location cases
 * 2. formatDistance — meters and km formatting, null cases
 * 3. clearAvatarImages — removes specific IDs from avatarImages
 * 4. captureAvatar — skips when already captured, skips when ref missing
 */

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));

jest.mock('@/utils/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { captureRef } from 'react-native-view-shot';
import { useMapMarkers } from '@/hooks/useMapMarkers';
import { UndiscoveredMessageMapMeta, Coordinates } from '@/types';

const mockCaptureRef = captureRef as jest.Mock;

const PARIS: Coordinates = { latitude: 48.8566, longitude: 2.3522 };
// ~50m north
const NEAR: Coordinates = { latitude: 48.85705, longitude: 2.3522 };
// ~200m north
const FAR: Coordinates = { latitude: 48.8584, longitude: 2.3522 };
// ~2km north
const VERY_FAR: Coordinates = { latitude: 48.875, longitude: 2.3522 };

const EMPTY_MESSAGES: UndiscoveredMessageMapMeta[] = [];

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── canReadMessage ───────────────────────────────────────────────────────────

describe('canReadMessage', () => {
  it('returns false when userLocation is null', () => {
    const { result } = renderHook(() => useMapMarkers(null, EMPTY_MESSAGES));
    expect(result.current.canReadMessage(PARIS)).toBe(false);
  });

  it('returns false when messageLocation is null', () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));
    expect(result.current.canReadMessage(null)).toBe(false);
  });

  it('returns true when user is within 100m of the message', () => {
    const { result } = renderHook(() => useMapMarkers(NEAR, EMPTY_MESSAGES));
    expect(result.current.canReadMessage(PARIS)).toBe(true);
  });

  it('returns false when user is farther than 100m from the message', () => {
    const { result } = renderHook(() => useMapMarkers(FAR, EMPTY_MESSAGES));
    expect(result.current.canReadMessage(PARIS)).toBe(false);
  });

  it('returns true when user is at the exact message location', () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));
    expect(result.current.canReadMessage(PARIS)).toBe(true);
  });
});

// ─── formatDistance ───────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('returns null when userLocation is null', () => {
    const { result } = renderHook(() => useMapMarkers(null, EMPTY_MESSAGES));
    expect(result.current.formatDistance(PARIS)).toBeNull();
  });

  it('returns null when messageLocation is null', () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));
    expect(result.current.formatDistance(null)).toBeNull();
  });

  it('returns meters when distance < 1000m', () => {
    const { result } = renderHook(() => useMapMarkers(NEAR, EMPTY_MESSAGES));
    const dist = result.current.formatDistance(PARIS);
    expect(dist).toMatch(/^\d+m$/);
    // ~50m
    const value = parseInt(dist!);
    expect(value).toBeGreaterThan(30);
    expect(value).toBeLessThan(100);
  });

  it('returns km with one decimal when distance >= 1000m', () => {
    const { result } = renderHook(() => useMapMarkers(VERY_FAR, EMPTY_MESSAGES));
    const dist = result.current.formatDistance(PARIS);
    expect(dist).toMatch(/^\d+\.\d+km$/);
  });

  it('returns "0m" for same location', () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));
    const dist = result.current.formatDistance(PARIS);
    expect(dist).toBe('0m');
  });
});

// ─── clearAvatarImages ────────────────────────────────────────────────────────

describe('clearAvatarImages', () => {
  it('removes the specified IDs from avatarImages', async () => {
    mockCaptureRef.mockResolvedValue('file:///tmp/avatar.png');

    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    // Set a ref manually and capture it
    result.current.avatarRefs.current['msg-1'] = {} as any;
    result.current.avatarRefs.current['msg-2'] = {} as any;

    await act(async () => {
      await result.current.captureAvatar('msg-1');
      await result.current.captureAvatar('msg-2');
    });

    expect(result.current.avatarImages['msg-1']).toBe('file:///tmp/avatar.png');
    expect(result.current.avatarImages['msg-2']).toBe('file:///tmp/avatar.png');

    act(() => {
      result.current.clearAvatarImages(['msg-1']);
    });

    expect(result.current.avatarImages['msg-1']).toBeUndefined();
    expect(result.current.avatarImages['msg-2']).toBe('file:///tmp/avatar.png');
  });

  it('is a no-op when the provided IDs are not in avatarImages', () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    act(() => {
      result.current.clearAvatarImages(['non-existent']);
    });

    expect(result.current.avatarImages).toEqual({});
  });
});

// ─── captureAvatar ────────────────────────────────────────────────────────────

describe('captureAvatar', () => {
  it('does nothing when the ref is not set', async () => {
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    await act(async () => {
      await result.current.captureAvatar('msg-1');
    });

    expect(mockCaptureRef).not.toHaveBeenCalled();
    expect(result.current.avatarImages['msg-1']).toBeUndefined();
  });

  it('captures and stores the avatar URI', async () => {
    mockCaptureRef.mockResolvedValue('file:///tmp/capture.png');
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    result.current.avatarRefs.current['msg-1'] = {} as any;

    await act(async () => {
      await result.current.captureAvatar('msg-1');
    });

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
    expect(result.current.avatarImages['msg-1']).toBe('file:///tmp/capture.png');
  });

  it('does not capture again if image is already stored', async () => {
    mockCaptureRef.mockResolvedValue('file:///tmp/capture.png');
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    result.current.avatarRefs.current['msg-1'] = {} as any;

    await act(async () => {
      await result.current.captureAvatar('msg-1');
      await result.current.captureAvatar('msg-1'); // second call
    });

    expect(mockCaptureRef).toHaveBeenCalledTimes(1);
  });

  it('handles captureRef errors gracefully', async () => {
    mockCaptureRef.mockRejectedValue(new Error('Capture failed'));
    const { result } = renderHook(() => useMapMarkers(PARIS, EMPTY_MESSAGES));

    result.current.avatarRefs.current['msg-1'] = {} as any;

    await act(async () => {
      await result.current.captureAvatar('msg-1');
    });

    expect(result.current.avatarImages['msg-1']).toBeUndefined();
  });
});

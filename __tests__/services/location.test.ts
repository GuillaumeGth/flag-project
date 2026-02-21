import {
  calculateDistance,
  isWithinRadius,
  requestForegroundPermission,
  requestBackgroundPermission,
  getCurrentLocation,
  startBackgroundLocationTracking,
  stopBackgroundLocationTracking,
  watchForegroundLocation,
} from '@/services/location';
import * as Location from 'expo-location';
import { reportError } from '@/services/errorReporting';

jest.mock('@/services/errorReporting', () => ({
  reportError: jest.fn(),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    const point = { latitude: 48.8566, longitude: 2.3522 };
    expect(calculateDistance(point, point)).toBeCloseTo(0);
  });

  it('calculates distance between Paris and Lyon (~391 km)', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const lyon = { latitude: 45.7640, longitude: 4.8357 };
    const distance = calculateDistance(paris, lyon);
    // ~391 000 meters
    expect(distance).toBeGreaterThan(390_000);
    expect(distance).toBeLessThan(393_000);
  });

  it('calculates distance between two nearby points (~111 m per 0.001 degree lat)', () => {
    const p1 = { latitude: 48.8566, longitude: 2.3522 };
    const p2 = { latitude: 48.8575, longitude: 2.3522 }; // ~100m north
    const distance = calculateDistance(p1, p2);
    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it('handles points across the equator', () => {
    const north = { latitude: 1.0, longitude: 0.0 };
    const south = { latitude: -1.0, longitude: 0.0 };
    const distance = calculateDistance(north, south);
    expect(distance).toBeGreaterThan(220_000);
    expect(distance).toBeLessThan(225_000);
  });

  it('is symmetric (A->B same as B->A)', () => {
    const a = { latitude: 48.8566, longitude: 2.3522 };
    const b = { latitude: 43.2965, longitude: 5.3698 };
    expect(calculateDistance(a, b)).toBeCloseTo(calculateDistance(b, a), 0);
  });

  it('handles longitude differences (east-west)', () => {
    const p1 = { latitude: 0.0, longitude: 0.0 };
    const p2 = { latitude: 0.0, longitude: 1.0 };
    const distance = calculateDistance(p1, p2);
    // ~111 km per degree at equator
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });
});

describe('isWithinRadius', () => {
  const center = { latitude: 48.8566, longitude: 2.3522 };

  it('returns true when user is at the exact target location', () => {
    expect(isWithinRadius(center, center)).toBe(true);
  });

  it('returns true when user is within default 100m radius', () => {
    // ~50m north
    const nearby = { latitude: 48.85705, longitude: 2.3522 };
    expect(isWithinRadius(nearby, center)).toBe(true);
  });

  it('returns false when user is outside default 100m radius', () => {
    // ~200m north
    const farAway = { latitude: 48.8584, longitude: 2.3522 };
    expect(isWithinRadius(farAway, center)).toBe(false);
  });

  it('uses custom radius when provided', () => {
    // ~200m north
    const point = { latitude: 48.8584, longitude: 2.3522 };
    expect(isWithinRadius(point, center, 300)).toBe(true);
    expect(isWithinRadius(point, center, 50)).toBe(false);
  });

  it('returns true at exactly the radius boundary', () => {
    // Point exactly 100m north
    const onBoundary = { latitude: 48.85750, longitude: 2.3522 }; // ~100m
    const dist = calculateDistance(onBoundary, center);
    // isWithinRadius uses <=, so on boundary should be true
    expect(isWithinRadius(onBoundary, center, dist)).toBe(true);
  });

  it('uses 300m radius for background proximity notifications', () => {
    // ~200m north — within notification range but not read range
    const point = { latitude: 48.8584, longitude: 2.3522 };
    expect(isWithinRadius(point, center, 100)).toBe(false);
    expect(isWithinRadius(point, center, 300)).toBe(true);
  });
});

describe('requestForegroundPermission', () => {
  it('returns true when permission is granted', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    const result = await requestForegroundPermission();
    expect(result).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied' as any,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const result = await requestForegroundPermission();
    expect(result).toBe(false);
  });
});

describe('requestBackgroundPermission', () => {
  it('returns true when permission is granted', async () => {
    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    const result = await requestBackgroundPermission();
    expect(result).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'denied' as any,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const result = await requestBackgroundPermission();
    expect(result).toBe(false);
  });
});

describe('getCurrentLocation', () => {
  it('returns coordinates on success', async () => {
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 48.8566, longitude: 2.3522 },
    } as any);
    const result = await getCurrentLocation();
    expect(result).toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('returns null on error', async () => {
    mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('GPS unavailable'));
    const result = await getCurrentLocation();
    expect(result).toBeNull();
  });
});

describe('startBackgroundLocationTracking', () => {
  it('returns false when background permission is denied', async () => {
    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'denied' as any,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });
    const result = await startBackgroundLocationTracking();
    expect(result).toBe(false);
    expect(mockLocation.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('returns true when tracking starts successfully', async () => {
    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    mockLocation.startLocationUpdatesAsync.mockResolvedValue(undefined);
    const result = await startBackgroundLocationTracking();
    expect(result).toBe(true);
  });

  it('returns false when startLocationUpdatesAsync throws', async () => {
    mockLocation.requestBackgroundPermissionsAsync.mockResolvedValue({
      status: 'granted' as any,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    mockLocation.startLocationUpdatesAsync.mockRejectedValue(new Error('Task error'));
    const result = await startBackgroundLocationTracking();
    expect(result).toBe(false);
  });
});

describe('stopBackgroundLocationTracking', () => {
  it('does not call stop if tracking is not active', async () => {
    mockLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
    await stopBackgroundLocationTracking();
    expect(mockLocation.stopLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('stops tracking when it is active', async () => {
    mockLocation.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    mockLocation.stopLocationUpdatesAsync.mockResolvedValue(undefined);
    await stopBackgroundLocationTracking();
    expect(mockLocation.stopLocationUpdatesAsync).toHaveBeenCalled();
  });
});

describe('watchForegroundLocation', () => {
  it('calls onLocationUpdate with coordinates', async () => {
    const mockSubscription = { remove: jest.fn() };
    const onLocationUpdate = jest.fn();

    mockLocation.watchPositionAsync.mockImplementation(async (_opts, callback) => {
      callback({ coords: { latitude: 48.8566, longitude: 2.3522 } } as any);
      return mockSubscription as any;
    });

    const sub = await watchForegroundLocation(onLocationUpdate);
    expect(onLocationUpdate).toHaveBeenCalledWith({ latitude: 48.8566, longitude: 2.3522 });
    expect(sub).toBe(mockSubscription);
  });

  it('returns null on error', async () => {
    mockLocation.watchPositionAsync.mockRejectedValue(new Error('Watch error'));
    const result = await watchForegroundLocation(jest.fn());
    expect(result).toBeNull();
  });
});

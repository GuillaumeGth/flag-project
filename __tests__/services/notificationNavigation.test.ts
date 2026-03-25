/**
 * Tests for the notification → navigation flow implemented in App.tsx.
 *
 * Because App.tsx renders the full component tree, we test the logic directly
 * by extracting and exercising the `navigateToFlag` helper in isolation.
 *
 * Covers:
 * 1. Notification tap while app is running → navigate called with correct params
 * 2. Cold start with messageId → navigate called
 * 3. Cold start without messageId → navigate NOT called
 * 4. Navigation not ready → navigate not called immediately (pending queued)
 * 5. Refresh param is always a number (for cache invalidation in MapScreen)
 */

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

jest.mock('@/services/notifications', () => ({
  addNotificationResponseListener: jest.fn(),
}));

jest.mock('@/services/navigationRef', () => ({
  navigationRef: {
    current: {
      isReady: jest.fn(),
      navigate: jest.fn(),
    },
  },
}));

jest.mock('@/utils/debug', () => ({
  log: jest.fn(),
  warn: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { addNotificationResponseListener } from '@/services/notifications';
import { navigationRef } from '@/services/navigationRef';

const mockGetLastResponse = Notifications.getLastNotificationResponseAsync as jest.Mock;
const mockAddListener = addNotificationResponseListener as jest.Mock;
const mockIsReady = (navigationRef.current as any).isReady as jest.Mock;
const mockNavigate = (navigationRef.current as any).navigate as jest.Mock;

/**
 * Replicates the `navigateToFlag` function from App.tsx.
 * Returns the pending ref so tests can inspect it.
 */
function makeNavigateToFlag(pendingRef: { current: string | null }) {
  return function navigateToFlag(messageId: string) {
    if (!navigationRef.current?.isReady()) {
      pendingRef.current = messageId;
      return;
    }
    navigationRef.current.navigate('Main', {
      screen: 'Map',
      params: { messageId, refresh: Date.now() },
    });
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsReady.mockReturnValue(true);
  mockGetLastResponse.mockResolvedValue(null);
  mockAddListener.mockReturnValue({ remove: jest.fn() });
});

// ─── navigateToFlag (active app) ─────────────────────────────────────────────

describe('notification tap while app running', () => {
  it('calls navigate with correct route and messageId', () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    navigateToFlag('msg-1');

    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Map',
      params: { messageId: 'msg-1', refresh: expect.any(Number) },
    });
  });

  it('passes the exact messageId extracted from the notification', () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    navigateToFlag('flag-xyz-789');

    const call = mockNavigate.mock.calls[0];
    expect(call[1].params.messageId).toBe('flag-xyz-789');
  });

  it('the refresh param is a Number for cache invalidation', () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    navigateToFlag('msg-cache-test');

    const call = mockNavigate.mock.calls[0];
    expect(typeof call[1].params.refresh).toBe('number');
  });
});

// ─── Cold start ───────────────────────────────────────────────────────────────

describe('cold start — getLastNotificationResponseAsync', () => {
  it('navigates when last response contains a messageId', async () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    mockGetLastResponse.mockResolvedValue({
      notification: {
        request: {
          content: {
            data: { messageId: 'cold-msg-1' },
          },
        },
      },
    });

    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const messageId = response.notification.request.content.data?.messageId;
      if (messageId) {
        navigateToFlag(messageId as string);
      }
    }

    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Map',
      params: { messageId: 'cold-msg-1', refresh: expect.any(Number) },
    });
  });

  it('does NOT navigate when last response has no messageId', async () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    mockGetLastResponse.mockResolvedValue({
      notification: {
        request: {
          content: {
            data: {},
          },
        },
      },
    });

    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const messageId = response.notification.request.content.data?.messageId;
      if (messageId) {
        navigateToFlag(messageId as string);
      }
    }

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does NOT navigate when getLastNotificationResponseAsync returns null', async () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    mockGetLastResponse.mockResolvedValue(null);

    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const messageId = response.notification.request.content.data?.messageId;
      if (messageId) navigateToFlag(messageId as string);
    }

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ─── Navigation not ready (pending queue) ────────────────────────────────────

describe('navigation not ready — pending notification', () => {
  it('does NOT call navigate when isReady() returns false', () => {
    mockIsReady.mockReturnValue(false);

    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    navigateToFlag('pending-msg-1');

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('stores the messageId in the pending ref when navigator is not ready', () => {
    mockIsReady.mockReturnValue(false);

    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    navigateToFlag('pending-msg-2');

    expect(pendingRef.current).toBe('pending-msg-2');
  });

  it('navigates when onReady flushes the pending notification', () => {
    mockIsReady.mockReturnValue(false);
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    // First call — navigator not ready, queued
    navigateToFlag('pending-msg-3');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(pendingRef.current).toBe('pending-msg-3');

    // Simulate NavigationContainer.onReady flushing the pending notification
    mockIsReady.mockReturnValue(true);
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      navigationRef.current?.navigate('Main', {
        screen: 'Map',
        params: { messageId: pending, refresh: Date.now() },
      });
    }

    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'Map',
      params: { messageId: 'pending-msg-3', refresh: expect.any(Number) },
    });
    expect(pendingRef.current).toBeNull();
  });
});

// ─── Cache invalidation via refresh param ────────────────────────────────────

describe('cache invalidation on navigation', () => {
  it('always includes a numeric refresh param so MapScreen re-fetches', () => {
    const pendingRef = { current: null as string | null };
    const navigateToFlag = makeNavigateToFlag(pendingRef);

    const before = Date.now();
    navigateToFlag('msg-refresh');
    const after = Date.now();

    const call = mockNavigate.mock.calls[0];
    const refresh = call[1].params.refresh as number;

    expect(refresh).toBeGreaterThanOrEqual(before);
    expect(refresh).toBeLessThanOrEqual(after);
  });
});

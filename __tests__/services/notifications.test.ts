/**
 * Tests for notifications.ts
 *
 * Covers:
 * 1. requestNotificationPermission — granted/denied, android channel setup
 * 2. notifyNearbyMessage — schedules a local notification
 * 3. getPushToken — returns token data
 * 4. registerPushToken — permission denied, token null, supabase error, success
 * 5. unregisterPushToken — success + error paths
 * 6. addNotificationResponseListener — callback called with messageId
 */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: { eas: { projectId: 'test-project-id' } },
    },
  },
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
}));

jest.mock('@/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@/services/errorReporting', () => ({
  reportError: jest.fn(),
}));

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/services/supabase';
import { reportError } from '@/services/errorReporting';
import {
  requestNotificationPermission,
  notifyNearbyMessage,
  getPushToken,
  registerPushToken,
  unregisterPushToken,
  addNotificationResponseListener,
} from '@/services/notifications';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockFrom = supabase.from as jest.Mock;
const mockReportError = reportError as jest.Mock;

function makeUpsertChain(result: { error: unknown }) {
  const selectMock = jest.fn().mockResolvedValue(result);
  const upsertMock = jest.fn().mockReturnValue({ select: selectMock });
  return { upsert: upsertMock, select: selectMock };
}

function makeDeleteChain(result: { error: unknown }) {
  const eqMock = jest.fn().mockResolvedValue(result);
  const deleteMock = jest.fn().mockReturnValue({ eq: eqMock });
  return { delete: deleteMock };
}

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'ios';
});

// ─── requestNotificationPermission ───────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('returns true when permission is already granted', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requests permission when not yet granted and returns true on grant', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);

    const result = await requestNotificationPermission();
    expect(result).toBe(true);
    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns false when permission is denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as any);

    const result = await requestNotificationPermission();
    expect(result).toBe(false);
  });

  it('sets up android notification channel when OS is android and permission granted', async () => {
    (Platform as any).OS = 'android';
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.setNotificationChannelAsync.mockResolvedValue(null as any);

    await requestNotificationPermission();
    expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'messages',
      expect.objectContaining({ name: 'Messages' })
    );
  });

  it('does not set up android channel on iOS', async () => {
    (Platform as any).OS = 'ios';
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);

    await requestNotificationPermission();
    expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

// ─── notifyNearbyMessage ──────────────────────────────────────────────────────

describe('notifyNearbyMessage', () => {
  it('schedules an immediate notification with correct content', async () => {
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('notification-id');

    await notifyNearbyMessage('msg-123', 'Alice');

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: expect.objectContaining({
        title: 'Message à proximité !',
        body: 'Alice vous a laissé un message ici',
        data: { messageId: 'msg-123' },
      }),
      trigger: null,
    });
  });

  it('includes the sender name in the notification body', async () => {
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('notif-id');
    await notifyNearbyMessage('msg-456', 'Bob');

    const call = mockNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.body).toContain('Bob');
  });
});

// ─── getPushToken ─────────────────────────────────────────────────────────────

describe('getPushToken', () => {
  it('returns the token data string', async () => {
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[abc123]',
      type: 'expo',
    } as any);

    const token = await getPushToken();
    expect(token).toBe('ExponentPushToken[abc123]');
  });

  it('calls getExpoPushTokenAsync with a projectId string', async () => {
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[xyz]',
      type: 'expo',
    } as any);

    await getPushToken();
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: expect.any(String) })
    );
  });
});

// ─── registerPushToken ────────────────────────────────────────────────────────

describe('registerPushToken', () => {
  it('returns false when permission is denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as any);

    const result = await registerPushToken('user-1');
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns false when getPushToken throws', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('Push token error'));

    const result = await registerPushToken('user-1');
    expect(result).toBe(false);
    expect(mockReportError).toHaveBeenCalled();
  });

  it('returns false when supabase upsert fails', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[abc]',
      type: 'expo',
    } as any);

    const chain = makeUpsertChain({ error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    const result = await registerPushToken('user-1');
    expect(result).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(
      expect.anything(),
      'notifications.registerPushToken'
    );
  });

  it('returns true on success', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({
      data: 'ExponentPushToken[abc]',
      type: 'expo',
    } as any);

    const chain = makeUpsertChain({ error: null });
    mockFrom.mockReturnValue(chain);

    const result = await registerPushToken('user-1');
    expect(result).toBe(true);
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        expo_push_token: 'ExponentPushToken[abc]',
      }),
      expect.anything()
    );
  });
});

// ─── unregisterPushToken ──────────────────────────────────────────────────────

describe('unregisterPushToken', () => {
  it('deletes all tokens for the user on success', async () => {
    const chain = makeDeleteChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await unregisterPushToken('user-1');

    expect(mockFrom).toHaveBeenCalledWith('user_push_tokens');
    expect(chain.delete).toHaveBeenCalled();
  });

  it('calls reportError on supabase delete failure', async () => {
    const chain = makeDeleteChain({ error: { message: 'RLS error' } });
    mockFrom.mockReturnValue(chain);

    await unregisterPushToken('user-1');
    expect(mockReportError).toHaveBeenCalledWith(
      expect.anything(),
      'notifications.unregisterPushToken'
    );
  });

  it('calls reportError when supabase throws', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Network error');
    });

    await unregisterPushToken('user-1');
    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'notifications.unregisterPushToken'
    );
  });
});

// ─── addNotificationResponseListener ─────────────────────────────────────────

describe('addNotificationResponseListener', () => {
  it('calls the callback with the messageId from notification data', () => {
    const callback = jest.fn();
    const mockSubscription = { remove: jest.fn() };

    // Capture the listener registered internally
    let registeredListener: ((response: any) => void) | undefined;
    mockNotifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      registeredListener = fn;
      return mockSubscription as any;
    });

    const sub = addNotificationResponseListener(callback);
    expect(sub).toBe(mockSubscription);

    // Simulate a notification response
    registeredListener!({
      notification: {
        request: {
          content: {
            data: { messageId: 'msg-abc' },
          },
        },
      },
    });

    expect(callback).toHaveBeenCalledWith('msg-abc');
  });

  it('does not call the callback when messageId is missing', () => {
    const callback = jest.fn();
    let registeredListener: ((response: any) => void) | undefined;

    mockNotifications.addNotificationResponseReceivedListener.mockImplementation((fn) => {
      registeredListener = fn;
      return { remove: jest.fn() } as any;
    });

    addNotificationResponseListener(callback);

    registeredListener!({
      notification: {
        request: {
          content: { data: {} },
        },
      },
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

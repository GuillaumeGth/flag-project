/**
 * Tests for backgroundLocation.ts
 *
 * Covers:
 * 1.  Task registration — defineTask is called with the correct name
 * 2.  Task handler — silently returns on TaskManager error
 * 3.  Task handler — silently returns when data is missing
 * 4.  checkNearbyMessages — no-op when user is not authenticated
 * 5.  checkNearbyMessages — no-op when supabase returns an error
 * 6.  checkNearbyMessages — skips messages already persisted in AsyncStorage
 * 7.  checkNearbyMessages — notifies nearby messages and persists their IDs
 * 8.  checkNearbyMessages — does not notify messages outside the proximity radius
 * 9.  checkNearbyMessages — prunes IDs of messages that are no longer unread
 * 10. checkNearbyMessages — handles reportError on unexpected throws
 * 11. checkNearbyPublicFlags — no-op when user is not authenticated
 * 12. checkNearbyPublicFlags — no-op when supabase returns an error
 * 13. checkNearbyPublicFlags — notifies nearby public flags and persists their IDs
 * 14. checkNearbyPublicFlags — does not notify flags outside the proximity radius
 * 15. checkNearbyPublicFlags — deduplication via AsyncStorage
 * 16. checkNearbyPublicFlags — persists across two invocations
 * 17. checkNearbyPublicFlags — handles reportError on unexpected throws
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let capturedTaskHandler: ((params: { data: any; error: any }) => Promise<void>) | undefined;

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn((name: string, handler: any) => {
    capturedTaskHandler = handler;
  }),
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/services/location', () => ({
  calculateDistance: jest.fn(),
}));

jest.mock('@/services/notifications', () => ({
  notifyNearbyMessage: jest.fn(),
  notifyNearbyPublicFlag: jest.fn(),
}));

jest.mock('@/services/errorReporting', () => ({
  reportError: jest.fn(),
}));

import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/services/supabase';
import { calculateDistance } from '@/services/location';
import { notifyNearbyMessage, notifyNearbyPublicFlag } from '@/services/notifications';
import { reportError } from '@/services/errorReporting';

// Import the module so defineTask is called and the handler is captured
import { LOCATION_TASK_NAME } from '@/tasks/backgroundLocation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockCalculateDistance = calculateDistance as jest.Mock;
const mockNotifyNearbyMessage = notifyNearbyMessage as jest.Mock;
const mockNotifyNearbyPublicFlag = notifyNearbyPublicFlag as jest.Mock;
const mockReportError = reportError as jest.Mock;

const STORAGE_KEY = '@flagapp/notified_proximity_messages';
const PUBLIC_FLAGS_STORAGE_KEY = '@flagapp/notified_proximity_public_flags';

const USER_COORDS = { latitude: 48.8566, longitude: 2.3522 };

function makeLocationData(coords = USER_COORDS) {
  return {
    locations: [{ coords }],
  };
}

function makeMessage(id: string, location = 'POINT(2.3522 48.8566)') {
  return {
    id,
    location,
    sender_id: 'sender-1',
    users: { display_name: 'Alice' },
  };
}

function mockSupabaseMessages(messages: any[], error: any = null) {
  const eqIsRead = jest.fn().mockResolvedValue({ data: messages, error });
  const eqRecipient = jest.fn().mockReturnValue({ eq: eqIsRead });
  const selectMock = jest.fn().mockReturnValue({ eq: eqRecipient });
  mockFrom.mockReturnValue({ select: selectMock });
}

function makePublicFlag(id: string, location = 'POINT(2.3522 48.8566)') {
  return {
    id,
    location,
    users: { display_name: 'Bob' },
    subscriptions: [{ follower_id: 'user-1', notify_public_flags: true }],
    discovered_public_messages: [],
  };
}

// checkNearbyPublicFlags chains: .select().eq().eq().eq().eq().is()
function mockSupabasePublicFlags(flags: any[], error: any = null) {
  const terminal = jest.fn().mockResolvedValue({ data: flags, error });
  const chainMock = { eq: jest.fn(), is: terminal };
  chainMock.eq.mockReturnValue(chainMock);
  const selectMock = jest.fn().mockReturnValue(chainMock);
  // checkNearbyPublicFlags calls supabase.from('messages') — second call after checkNearbyMessages
  // We use mockReturnValueOnce for the first call (messages) and once for flags
  mockFrom.mockReturnValueOnce({ select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }) }) })
         .mockReturnValueOnce({ select: selectMock });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

// ─── Task registration ────────────────────────────────────────────────────────

describe('LOCATION_TASK_NAME', () => {
  it('exports the correct task name string', () => {
    expect(LOCATION_TASK_NAME).toBe('background-location-task');
  });

  it('registers a task handler via defineTask on module load', () => {
    // capturedTaskHandler is set by the mock when the module is first loaded
    expect(capturedTaskHandler).toBeDefined();
    expect(typeof capturedTaskHandler).toBe('function');
  });
});

// ─── Task handler — error / missing data ─────────────────────────────────────

describe('task handler', () => {
  it('calls reportError and returns early when TaskManager gives an error', async () => {
    const err = new Error('location error');
    await capturedTaskHandler!({ data: null, error: err });

    expect(mockReportError).toHaveBeenCalledWith(err, 'backgroundLocation.task');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns early without querying supabase when data is null', async () => {
    await capturedTaskHandler!({ data: null, error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns early when locations array is empty', async () => {
    await capturedTaskHandler!({ data: { locations: [] }, error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyMessages — authentication guard ───────────────────────────────

describe('checkNearbyMessages — auth guard', () => {
  it('does nothing when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyMessages — supabase error ─────────────────────────────────────

describe('checkNearbyMessages — supabase error', () => {
  it('does nothing when the messages query returns an error', async () => {
    mockSupabaseMessages([], { message: 'DB error' });

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyMessages — proximity logic ────────────────────────────────────

describe('checkNearbyMessages — proximity', () => {
  it('sends a notification and persists ID when a message is within range', async () => {
    const message = makeMessage('msg-1');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(150); // within 300m
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).toHaveBeenCalledWith('msg-1', 'Alice');

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(stored!)).toContain('msg-1');
  });

  it('does not send a notification when a message is outside the proximity radius', async () => {
    const message = makeMessage('msg-far');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(500); // beyond 300m

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it('uses the sender display_name in the notification', async () => {
    const message = { ...makeMessage('msg-2'), users: { display_name: 'Bob' } };
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).toHaveBeenCalledWith('msg-2', 'Bob');
  });

  it('falls back to "Quelqu\'un" when display_name is missing', async () => {
    const message = { ...makeMessage('msg-3'), users: null };
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).toHaveBeenCalledWith('msg-3', "Quelqu'un");
  });
});

// ─── checkNearbyMessages — AsyncStorage deduplication ────────────────────────

describe('checkNearbyMessages — deduplication', () => {
  it('skips notification for messages already persisted in AsyncStorage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['msg-already']));

    const message = makeMessage('msg-already');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();
  });

  it('notifies only new messages when some are already in AsyncStorage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['msg-old']));

    const messages = [makeMessage('msg-old'), makeMessage('msg-new')];
    mockSupabaseMessages(messages);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyMessage).toHaveBeenCalledTimes(1);
    expect(mockNotifyNearbyMessage).toHaveBeenCalledWith('msg-new', 'Alice');
  });

  it('persists notification across two separate task invocations', async () => {
    const message = makeMessage('msg-persist');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    // First invocation — should notify
    await capturedTaskHandler!({ data: makeLocationData(), error: null });
    expect(mockNotifyNearbyMessage).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);

    // Second invocation — ID is now in AsyncStorage, should NOT notify again
    await capturedTaskHandler!({ data: makeLocationData(), error: null });
    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyMessages — AsyncStorage pruning ───────────────────────────────

describe('checkNearbyMessages — pruning stale IDs', () => {
  it('removes IDs from AsyncStorage when the corresponding message is no longer unread', async () => {
    // Seed storage with a message ID that is no longer in the unread list
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(['msg-read', 'msg-still-unread']));

    // Only msg-still-unread comes back from Supabase (msg-read was read)
    const message = makeMessage('msg-still-unread');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50); // within range but already notified

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const ids = JSON.parse(stored!);
    expect(ids).not.toContain('msg-read');
    expect(ids).toContain('msg-still-unread');
  });
});

// ─── parseLocation ────────────────────────────────────────────────────────────

describe('parseLocation (via checkNearbyMessages)', () => {
  it('parses PostGIS POINT(lng lat) format correctly', async () => {
    const message = makeMessage('msg-postgis', 'POINT(2.3522 48.8566)');
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    // calculateDistance should be called — meaning the location was parsed
    expect(mockCalculateDistance).toHaveBeenCalledWith(
      USER_COORDS,
      { longitude: 2.3522, latitude: 48.8566 }
    );
  });

  it('parses object format {latitude, longitude} correctly', async () => {
    const message = makeMessage('msg-obj', { latitude: 48.8566, longitude: 2.3522 } as any);
    mockSupabaseMessages([message]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyMessage.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockCalculateDistance).toHaveBeenCalledWith(
      USER_COORDS,
      { latitude: 48.8566, longitude: 2.3522 }
    );
  });

  it('skips messages with a null location', async () => {
    const message = makeMessage('msg-no-loc', null as any);
    mockSupabaseMessages([message]);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockCalculateDistance).not.toHaveBeenCalled();
    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();
  });

  it('skips messages with an unparseable location string', async () => {
    const message = makeMessage('msg-bad-loc', 'INVALID_FORMAT');
    mockSupabaseMessages([message]);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockCalculateDistance).not.toHaveBeenCalled();
    expect(mockNotifyNearbyMessage).not.toHaveBeenCalled();
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('checkNearbyMessages — error handling', () => {
  it('calls reportError and does not throw when an unexpected error occurs', async () => {
    mockGetUser.mockRejectedValue(new Error('auth service crash'));

    await expect(
      capturedTaskHandler!({ data: makeLocationData(), error: null })
    ).resolves.not.toThrow();

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'backgroundLocation.checkNearbyMessages'
    );
  });
});

// ─── checkNearbyPublicFlags — auth guard ──────────────────────────────────────

describe('checkNearbyPublicFlags — auth guard', () => {
  it('does nothing when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyPublicFlags — supabase error ──────────────────────────────────

describe('checkNearbyPublicFlags — supabase error', () => {
  it('does nothing when the flags query returns an error', async () => {
    mockSupabasePublicFlags([], { message: 'DB error' });

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyPublicFlags — proximity logic ─────────────────────────────────

describe('checkNearbyPublicFlags — proximity', () => {
  it('sends a notification and persists ID when a public flag is within range', async () => {
    const flag = makePublicFlag('flag-1');
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(200); // within 300m
    mockNotifyNearbyPublicFlag.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledWith('flag-1', 'Bob');

    const stored = await AsyncStorage.getItem(PUBLIC_FLAGS_STORAGE_KEY);
    expect(JSON.parse(stored!)).toContain('flag-1');
  });

  it('does not send a notification when a public flag is outside the proximity radius', async () => {
    const flag = makePublicFlag('flag-far');
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(500); // beyond 300m

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();

    const stored = await AsyncStorage.getItem(PUBLIC_FLAGS_STORAGE_KEY);
    expect(stored).toBeNull();
  });

  it('uses the sender display_name in the notification', async () => {
    const flag = { ...makePublicFlag('flag-2'), users: { display_name: 'Charlie' } };
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyPublicFlag.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledWith('flag-2', 'Charlie');
  });

  it('falls back to "Quelqu\'un" when display_name is missing', async () => {
    const flag = { ...makePublicFlag('flag-3'), users: null };
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyPublicFlag.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledWith('flag-3', "Quelqu'un");
  });

  it('skips flags with a null location', async () => {
    const flag = makePublicFlag('flag-no-loc', null as any);
    mockSupabasePublicFlags([flag]);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockCalculateDistance).not.toHaveBeenCalled();
    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyPublicFlags — deduplication ───────────────────────────────────

describe('checkNearbyPublicFlags — deduplication', () => {
  it('skips notification for flags already persisted in AsyncStorage', async () => {
    await AsyncStorage.setItem(PUBLIC_FLAGS_STORAGE_KEY, JSON.stringify(['flag-already']));

    const flag = makePublicFlag('flag-already');
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(50);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();
  });

  it('notifies only new flags when some are already in AsyncStorage', async () => {
    await AsyncStorage.setItem(PUBLIC_FLAGS_STORAGE_KEY, JSON.stringify(['flag-old']));

    const flags = [makePublicFlag('flag-old'), makePublicFlag('flag-new')];
    mockSupabasePublicFlags(flags);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyPublicFlag.mockResolvedValue(undefined);

    await capturedTaskHandler!({ data: makeLocationData(), error: null });

    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledTimes(1);
    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledWith('flag-new', 'Bob');
  });

  it('persists notification across two separate task invocations', async () => {
    const flag = makePublicFlag('flag-persist');
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(50);
    mockNotifyNearbyPublicFlag.mockResolvedValue(undefined);

    // First invocation — should notify
    await capturedTaskHandler!({ data: makeLocationData(), error: null });
    expect(mockNotifyNearbyPublicFlag).toHaveBeenCalledTimes(1);

    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabasePublicFlags([flag]);
    mockCalculateDistance.mockReturnValue(50);

    // Second invocation — ID is now in AsyncStorage, should NOT notify again
    await capturedTaskHandler!({ data: makeLocationData(), error: null });
    expect(mockNotifyNearbyPublicFlag).not.toHaveBeenCalled();
  });
});

// ─── checkNearbyPublicFlags — error handling ──────────────────────────────────

describe('checkNearbyPublicFlags — error handling', () => {
  it('calls reportError and does not throw when an unexpected error occurs', async () => {
    // Make the second from() call (public flags query) throw
    mockFrom
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: [], error: null }) }) }) })
      .mockImplementationOnce(() => { throw new Error('unexpected crash'); });

    await expect(
      capturedTaskHandler!({ data: makeLocationData(), error: null })
    ).resolves.not.toThrow();

    expect(mockReportError).toHaveBeenCalledWith(
      expect.any(Error),
      'backgroundLocation.checkNearbyPublicFlags'
    );
  });
});

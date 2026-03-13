/**
 * Tests for errorReporting.ts
 *
 * reportError is a no-op in __DEV__ mode.
 * We test the throttle logic and production path by toggling __DEV__.
 */

// We need to reset module state between tests that toggle __DEV__
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

jest.mock('@/services/supabase', () => ({
  supabase: { from: mockFrom },
  getCachedUserId: jest.fn().mockReturnValue('user-123'),
}));

describe('reportError (DEV mode — no-op)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  it('does nothing in development mode', async () => {
    const { reportError } = require('@/services/errorReporting');
    await reportError(new Error('test'), 'test.context');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('reportError (production mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    (global as any).__DEV__ = false;

    // Re-apply mocks after resetModules
    jest.mock('@/services/supabase', () => ({
      supabase: { from: mockFrom },
      getCachedUserId: jest.fn().mockReturnValue('user-123'),
    }));
    jest.mock('expo-constants', () => ({
      default: { expoConfig: { version: '1.0.0' } },
    }));
    jest.mock('react-native/Libraries/Utilities/Platform', () => ({
      OS: 'ios',
    }));
  });

  afterAll(() => {
    (global as any).__DEV__ = true;
  });

  it('inserts error log in production', async () => {
    const { reportError } = require('@/services/errorReporting');
    const err = new Error('Something broke');
    await reportError(err, 'test.production');
    expect(mockFrom).toHaveBeenCalledWith('error_logs');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: 'Something broke',
        error_context: 'test.production',
      })
    );
  });

  it('handles non-Error objects', async () => {
    const { reportError } = require('@/services/errorReporting');
    await reportError('string error', 'test.string');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        error_message: 'string error',
        error_stack: null,
      })
    );
  });

  it('throttles repeated errors from the same context', async () => {
    const { reportError } = require('@/services/errorReporting');
    await reportError(new Error('first'), 'throttled.context');
    await reportError(new Error('second'), 'throttled.context');
    // Second call should be throttled — insert only called once
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('does not throttle errors from different contexts', async () => {
    const { reportError } = require('@/services/errorReporting');
    await reportError(new Error('err'), 'context.A');
    await reportError(new Error('err'), 'context.B');
    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('includes metadata in the insert payload', async () => {
    const { reportError } = require('@/services/errorReporting');
    await reportError(new Error('meta test'), 'test.meta', { userId: 'abc', action: 'sendMessage' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ userId: 'abc', action: 'sendMessage' }),
      })
    );
  });

  it('does not throw when supabase insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('DB down'));
    const { reportError } = require('@/services/errorReporting');
    await expect(reportError(new Error('silent'), 'test.silent')).resolves.not.toThrow();
  });
});

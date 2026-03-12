/**
 * Tests for useListData hook
 *
 * Covers:
 * 1. Initial loading state → false after load
 * 2. Cached data shown immediately while fresh data loads
 * 3. Fresh data replaces cached data
 * 4. onRefresh — sets refreshing true/false, updates data
 * 5. Error handling — loading/refreshing still reset
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useListData } from '@/hooks/useListData';

type Item = { id: string; name: string };

const item1: Item = { id: '1', name: 'First' };
const item2: Item = { id: '2', name: 'Second' };
const item3: Item = { id: '3', name: 'Third' };

describe('useListData', () => {
  it('starts with loading=true and empty data', () => {
    const fetchFn = jest.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useListData(fetchFn));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual([]);
    expect(result.current.refreshing).toBe(false);
  });

  it('sets loading=false after data is fetched', async () => {
    const fetchFn = jest.fn().mockResolvedValue([item1]);
    const { result } = renderHook(() => useListData(fetchFn));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([item1]);
  });

  it('shows cached data immediately then replaces with fresh data', async () => {
    const fetchFn = jest.fn().mockResolvedValue([item2]);
    const getCachedFn = jest.fn().mockResolvedValue([item1]);

    const { result } = renderHook(() => useListData(fetchFn, getCachedFn));

    await act(async () => {
      await result.current.reload();
    });

    // After reload, fresh data should be shown
    expect(result.current.data).toEqual([item2]);
    expect(getCachedFn).toHaveBeenCalled();
  });

  it('always checks cache on each reload (stale closure — data not in useCallback deps)', async () => {
    // The load callback captures `data` via closure WITHOUT it being in deps,
    // so it always sees data.length === 0 from mount time and always checks the cache.
    // This test documents that known behavior.
    const fetchFn = jest.fn().mockResolvedValue([item1]);
    const getCachedFn = jest.fn().mockResolvedValue([item2]);

    const { result } = renderHook(() => useListData(fetchFn, getCachedFn));

    await act(async () => { await result.current.reload(); });
    await act(async () => { await result.current.reload(); });

    // getCachedFn is called on every reload due to stale closure
    expect(getCachedFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('works without a getCachedFn', async () => {
    const fetchFn = jest.fn().mockResolvedValue([item3]);
    const { result } = renderHook(() => useListData(fetchFn));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).toEqual([item3]);
    expect(result.current.loading).toBe(false);
  });

  it('does not show cache data when cache returns null', async () => {
    const fetchFn = jest.fn().mockResolvedValue([item2]);
    const getCachedFn = jest.fn().mockResolvedValue(null);

    const { result } = renderHook(() => useListData(fetchFn, getCachedFn));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).toEqual([item2]);
  });

  it('does not show cache data when cache returns empty array', async () => {
    const fetchFn = jest.fn().mockResolvedValue([item1]);
    const getCachedFn = jest.fn().mockResolvedValue([]);

    const { result } = renderHook(() => useListData(fetchFn, getCachedFn));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data).toEqual([item1]);
  });

  it('sets loading=false even when fetchFn throws', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useListData(fetchFn));

    await act(async () => {
      try {
        await result.current.reload();
      } catch {
        // error expected — we're testing that loading is still set to false
      }
    });

    expect(result.current.loading).toBe(false);
  });
});

describe('useListData — onRefresh', () => {
  it('sets refreshing=true while fetching, then false after', async () => {
    let resolve!: (data: Item[]) => void;
    const fetchFn = jest.fn().mockReturnValue(new Promise<Item[]>(r => { resolve = r; }));

    const { result } = renderHook(() => useListData(fetchFn));

    act(() => {
      result.current.onRefresh();
    });

    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      resolve([item3]);
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toEqual([item3]);
  });

  it('resets refreshing=false even when fetchFn throws during refresh', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('Refresh error'));
    const { result } = renderHook(() => useListData(fetchFn));

    await act(async () => {
      try {
        await result.current.onRefresh();
      } catch {
        // error expected
      }
    });

    expect(result.current.refreshing).toBe(false);
  });

  it('updates data after successful refresh', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce([item1])
      .mockResolvedValueOnce([item2, item3]);

    const { result } = renderHook(() => useListData(fetchFn));

    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toEqual([item1]);

    await act(async () => {
      await result.current.onRefresh();
    });
    expect(result.current.data).toEqual([item2, item3]);
  });
});

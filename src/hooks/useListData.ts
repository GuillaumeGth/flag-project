import { useState, useCallback } from 'react';

interface UseListDataResult<T> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  reload: () => void;
}

/**
 * Generic hook for loading list data with loading/refreshing states and cache support.
 *
 * @param fetchFn  Async function that returns fresh data from the server
 * @param getCachedFn  Optional async function that returns cached data immediately
 */
export function useListData<T>(
  fetchFn: () => Promise<T[]>,
  getCachedFn?: () => Promise<T[] | null>
): UseListDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Show cached data instantly if available
    if (data.length === 0 && getCachedFn) {
      const cached = await getCachedFn();
      if (cached && cached.length > 0) {
        setData(cached);
      }
    }

    try {
      const fresh = await fetchFn();
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, getCachedFn]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await fetchFn();
      setData(fresh);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFn]);

  return { data, loading, refreshing, onRefresh, reload: load };
}

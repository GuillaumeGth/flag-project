import { useState, useCallback } from 'react';
import { fetchMyFlagsForMap } from '@/services/messages';
import { OwnFlagMapMeta } from '@/types';
import { log } from '@/utils/debug';

interface UseMyFlagsResult {
  flags: OwnFlagMapMeta[];
  loading: boolean;
  loadFlags: () => Promise<void>;
}

export function useMyFlags(): UseMyFlagsResult {
  const [flags, setFlags] = useState<OwnFlagMapMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFlags = useCallback(async () => {
    log('useMyFlags', 'loadFlags: START');
    setLoading(true);
    const data = await fetchMyFlagsForMap();
    log('useMyFlags', 'loadFlags: got', data.length, 'own flags');
    setFlags(data);
    setLoading(false);
  }, []);

  return { flags, loading, loadFlags };
}

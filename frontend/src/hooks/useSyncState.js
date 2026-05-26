import { useState, useCallback } from 'react';

/**
 * Hook for managing synchronized state across Socket.IO
 */
export function useSyncState(initialValue = null) {
  const [state, setState] = useState(initialValue);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateState = useCallback((newValue) => {
    setState(newValue);
  }, []);

  const updateStateWithSync = useCallback(async (newValue, syncFn) => {
    try {
      setIsSyncing(true);
      setState(newValue);
      await syncFn?.(newValue);
    } catch (error) {
      console.error('Sync error:', error);
      setIsSyncing(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    state,
    setState: updateState,
    updateWithSync: updateStateWithSync,
    isSyncing,
  };
}

export default useSyncState;

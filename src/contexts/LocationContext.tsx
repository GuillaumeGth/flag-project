import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { Coordinates, LocationState } from '@/types';
import {
  getCurrentLocation,
  requestForegroundPermission,
  startBackgroundLocationTracking,
} from '@/services/location';

interface LocationContextType extends LocationState {
  requestPermission: () => Promise<boolean>;
  startTracking: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>({
    current: null,
    permission: 'undetermined',
    loading: true,
  });

  useEffect(() => {
    checkPermissionAndGetLocation();
  }, []);

  const checkPermissionAndGetLocation = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setState((prev) => ({
      ...prev,
      permission: status as LocationState['permission'],
    }));

    if (status === 'granted') {
      const location = await getCurrentLocation();
      setState((prev) => ({
        ...prev,
        current: location,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    const granted = await requestForegroundPermission();
    setState((prev) => ({
      ...prev,
      permission: granted ? 'granted' : 'denied',
    }));

    if (granted) {
      const location = await getCurrentLocation();
      setState((prev) => ({ ...prev, current: location }));
    }

    return granted;
  };

  const startTracking = async (): Promise<boolean> => {
    return await startBackgroundLocationTracking();
  };

  const refreshLocation = async (): Promise<void> => {
    if (state.permission === 'granted') {
      setState((prev) => ({ ...prev, loading: true }));
      const location = await getCurrentLocation();
      setState((prev) => ({ ...prev, current: location, loading: false }));
    }
  };

  return (
    <LocationContext.Provider
      value={{
        ...state,
        requestPermission,
        startTracking,
        refreshLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

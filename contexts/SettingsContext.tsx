import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';

interface SettingsState {
  playbackSpeed: number;
  defaultTimerMinutes: number;
  defaultArtworkUri: string | null;
  volume: number;
}

interface SettingsContextType extends SettingsState {
  setPlaybackSpeed: (speed: number) => void;
  setDefaultTimer: (minutes: number) => void;
  setDefaultArtwork: (uri: string | null) => void;
  setVolume: (volume: number) => void;
  loaded: boolean;
}

const defaultSettings: SettingsState = {
  playbackSpeed: 1.0,
  defaultTimerMinutes: 15,
  defaultArtworkUri: null,
  volume: 1.0,
};

const SettingsContext = createContext<SettingsContextType>({
  ...defaultSettings,
  setPlaybackSpeed: () => {},
  setDefaultTimer: () => {},
  setDefaultArtwork: () => {},
  setVolume: () => {},
  loaded: false,
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings((prev) => ({ ...prev, ...(parsed ?? {}) }));
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (next: SettingsState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
    } catch {}
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    setSettings((prev) => {
      const next = { ...prev, playbackSpeed: speed };
      persist(next);
      return next;
    });
  }, [persist]);

  const setDefaultTimer = useCallback((minutes: number) => {
    setSettings((prev) => {
      const next = { ...prev, defaultTimerMinutes: minutes };
      persist(next);
      return next;
    });
  }, [persist]);

  const setDefaultArtwork = useCallback((uri: string | null) => {
    setSettings((prev) => {
      const next = { ...prev, defaultArtworkUri: uri };
      persist(next);
      return next;
    });
  }, [persist]);

  const setVolume = useCallback((vol: number) => {
    setSettings((prev) => {
      const next = { ...prev, volume: Math.max(0, Math.min(1, vol)) };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <SettingsContext.Provider
      value={{ ...settings, setPlaybackSpeed, setDefaultTimer, setDefaultArtwork, setVolume, loaded }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
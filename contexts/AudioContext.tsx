import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { useSettings } from './SettingsContext';
import { isIdbUri, resolveToBlobUrl } from '../services/fileStore';
import { WebAudioSound } from '../services/webAudioPlayer';

async function resolvePlayableUri(uri: string): Promise<string | null> {
  if (Platform.OS === 'web' && isIdbUri(uri)) {
    return await resolveToBlobUrl(uri);
  }
  return uri;
}

// Unified factory: WebAudio on browsers (real seek + volume on iOS Safari),
// expo-av on native.
async function createPlayableSound(
  uri: string,
  initialStatus: any,
  onStatus: (s: AVPlaybackStatus) => void
) {
  if (Platform.OS === 'web') {
    return await WebAudioSound.createAsync({ uri }, initialStatus, onStatus as any);
  }
  return await Audio.Sound.createAsync({ uri }, initialStatus, onStatus);
}

let MediaControl: any = null;
let MediaCommand: any = null;
let MediaPlaybackState: any = null;

if (Platform.OS !== 'web') {
  try {
    const mc = require('expo-media-control');
    MediaControl = mc.MediaControl;
    MediaCommand = mc.Command;
    MediaPlaybackState = mc.PlaybackState;
  } catch {
    // expo-media-control not available (e.g. Expo Go)
  }
}

export interface Track {
  uri: string;
  name: string;
  artist?: string;
  durationMs?: number;
  artworkUri?: string;
}

interface AudioContextType {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  sleepTimerRemaining: number;
  sleepTimerDuration: number;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  skipForward: (ms?: number) => Promise<void>;
  skipBack: (ms?: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  loadTrack: (track: Track, autoPlay?: boolean) => Promise<void>;
  setPlaylist: (tracks: Track[]) => void;
  setSleepTimer: (minutes: number) => void;
  loaded: boolean;
}

const AudioContext = createContext<AudioContextType>({
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  sleepTimerRemaining: 0,
  sleepTimerDuration: 15,
  play: async () => {},
  pause: async () => {},
  togglePlayPause: async () => {},
  seekTo: async () => {},
  skipForward: async () => {},
  skipBack: async () => {},
  nextTrack: async () => {},
  prevTrack: async () => {},
  loadTrack: async () => {},
  setPlaylist: () => {},
  setSleepTimer: () => {},
  loaded: false,
});

export const useAudio = () => useContext(AudioContext);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { playbackSpeed, defaultTimerMinutes, volume } = useSettings();
  const soundRef = useRef<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [sleepTimerDuration, setSleepTimerDuration] = useState(15);
  const [loaded, setLoaded] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayingRef = useRef(false);
  const positionRef = useRef(0);
  const currentTrackRef = useRef<Track | null>(null);
  const playlistRef = useRef<Track[]>([]);
  const mediaListenerRef = useRef<(() => void) | null>(null);

  // Keep refs in sync
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { positionRef.current = positionMs; }, [positionMs]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  // Configure audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch(() => {});
  }, []);

  // Initialize media controls (lock screen / Bluetooth)
  useEffect(() => {
    if (!MediaControl) return;
    (async () => {
      try {
        await MediaControl.enableMediaControls({
          capabilities: [
            MediaCommand.PLAY,
            MediaCommand.PAUSE,
            MediaCommand.NEXT_TRACK,
            MediaCommand.PREVIOUS_TRACK,
          ],
          notification: { color: '#3B82F6' },
        });
      } catch {
        // Media control init failed — not critical
      }
    })();
    return () => {
      if (MediaControl) {
        MediaControl.disableMediaControls?.().catch(() => {});
      }
    };
  }, []);

  // Listen to media control events (Bluetooth / lock screen buttons)
  useEffect(() => {
    if (!MediaControl) return;
    const remove = MediaControl.addListener((event: any) => {
      if (!event?.command) return;
      switch (event.command) {
        case MediaCommand.PLAY:
          soundRef.current?.playAsync?.().catch(() => {});
          break;
        case MediaCommand.PAUSE:
          soundRef.current?.pauseAsync?.().catch(() => {});
          break;
        case MediaCommand.NEXT_TRACK:
          _nextTrackInternal();
          break;
        case MediaCommand.PREVIOUS_TRACK:
          // Go to beginning of track; if already at beginning, go to previous
          if (positionRef.current > 3000) {
            soundRef.current?.setPositionAsync?.(0).catch(() => {});
          } else {
            _prevTrackInternal();
          }
          break;
      }
    });
    mediaListenerRef.current = remove;
    return () => {
      remove?.();
      mediaListenerRef.current = null;
    };
  }, []);

  // Update media control metadata when track changes
  useEffect(() => {
    if (!MediaControl || !currentTrack) return;
    (async () => {
      try {
        await MediaControl.updateMetadata({
          title: currentTrack.name || 'Sans titre',
          artist: currentTrack.artist || 'Artiste inconnu',
          ...(currentTrack.artworkUri ? { artwork: { uri: currentTrack.artworkUri } } : {}),
        });
      } catch {}
    })();
  }, [currentTrack]);

  // Update media control playback state
  useEffect(() => {
    if (!MediaControl || !MediaPlaybackState) return;
    (async () => {
      try {
        await MediaControl.updatePlaybackState(
          isPlaying ? MediaPlaybackState.PLAYING : MediaPlaybackState.PAUSED
        );
      } catch {}
    })();
  }, [isPlaying]);

  // Apply playback speed when it changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setRateAsync(playbackSpeed, true).catch(() => {});
    }
  }, [playbackSpeed]);

  // Apply volume when it changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(volume).catch(() => {});
    }
  }, [volume]);

  // Set default timer from settings
  useEffect(() => {
    setSleepTimerDuration(defaultTimerMinutes);
  }, [defaultTimerMinutes]);

  // Sleep timer interval
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (sleepTimerRemaining > 0) {
      timerRef.current = setInterval(() => {
        if (!isPlayingRef.current) return;
        setSleepTimerRemaining((prev) => {
          if (prev <= 1) {
            // Timer done — pause
            soundRef.current?.pauseAsync?.().catch(() => {});
            setIsPlaying(false);
            savePlaybackState();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sleepTimerRemaining > 0]); // restart interval whenever timer starts/stops

  const savePlaybackState = useCallback(async () => {
    try {
      const track = currentTrackRef.current;
      if (!track) return;
      const idx = playlistRef.current?.findIndex((t) => t?.uri === track?.uri) ?? -1;
      await AsyncStorage.setItem(
        STORAGE_KEYS.PLAYBACK_STATE,
        JSON.stringify({ trackUri: track.uri, position: positionRef.current, playlistIndex: idx >= 0 ? idx : 0 })
      );
    } catch {}
  }, []);

  // Save state on app background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        savePlaybackState();
      }
    });
    return () => sub?.remove?.();
  }, [savePlaybackState]);

  // Restore state on mount
  useEffect(() => {
    (async () => {
      try {
        const [libRaw, stateRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.LIBRARY),
          AsyncStorage.getItem(STORAGE_KEYS.PLAYBACK_STATE),
        ]);
        const rawLib: Track[] = libRaw ? JSON.parse(libRaw) ?? [] : [];
        // On web, drop tracks with stale blob: URIs (they don't survive reload)
        const lib =
          Platform.OS === 'web'
            ? rawLib.filter((t) => t?.uri && !t.uri.startsWith('blob:'))
            : rawLib;
        setPlaylist(lib);

        if (stateRaw) {
          const state = JSON.parse(stateRaw);
          if (state?.trackUri) {
            const track = lib?.find((t) => t?.uri === state.trackUri);
            if (track) {
              await _loadSound(track, false, state.position ?? 0);
            }
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status?.isLoaded) return;
    setPositionMs(status.positionMillis ?? 0);
    setDurationMs(status.durationMillis ?? 0);
    setIsPlaying(status.isPlaying ?? false);
    if (status.didJustFinish) {
      setIsPlaying(false);
      savePlaybackState();
    }
  }, [savePlaybackState]);

  const _loadSound = useCallback(async (track: Track, autoPlay: boolean = false, initialPosition: number = 0) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const playableUri = await resolvePlayableUri(track.uri);
      if (!playableUri) {
        console.warn('Track URI cannot be resolved:', track.uri);
        return;
      }
      const { sound } = await createPlayableSound(
        playableUri,
        {
          shouldPlay: autoPlay,
          positionMillis: initialPosition,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
          volume: volume,
        },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound as any;
      setCurrentTrack(track);
      setPositionMs(initialPosition);
      if (autoPlay) {
        setSleepTimerRemaining(sleepTimerDuration * 60);
      }
    } catch (e) {
      console.warn('Failed to load audio:', e);
    }
  }, [playbackSpeed, volume, onPlaybackStatusUpdate, sleepTimerDuration]);

  const loadTrack = useCallback(async (track: Track, autoPlay: boolean = true) => {
    await _loadSound(track, autoPlay);
  }, [_loadSound]);

  const play = useCallback(async () => {
    try {
      await soundRef.current?.playAsync?.();
      if (sleepTimerRemaining <= 0) {
        setSleepTimerRemaining(sleepTimerDuration * 60);
      }
    } catch {}
  }, [sleepTimerRemaining, sleepTimerDuration]);

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync?.();
    } catch {}
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlayingRef.current) {
      await pause();
    } else {
      await play();
    }
  }, [play, pause]);

  const seekTo = useCallback(async (ms: number) => {
    try {
      await soundRef.current?.setPositionAsync?.(Math.max(0, ms));
    } catch {}
  }, []);

  const skipForward = useCallback(async (ms: number = 30000) => {
    const newPos = Math.min(positionRef.current + ms, durationMs);
    await seekTo(newPos);
  }, [durationMs, seekTo]);

  const skipBack = useCallback(async (ms: number = 30000) => {
    const newPos = Math.max(positionRef.current - ms, 0);
    await seekTo(newPos);
  }, [seekTo]);

  // Internal functions for media control callbacks (avoid stale closures)
  const _nextTrackInternal = () => {
    const pl = playlistRef.current ?? [];
    if (pl.length === 0) return;
    const curIdx = pl.findIndex((t) => t?.uri === currentTrackRef.current?.uri);
    const nextIdx = (curIdx + 1) % pl.length;
    const track = pl[nextIdx];
    if (track) {
      _loadSoundImperative(track, true);
    }
  };

  const _prevTrackInternal = () => {
    const pl = playlistRef.current ?? [];
    if (pl.length === 0) return;
    const curIdx = pl.findIndex((t) => t?.uri === currentTrackRef.current?.uri);
    const prevIdx = curIdx <= 0 ? pl.length - 1 : curIdx - 1;
    const track = pl[prevIdx];
    if (track) {
      _loadSoundImperative(track, true);
    }
  };

  // Imperative load that doesn't depend on callback closures
  const _loadSoundImperative = async (track: Track, autoPlay: boolean) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      const playableUri = await resolvePlayableUri(track.uri);
      if (!playableUri) {
        console.warn('Track URI cannot be resolved:', track.uri);
        return;
      }
      const { sound } = await createPlayableSound(
        playableUri,
        {
          shouldPlay: autoPlay,
          positionMillis: 0,
          rate: playbackSpeed,
          shouldCorrectPitch: true,
          volume: volume,
        },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound as any;
      setCurrentTrack(track);
      setPositionMs(0);
      if (autoPlay) {
        setSleepTimerRemaining(sleepTimerDuration * 60);
      }
    } catch (e) {
      console.warn('Failed to load audio:', e);
    }
  };

  const nextTrack = useCallback(async () => {
    const pl = playlistRef.current ?? [];
    if (pl.length === 0) return;
    const curIdx = pl.findIndex((t) => t?.uri === currentTrackRef.current?.uri);
    const nextIdx = (curIdx + 1) % pl.length;
    await loadTrack(pl[nextIdx] as Track, true);
  }, [loadTrack]);

  const prevTrack = useCallback(async () => {
    const pl = playlistRef.current ?? [];
    if (pl.length === 0) return;
    const curIdx = pl.findIndex((t) => t?.uri === currentTrackRef.current?.uri);
    const prevIdx = curIdx <= 0 ? pl.length - 1 : curIdx - 1;
    await loadTrack(pl[prevIdx] as Track, true);
  }, [loadTrack]);

  const setSleepTimer = useCallback((minutes: number) => {
    setSleepTimerDuration(minutes);
    setSleepTimerRemaining(minutes * 60);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        playlist,
        isPlaying,
        positionMs,
        durationMs,
        sleepTimerRemaining,
        sleepTimerDuration,
        play,
        pause,
        togglePlayPause,
        seekTo,
        skipForward,
        skipBack,
        nextTrack,
        prevTrack,
        loadTrack,
        setPlaylist,
        setSleepTimer,
        loaded,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
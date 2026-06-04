import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudio } from '../../contexts/AudioContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const TIMER_OPTIONS = [10, 15, 20, 25, 30];

function formatTime(ms: number): string {
  const totalSec = Math.floor((ms ?? 0) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function formatTimerSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec ?? 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    sleepTimerRemaining,
    sleepTimerDuration,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBack,
    nextTrack,
    prevTrack,
    setSleepTimer,
  } = useAudio();
  const { defaultArtworkUri } = useSettings();
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const hasTrack = !!currentTrack;

  const artworkSource = currentTrack?.artworkUri
    ? { uri: currentTrack.artworkUri }
    : defaultArtworkUri
    ? { uri: defaultArtworkUri }
    : null;

  const handleTimerSelect = useCallback((minutes: number) => {
    setSleepTimer(minutes);
    setTimerModalVisible(false);
  }, [setSleepTimer]);

  const handleSlidingStart = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleValueChange = useCallback((val: number) => {
    setSeekValue(val);
  }, []);

  const handleSlidingComplete = useCallback(async (val: number) => {
    await seekTo(val);
    setIsSeeking(false);
  }, [seekTo]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
      {/* Album Art */}
      <View style={styles.artContainer}>
        {artworkSource ? (
          <Image source={artworkSource} style={styles.artwork} />
        ) : (
          <View style={[styles.artwork, styles.artPlaceholder]}>
            <Ionicons name="musical-notes" size={80} color={Colors.textTertiary} />
          </View>
        )}
      </View>

      {/* Track Info */}
      <Text style={styles.trackTitle} numberOfLines={1}>
        {currentTrack?.name ?? 'Aucune piste sélectionnée'}
      </Text>
      <Text style={styles.trackArtist} numberOfLines={1}>
        {hasTrack ? (currentTrack?.artist ?? 'Artiste inconnu') : 'Sélectionnez un fichier dans la bibliothèque'}
      </Text>

      {/* Playback Controls */}
      <View style={styles.controlsRow}>
        <Pressable
          onPress={prevTrack}
          disabled={!hasTrack}
          style={styles.controlBtn}
          accessibilityLabel="Piste précédente"
        >
          <Ionicons name="play-skip-back" size={28} color={hasTrack ? Colors.textSecondary : Colors.surface} />
        </Pressable>

        <Pressable
          onPress={() => skipBack()}
          disabled={!hasTrack}
          style={styles.controlBtn}
          accessibilityLabel="Reculer de 30 secondes"
        >
          <MaterialCommunityIcons name="rewind-30" size={32} color={hasTrack ? Colors.textPrimary : Colors.surface} />
        </Pressable>

        <Pressable
          onPress={togglePlayPause}
          disabled={!hasTrack}
          style={[
            styles.playBtn,
            { backgroundColor: hasTrack ? Colors.primary : Colors.surface },
          ]}
          accessibilityLabel={isPlaying ? 'Pause' : 'Lecture'}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
        </Pressable>

        <Pressable
          onPress={() => skipForward()}
          disabled={!hasTrack}
          style={styles.controlBtn}
          accessibilityLabel="Avancer de 30 secondes"
        >
          <MaterialCommunityIcons name="fast-forward-30" size={32} color={hasTrack ? Colors.textPrimary : Colors.surface} />
        </Pressable>

        <Pressable
          onPress={nextTrack}
          disabled={!hasTrack}
          style={styles.controlBtn}
          accessibilityLabel="Piste suivante"
        >
          <Ionicons name="play-skip-forward" size={28} color={hasTrack ? Colors.textSecondary : Colors.surface} />
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={durationMs || 1}
          value={isSeeking ? seekValue : positionMs}
          onSlidingStart={handleSlidingStart}
          onValueChange={handleValueChange}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={Colors.primary}
          maximumTrackTintColor={Colors.surface}
          thumbTintColor={Colors.textPrimary}
          disabled={!hasTrack}
        />
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(isSeeking ? seekValue : positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Sleep Timer */}
      <View style={styles.timerSection}>
        <Text style={styles.timerLabel}>TEMPS RESTANT</Text>
        <Pressable onPress={() => setTimerModalVisible(true)} style={styles.timerDisplay}>
          <Ionicons name="time-outline" size={24} color={Colors.textTertiary} style={{ marginRight: 8 }} />
          <Text style={styles.timerValue}>{formatTimerSec(sleepTimerRemaining)}</Text>
          <Ionicons name="chevron-down" size={20} color={Colors.textTertiary} style={{ marginLeft: 8 }} />
        </Pressable>
      </View>

      {/* Timer Picker Modal */}
      <Modal
        visible={timerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTimerModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTimerModalVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Minuterie</Text>
            <FlatList
              data={TIMER_OPTIONS}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.timerOption}
                  onPress={() => handleTimerSelect(item)}
                >
                  <Text
                    style={[
                      styles.timerOptionText,
                      sleepTimerDuration === item && styles.timerOptionActive,
                    ]}
                  >
                    {item} minutes
                  </Text>
                  {sleepTimerDuration === item && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  artContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  artwork: {
    width: 260,
    height: 260,
    borderRadius: BorderRadius.lg,
  },
  artPlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  trackArtist: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  controlBtn: {
    padding: Spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  timeText: {
    color: Colors.textTertiary,
    fontSize: 13,
  },
  timerSection: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  timerLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerValue: {
    color: Colors.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  timerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  timerOptionText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  timerOptionActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});

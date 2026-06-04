import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  ScrollView,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../contexts/SettingsContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const SPEED_OPTIONS = [0.8, 0.85, 0.9, 0.95, 1.0];
const TIMER_OPTIONS = [10, 15, 20, 25, 30];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    playbackSpeed,
    defaultTimerMinutes,
    defaultArtworkUri,
    volume,
    setPlaybackSpeed,
    setDefaultTimer,
    setDefaultArtwork,
    setVolume,
  } = useSettings();

  const [timerModalVisible, setTimerModalVisible] = useState(false);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result?.canceled && result?.assets?.[0]?.uri) {
        setDefaultArtwork(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Image picker error:', e);
    }
  }, [setDefaultArtwork]);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + Spacing.md }]}
      contentContainerStyle={{ paddingBottom: Spacing.xxl }}
    >
      <Text style={styles.headerTitle}>Paramètres</Text>

      {/* Section: Lecture */}
      <Text style={styles.sectionLabel}>LECTURE</Text>
      <View style={styles.card}>
        {/* Default Timer */}
        <Pressable style={styles.row} onPress={() => setTimerModalVisible(true)}>
          <Text style={styles.rowLabel}>Durée du minuteur</Text>
          <View style={styles.rowRight}>
            <Text style={styles.rowValue}>{defaultTimerMinutes} min</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
          </View>
        </Pressable>
      </View>

      {/* Section: Vitesse */}
      <Text style={styles.sectionLabel}>VITESSE DE LECTURE</Text>
      <View style={styles.speedChips}>
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            style={[
              styles.chip,
              playbackSpeed === s && styles.chipActive,
            ]}
            onPress={() => setPlaybackSpeed(s)}
            accessibilityLabel={`Vitesse ${Math.round(s * 100)}%`}
          >
            <Text
              style={[
                styles.chipText,
                playbackSpeed === s && styles.chipTextActive,
              ]}
            >
              {Math.round(s * 100)}%
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Section: Volume */}
      <Text style={styles.sectionLabel}>VOLUME</Text>
      <View style={styles.card}>
        <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Ionicons name="volume-low" size={20} color={Colors.textSecondary} />
            <Text style={styles.rowValue}>{Math.round(volume * 100)}%</Text>
            <Ionicons name="volume-high" size={20} color={Colors.textSecondary} />
          </View>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={volume}
            onSlidingComplete={setVolume}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.surface}
            thumbTintColor={Colors.textPrimary}
          />
        </View>
      </View>

      {/* Section: Apparence */}
      <Text style={styles.sectionLabel}>APPARENCE</Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={pickImage}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Image d&apos;album par défaut</Text>
            <Text style={styles.rowHint}>Modifier</Text>
          </View>
          <View style={styles.artPreview}>
            {defaultArtworkUri ? (
              <Image source={{ uri: defaultArtworkUri }} style={styles.artThumb} />
            ) : (
              <View style={[styles.artThumb, styles.artPlaceholder]}>
                <Ionicons name="image" size={20} color={Colors.textTertiary} />
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* Section: About */}
      <Text style={styles.sectionLabel}>À PROPOS</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>

      {/* Timer Modal */}
      <Modal visible={timerModalVisible} transparent animationType="slide" onRequestClose={() => setTimerModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTimerModalVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Durée du minuteur par défaut</Text>
            <FlatList
              data={TIMER_OPTIONS}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => {
                    setDefaultTimer(item);
                    setTimerModalVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, defaultTimerMinutes === item && styles.optionActive]}>
                    {item} minutes
                  </Text>
                  {defaultTimerMinutes === item && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    minHeight: 52,
  },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    color: Colors.primary,
    fontSize: 16,
  },
  rowHint: {
    color: Colors.primary,
    fontSize: 13,
    marginTop: 2,
  },
  speedChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  artPreview: {
    marginLeft: 12,
  },
  artThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  artPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  optionText: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
  optionActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
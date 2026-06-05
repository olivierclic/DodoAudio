import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../../contexts/SettingsContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { APP_VERSION } from '../../constants/version';

// 0.80, 0.82, 0.84, ..., 1.00 — 11 speed options in 0.02 increments
const SPEED_OPTIONS: number[] = Array.from(
  { length: 11 },
  (_, i) => Math.round((0.8 + i * 0.02) * 100) / 100,
);

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    playbackSpeed,
    defaultArtworkUri,
    setPlaybackSpeed,
    setDefaultArtwork,
  } = useSettings();

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

      {/* Section: Vitesse de lecture */}
      <Text style={styles.sectionLabel}>VITESSE DE LECTURE</Text>
      <View style={styles.speedChips}>
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, Math.abs(playbackSpeed - s) < 0.001 && styles.chipActive]}
            onPress={() => setPlaybackSpeed(s)}
            accessibilityLabel={`Vitesse ${s.toFixed(2)}x`}
          >
            <Text
              style={[
                styles.chipText,
                Math.abs(playbackSpeed - s) < 0.001 && styles.chipTextActive,
              ]}
            >
              {s.toFixed(2)}x
            </Text>
          </Pressable>
        ))}
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
          <Text style={styles.rowValue}>{APP_VERSION}</Text>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    fontSize: 16,
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
});

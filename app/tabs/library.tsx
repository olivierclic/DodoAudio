import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudio, Track } from '../../contexts/AudioContext';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { STORAGE_KEYS } from '../../constants/storage';
import { extractMetadata } from '../../services/metadata';
import { saveFile, deleteFile, isIdbUri } from '../../services/fileStore';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentTrack, isPlaying, loadTrack, setPlaylist, playlist, trackLoading } = useAudio();
  const [tracks, setTracks] = useState<Track[]>(playlist ?? []);
  const [importing, setImporting] = useState(false);
  const [libLoading, setLibLoading] = useState(true);

  useEffect(() => {
    setTracks(playlist ?? []);
  }, [playlist]);

  // Reload from storage on mount. On web, drop tracks whose URIs are stale
  // (blob: URIs that don't survive a page reload).
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.LIBRARY);
        if (raw) {
          const lib: Track[] = JSON.parse(raw) ?? [];
          const valid =
            Platform.OS === 'web'
              ? lib.filter((t) => t?.uri && !t.uri.startsWith('blob:'))
              : lib;
          setTracks(valid);
          setPlaylist(valid);
          if (valid.length !== lib.length) {
            AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(valid)).catch(() => {});
          }
        }
      } catch {}
      finally {
        // Always clear the loader, even when storage is empty (first launch).
        setLibLoading(false);
      }
    })();
  }, [setPlaylist]);

  const importFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result?.canceled) return;

      const assets = result?.assets ?? [];
      if (assets.length === 0) return;

      setImporting(true);

      const newTracks: Track[] = [];
      for (const asset of assets) {
        const pickedUri = asset?.uri ?? '';
        const file = (asset as any)?.file as File | undefined;
        const fileName = asset?.name ?? 'Fichier inconnu';
        // Extract ID3 metadata including artwork (pass File for web reliability)
        const meta = await extractMetadata(pickedUri, file);

        // On web, persist the Blob in IndexedDB so the track survives reloads.
        let uri = pickedUri;
        if (Platform.OS === 'web') {
          try {
            const blob: Blob | null = file ?? (pickedUri ? await (await fetch(pickedUri)).blob() : null);
            if (blob) uri = await saveFile(blob);
          } catch (err) {
            console.warn('IDB save failed, falling back to blob URL:', err);
          }
        }

        newTracks.push({
          uri,
          name: meta.title || fileName.replace(/\.[^/.]+$/, ''),
          artist: meta.artist || undefined,
          durationMs: undefined,
          artworkUri: meta.artworkUri || undefined,
        });
      }

      setTracks((prev) => {
        const existingUris = new Set((prev ?? []).map((t) => t?.uri));
        const unique = newTracks.filter((t) => !existingUris.has(t?.uri));
        const updated = [...(prev ?? []), ...unique];
        AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(updated)).catch(() => {});
        setPlaylist(updated);
        return updated;
      });
      setImporting(false);
    } catch (e) {
      setImporting(false);
      console.warn('Document picker error:', e);
    }
  }, [setPlaylist]);

  const deleteTrack = useCallback((uri: string) => {
    const doDelete = () => {
      if (Platform.OS === 'web' && isIdbUri(uri)) {
        deleteFile(uri).catch(() => {});
      }
      setTracks((prev) => {
        const updated = (prev ?? []).filter((t) => t?.uri !== uri);
        AsyncStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(updated)).catch(() => {});
        setPlaylist(updated);
        return updated;
      });
    };

    if (Platform.OS === 'web') {
      doDelete();
    } else {
      Alert.alert('Supprimer', 'Voulez-vous supprimer ce fichier de la bibliothèque ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [setPlaylist]);

  const handleTrackPress = useCallback(async (track: Track) => {
    await loadTrack(track, true);
    router.push('/tabs/player');
  }, [loadTrack, router]);

  const renderItem = useCallback(({ item }: { item: Track }) => {
    const isCurrent = currentTrack?.uri === item?.uri;
    const hasArt = !!item?.artworkUri;
    return (
      <Pressable
        style={[styles.trackRow, isCurrent && styles.trackRowActive]}
        onPress={() => handleTrackPress(item)}
        accessibilityLabel={`Lire ${item?.name ?? 'fichier'}`}
      >
        <View style={styles.trackIcon}>
          {hasArt ? (
            <Image source={{ uri: item.artworkUri }} style={styles.trackThumb} />
          ) : isCurrent && isPlaying ? (
            <Ionicons name="musical-notes" size={24} color={Colors.primary} />
          ) : (
            <Ionicons name="musical-note" size={24} color={Colors.textTertiary} />
          )}
        </View>
        <View style={styles.trackInfo}>
          <Text style={[styles.trackName, isCurrent && { color: Colors.primary }]} numberOfLines={1}>
            {item?.name ?? 'Fichier inconnu'}
          </Text>
          {item?.artist ? (
            <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => deleteTrack(item?.uri ?? '')}
          style={styles.deleteBtn}
          accessibilityLabel="Supprimer"
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.danger} />
        </Pressable>
      </Pressable>
    );
  }, [currentTrack, isPlaying, handleTrackPress, deleteTrack]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bibliothèque</Text>
        <Pressable style={styles.importBtn} onPress={importFiles} disabled={importing} accessibilityLabel="Importer des fichiers">
          {importing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="add-circle" size={20} color="#fff" />
          )}
          <Text style={styles.importText}>{importing ? 'Import...' : 'Importer'}</Text>
        </Pressable>
      </View>

      {/* File List */}
      {libLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.emptyTitle}>Chargement de la bibliothèque…</Text>
        </View>
      ) : (tracks?.length ?? 0) === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="folder-open" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Aucun fichier audio</Text>
          <Text style={styles.emptySubtitle}>Importez des fichiers MP3 ou WAV</Text>
          <Pressable style={styles.importBtnLarge} onPress={importFiles}>
            <Ionicons name="add" size={24} color="#fff" />
            <Text style={styles.importTextLarge}>Importer des fichiers</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tracks ?? []}
          keyExtractor={(item) => item?.uri ?? Math.random().toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Overlay loader when a track is being decoded/loaded */}
      {trackLoading && (
        <View style={styles.trackLoadingOverlay} pointerEvents="auto">
          <View style={styles.trackLoadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.trackLoadingText}>Chargement du morceau…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  importText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  trackRowActive: {
    borderLeftColor: Colors.primary,
    borderLeftWidth: 3,
  },
  trackIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  trackThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  trackArtist: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  importBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    gap: 8,
  },
  importTextLarge: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLoadingBox: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    minWidth: 200,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  trackLoadingText: {
    color: Colors.textPrimary,
    fontSize: 14,
    marginTop: Spacing.sm,
  },
});
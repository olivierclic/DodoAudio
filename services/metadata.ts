import { Platform } from 'react-native';

interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkUri?: string; // base64 data URI
}

export async function extractMetadata(fileUri: string): Promise<TrackMetadata> {
  try {
    // expo-music-info-2 only works on native (reads file via expo-file-system)
    if (Platform.OS === 'web') {
      return {};
    }
    const { MusicInfo } = require('expo-music-info-2');
    const info = await MusicInfo.getMusicInfoAsync(fileUri, {
      title: true,
      artist: true,
      album: true,
      picture: true,
    });
    if (!info) return {};
    const result: TrackMetadata = {};
    if (info.title) result.title = info.title;
    if (info.artist) result.artist = info.artist;
    if (info.album) result.album = info.album;
    if (info.picture?.pictureData) {
      result.artworkUri = info.picture.pictureData;
    }
    return result;
  } catch (e) {
    console.warn('Metadata extraction failed:', e);
    return {};
  }
}

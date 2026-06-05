import { Platform } from 'react-native';

interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkUri?: string; // base64 data URI
  _debug?: string; // temporary: diagnostic info
}

export async function extractMetadata(fileUri: string, file?: any): Promise<TrackMetadata> {
  try {
    if (Platform.OS === 'web') {
      return await extractMetadataWeb(fileUri, file);
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
    return { _debug: 'native error: ' + (e as Error)?.message };
  }
}

async function extractMetadataWeb(fileUri: string, file?: any): Promise<TrackMetadata> {
  const debug: string[] = [];
  try {
    // jsmediatags is loaded via <script> tag in index.html as window.jsmediatags
    // (bundling it through Metro fails because of its Node-specific internal requires)
    const jsmediatags = (window as any).jsmediatags;
    if (!jsmediatags) {
      debug.push('FATAL: window.jsmediatags not loaded');
      return { _debug: debug.join(' | ') };
    }
    debug.push('jsmediatags loaded from window');

    // Prefer the File object if available (more reliable on Safari)
    let source: any = file;
    if (!source) {
      debug.push('fetching uri');
      const response = await fetch(fileUri);
      source = await response.blob();
      debug.push('blob size=' + source.size);
    } else {
      debug.push('using File directly, size=' + source.size);
    }

    const tag: any = await new Promise((resolve, reject) => {
      (jsmediatags as any).read(source, {
        onSuccess: resolve,
        onError: (err: any) => reject(new Error(err?.type + ': ' + (err?.info ?? 'unknown'))),
      });
    });
    debug.push('tags read');

    const tags = tag?.tags ?? {};
    const result: TrackMetadata = {};
    if (tags.title) result.title = tags.title;
    if (tags.artist) result.artist = tags.artist;
    if (tags.album) result.album = tags.album;

    const pic = tags.picture;
    debug.push('picture=' + (pic ? 'yes (' + pic.format + ', ' + (pic.data?.length ?? '?') + ' bytes)' : 'none'));

    if (pic && pic.data && pic.format) {
      try {
        const data = Array.isArray(pic.data) ? new Uint8Array(pic.data) : pic.data;
        const picBlob = new Blob([data], { type: pic.format });
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(picBlob);
        });
        result.artworkUri = dataUrl;
        debug.push('artwork converted, len=' + dataUrl.length);
      } catch (picErr) {
        debug.push('artwork conv FAILED: ' + (picErr as Error)?.message);
      }
    }

    result._debug = debug.join(' | ');
    return result;
  } catch (e) {
    debug.push('FATAL: ' + (e as Error)?.message);
    return { _debug: debug.join(' | ') };
  }
}

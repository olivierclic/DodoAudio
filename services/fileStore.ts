// IndexedDB-backed file store (web only).
// Audio files imported via DocumentPicker on web give us blob: URLs that
// expire when the page reloads. To survive PWA restarts we save the actual
// Blob and reference it via a stable "idb://<id>" URI.

const DB_NAME = 'dodo-audio-files';
const STORE = 'files';
const VERSION = 1;

const IDB_PREFIX = 'idb://';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function newId(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function saveFile(blob: Blob): Promise<string> {
  const id = newId();
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return IDB_PREFIX + id;
}

export async function getFileBlob(uri: string): Promise<Blob | null> {
  if (!uri.startsWith(IDB_PREFIX)) return null;
  const id = uri.slice(IDB_PREFIX.length);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFile(uri: string): Promise<void> {
  if (!uri.startsWith(IDB_PREFIX)) return;
  const id = uri.slice(IDB_PREFIX.length);
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function isIdbUri(uri: string): boolean {
  return typeof uri === 'string' && uri.startsWith(IDB_PREFIX);
}

// Resolve an idb:// URI to a playable blob URL.
// The caller is responsible for revoking the returned URL when no longer needed.
export async function resolveToBlobUrl(uri: string): Promise<string | null> {
  const blob = await getFileBlob(uri);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

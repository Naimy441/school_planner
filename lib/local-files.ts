"use client";

/**
 * Files kept on this device (IndexedDB). Browsers won't open `file://` links
 * from a website, so a textbook PDF is picked once and opened from here.
 */

export interface LocalFile {
  blob: Blob;
  name: string;
  type: string;
  savedAt: number;
}

const DB = "planner-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result as T);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function putLocalFile(key: string, file: File) {
  const v: LocalFile = { blob: file, name: file.name, type: file.type || "application/octet-stream", savedAt: Date.now() };
  return run<IDBValidKey>("readwrite", (s) => s.put(v, key));
}

export async function getLocalFile(key: string) {
  try {
    return (await run<LocalFile | undefined>("readonly", (s) => s.get(key))) || null;
  } catch {
    return null;
  }
}

export function deleteLocalFile(key: string) {
  return run<undefined>("readwrite", (s) => s.delete(key));
}

/** Open a stored file in a new tab. Call from a click handler so it isn't blocked as a popup. */
export function openLocalFile(f: LocalFile) {
  const url = URL.createObjectURL(f.blob);
  // (no "noopener": with it window.open always returns null, and we need to know if it was blocked)
  const w = window.open(url, "_blank");
  if (!w) {
    // Popup blocked (or iOS home-screen app): download it instead.
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

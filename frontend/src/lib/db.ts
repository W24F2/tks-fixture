/**
 * IndexedDB storage for fixtures.
 *
 * When the user is offline or when the API is slow, we fall back to
 * reading fixtures from IndexedDB so the UI never shows a blank screen.
 * Data is kept in sync with the server by the service worker.
 */

const DB_NAME = 'sports-fixture-db';
const DB_VERSION = 1;
const STORE_NAME = 'fixtures';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Save fixtures to IndexedDB. */
export async function saveFixtures(fixtures: unknown[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear(); // replace all fixtures

    for (const fixture of fixtures) {
      store.add(fixture);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    // IndexedDB might be unavailable (private mode, quota exceeded)
    console.warn('[db] Failed to save fixtures:', err);
  }
}

/** Read cached fixtures from IndexedDB. Returns null when nothing cached. */
export async function getCachedFixtures(): Promise<unknown[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/** Remove all cached fixtures. */
export async function clearCachedFixtures(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

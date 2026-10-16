/**
 * TEMPLE of Time - IndexedDB Persistence Engine
 * Zero-dependency local buffering for sub-millisecond psychophysics trial data.
 */

const DB_NAME = 'temple_of_time_db';
const DB_VERSION = 1;
const STORE_TRIALS = 'trial_buffers';
const STORE_SESSIONS = 'sessions';

let dbInstance: IDBDatabase | null = null;

export async function getIDBDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TRIALS)) {
        const trialStore = db.createObjectStore(STORE_TRIALS, { keyPath: 'id' });
        trialStore.createIndex('session_id', 'session_id', { unique: false });
        trialStore.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'session_id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function bufferTrialInIDB(trial: Record<string, unknown>): Promise<void> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRIALS, 'readwrite');
      const store = tx.objectStore(STORE_TRIALS);
      const record = {
        ...trial,
        id: (trial.id || trial.client_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idb_${Date.now()}_${Math.random()}`)) as string
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IDB trial buffering fallback to localStorage only', e);
  }
}

export async function getSessionTrialsFromIDB(sessionId: string): Promise<Record<string, unknown>[]> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRIALS, 'readonly');
      const store = tx.objectStore(STORE_TRIALS);
      const index = store.index('session_id');
      const req = index.getAll(sessionId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to retrieve trials from IDB', e);
    return [];
  }
}

export async function markTrialsSyncedInIDB(trialIds: string[]): Promise<void> {
  try {
    const db = await getIDBDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_TRIALS, 'readwrite');
      const store = tx.objectStore(STORE_TRIALS);
      trialIds.forEach(id => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated = { ...getReq.result, synced: true, flushed_at: new Date().toISOString() };
            store.put(updated);
          }
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Failed to update synced status in IDB', e);
  }
}

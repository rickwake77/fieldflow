// src/lib/offline-store.ts
// IndexedDB-based offline storage for FieldFlow
// Caches API data for offline reading and queues writes for later sync

const DB_NAME = "fieldflow-offline";
const DB_VERSION = 1;

// Store names
const CACHE_STORE = "api-cache";    // Cached GET responses
const QUEUE_STORE = "sync-queue";   // Pending POST/PATCH/DELETE actions

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Cache Layer ─────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readonly");
      const store = tx.objectStore(CACHE_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (!result) return resolve(null);
        // Check if cache is stale (older than 24 hours)
        const age = Date.now() - (result.timestamp || 0);
        if (age > 24 * 60 * 60 * 1000) return resolve(null);
        resolve(result.data as T);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      const store = tx.objectStore(CACHE_STORE);
      store.put({ key, data, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function cacheClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ── Sync Queue ──────────────────────────────────────────────

export interface QueuedAction {
  id?: number;
  type: "createJobLog" | "updateJobStatus" | "createJob";
  path: string;
  method: string;
  body: string;
  description: string; // Human-readable for the UI
  createdAt: number;
  retries: number;
}

export async function queueAction(action: Omit<QueuedAction, "id" | "createdAt" | "retries">): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      store.add({ ...action, createdAt: Date.now(), retries: 0 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to queue action:", err);
    throw err;
  }
}

export async function getQueuedActions(): Promise<QueuedAction[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeQueuedAction(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      tx.objectStore(QUEUE_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function updateQueuedAction(id: number, updates: Partial<QueuedAction>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readwrite");
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          store.put({ ...req.result, ...updates });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ── Sync Engine ─────────────────────────────────────────────

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const actions = await getQueuedActions();
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const res = await fetch(`/api${action.path}`, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: action.body,
      });

      if (res.ok) {
        await removeQueuedAction(action.id!);
        synced++;
      } else {
        // If it's a client error (4xx), don't retry — remove it
        if (res.status >= 400 && res.status < 500) {
          console.warn(`Sync failed permanently for action ${action.id}:`, await res.text());
          await removeQueuedAction(action.id!);
          failed++;
        } else {
          // Server error — increment retry, try again later
          await updateQueuedAction(action.id!, { retries: action.retries + 1 });
          failed++;
        }
      }
    } catch {
      // Network error — leave in queue for next sync
      failed++;
    }
  }

  return { synced, failed };
}

// ── Online Detection ────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

// src/components/OfflineBar.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isOnline,
  onConnectivityChange,
  getQueuedActions,
  syncQueue,
  type QueuedAction,
} from "@/lib/offline-store";

export default function OfflineBar({ onSynced }: { onSynced?: () => void }) {
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [queueItems, setQueueItems] = useState<QueuedAction[]>([]);

  const refreshQueue = useCallback(async () => {
    const actions = await getQueuedActions();
    setQueueCount(actions.length);
    setQueueItems(actions);
  }, []);

  // Initial state & listen for changes
  useEffect(() => {
    setOnline(isOnline());
    refreshQueue();

    const cleanup = onConnectivityChange((isNowOnline) => {
      setOnline(isNowOnline);
      if (isNowOnline) {
        // Auto-sync when coming back online
        handleSync();
      }
    });

    // Poll queue count every 5 seconds
    const interval = setInterval(refreshQueue, 5000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [refreshQueue]);

  const handleSync = async () => {
    setSyncing(true);
    setLastSyncResult(null);
    try {
      const result = await syncQueue();
      await refreshQueue();
      if (result.synced > 0) {
        setLastSyncResult(`${result.synced} item${result.synced !== 1 ? "s" : ""} synced`);
        onSynced?.();
      }
      if (result.failed > 0) {
        setLastSyncResult((prev) =>
          prev ? `${prev}, ${result.failed} failed` : `${result.failed} failed to sync`
        );
      }
    } catch {
      setLastSyncResult("Sync failed");
    }
    setSyncing(false);

    // Clear the result message after 4 seconds
    setTimeout(() => setLastSyncResult(null), 4000);
  };

  // Don't show anything if online and no queue
  if (online && queueCount === 0 && !lastSyncResult) return null;

  return (
    <>
      {/* Offline banner */}
      {!online && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-[60] relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0122.56 9" />
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
            <path d="M8.53 16.11a6 6 0 016.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          You're offline — changes will sync when you reconnect
        </div>
      )}

      {/* Sync queue bar */}
      {queueCount > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between z-[60] relative">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="text-sm text-blue-700 font-medium flex items-center gap-1.5"
          >
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">
              {queueCount}
            </span>
            pending {queueCount === 1 ? "change" : "changes"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition ${showQueue ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !online}
            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {syncing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                {online ? "Sync Now" : "Offline"}
              </>
            )}
          </button>
        </div>
      )}

      {/* Queue detail dropdown */}
      {showQueue && queueCount > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 pb-3 z-[60] relative">
          <div className="space-y-1.5">
            {queueItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs text-blue-700 bg-white rounded-lg px-3 py-2 border border-blue-100">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0 truncate">{item.description}</div>
                <div className="text-blue-400 flex-shrink-0">
                  {new Date(item.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync result toast */}
      {lastSyncResult && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-stone-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2 animate-[slideUp_0.3s_ease-out]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {lastSyncResult}
        </div>
      )}
    </>
  );
}

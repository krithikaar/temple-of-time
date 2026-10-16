/**
 * TEMPLE of Time - Data Synchronization Service (dataSyncService.ts)
 * Official Supabase JavaScript Client Ingestion & Fail-Safe Local Buffering.
 * Automatically attaches session JWTs, handles background token refreshes,
 * and maintains zero data-loss local buffer fallbacks.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  TargetTrialTable,
  AnyNormalizedTrialPayload,
  ClientBufferedTrial,
  ChamberSealInfo
} from './types';
import { bufferTrialInIDB, markTrialsSyncedInIDB, getSessionTrialsFromIDB } from './idb';

// LIVE BACKEND CONFIGURATION
export const SUPABASE_CONFIG = {
  baseUrl: "https://wltwbiwbmuxwepqorarq.supabase.co",
  anonKey: "sb_publishable_dC1a3bkX31-89kjDpqXr_w_7yUpOHvx"
};

/**
 * Official Supabase JavaScript Client Instance
 * Configured with auto-refreshing JWTs and persistent session state
 */
export const supabase: SupabaseClient = createClient(
  SUPABASE_CONFIG.baseUrl,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

/**
 * Reads cached session from localStorage if needed
 */
export function getStoredAuthSession(): { access_token?: string; refresh_token?: string; user?: { id: string } } | null {
  try {
    const raw = localStorage.getItem('TEMPLE_AUTH_SESSION');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore JSON parsing errors
  }
  return null;
}

/**
 * Dispatches a store change notification across the application
 */
function notifyStoreUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('temple_store_update'));
  }
}

/**
 * Retrieves the currently active Supabase session.
 * If the in-memory client state is uninitialized, recovers session from localStorage.
 */
export async function getActiveAuthSession() {
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (!session || sessionError) {
    const cached = getStoredAuthSession();
    if (cached?.access_token && cached?.refresh_token) {
      try {
        const { data: setRes, error: setErr } = await supabase.auth.setSession({
          access_token: cached.access_token,
          refresh_token: cached.refresh_token
        });
        if (!setErr && setRes.session) {
          session = setRes.session;
          sessionError = null;
        }
      } catch (err) {
        console.warn('[Sync] Session recovery attempt deferred:', err);
      }
    }
  }

  return { session, sessionError };
}

/**
 * Synchronizes a batch of normalized trials to the designated Supabase table
 * using the official Supabase JavaScript client instance.
 * 
 * Guarantees:
 * 1. Checks active session before table write (aborts with local buffer retention if missing).
 * 2. Populates `auth_user_id` from `session.user.id`.
 * 3. Strips client-only metadata (id, client_id, synced, table_name) so PostgreSQL auto-generates BIGSERIAL primary keys.
 * 4. Retains trials in local buffer with `synced: false` upon any failure.
 */
export async function batchFlushNormalizedTrialsToSupabase(
  tableName: TargetTrialTable,
  trials: AnyNormalizedTrialPayload[],
  maxRetries: number = 3
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!trials || trials.length === 0) {
    return { success: true, count: 0 };
  }

  // 1. Verify Active Session Before Flushing
  const { session, sessionError } = await getActiveAuthSession();
  if (!session || sessionError) {
    console.warn('[Sync] No active session found. Retaining trials in local buffer.');
    return { success: false, count: 0, error: 'Session expired or not found' };
  }

  const authUserId = session.user.id;

  // 2. Sanitize Chunk and ensure auth_user_id is populated from session.user.id
  const sanitizedTrials = trials.map(t => {
    const copy: Record<string, unknown> = { ...t };
    copy.auth_user_id = authUserId;
    // Strip client-side tracking properties for BIGSERIAL primary key auto-increment
    delete copy.id;
    delete copy.client_id;
    delete copy.synced;
    delete copy.table_name;
    return copy;
  });

  const CHUNK_SIZE = 50;
  let totalFlushed = 0;

  for (let i = 0; i < sanitizedTrials.length; i += CHUNK_SIZE) {
    const sanitizedChunk = sanitizedTrials.slice(i, i + CHUNK_SIZE);
    let attempt = 0;
    let chunkSuccess = false;
    let lastError = '';

    while (attempt < maxRetries && !chunkSuccess) {
      attempt++;
      try {
        const { error } = await supabase
          .from(tableName)
          .insert(sanitizedChunk);

        if (!error) {
          chunkSuccess = true;
          totalFlushed += sanitizedChunk.length;
        } else {
          lastError = error.message || error.details || 'Insert error';
          console.warn(`[Sync] Insert chunk failed on ${tableName} (attempt ${attempt}/${maxRetries}):`, error);

          // If session is expired or invalid, stop retrying immediately to retain trials in buffer
          if (error.code === 'PGRST301' || error.message?.toLowerCase().includes('jwt') || error.message?.toLowerCase().includes('expired')) {
            break;
          }

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, attempt * 350));
          }
        }
      } catch (networkErr) {
        lastError = (networkErr as Error).message || 'Network unreachable';
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 350));
        }
      }
    }

    if (!chunkSuccess) {
      console.warn(`[Sync] Failed to insert trials into ${tableName}. Retaining in local buffer:`, lastError);
      return {
        success: false,
        count: totalFlushed,
        error: `Failed after ${attempt} attempts on ${tableName}: ${lastError}`
      };
    }
  }

  return { success: true, count: totalFlushed };
}

/**
 * Non-blocking fire-and-forget single trial push using the Supabase client.
 * Silently defers to batch flush if no active session or network error occurs.
 */
export async function fireAndForgetNormalizedTrialPush(
  tableName: TargetTrialTable,
  payload: AnyNormalizedTrialPayload
): Promise<void> {
  try {
    const { session } = await getActiveAuthSession();
    if (!session) {
      // Local buffer remains authoritative; silent return
      return;
    }

    const cleanPayload: Record<string, unknown> = { ...payload };
    cleanPayload.auth_user_id = session.user.id;
    delete cleanPayload.id;
    delete cleanPayload.client_id;
    delete cleanPayload.synced;
    delete cleanPayload.table_name;

    await supabase
      .from(tableName)
      .insert([cleanPayload]);
  } catch (err) {
    console.warn(`[Sync] Non-blocking push deferred for ${tableName} (retained in buffer):`, err);
  }
}

/**
 * Buffers a normalized trial locally into localStorage and IndexedDB with `synced: false`.
 * Triggers non-blocking background dispatch via Supabase client.
 */
export function bufferNormalizedTrialLocally(
  table: TargetTrialTable,
  payload: AnyNormalizedTrialPayload,
  sessionId: string
): void {
  try {
    const bufferKey = `TEMPLE_BUFFER_${sessionId}`;
    const raw = localStorage.getItem(bufferKey);
    const buffered: ClientBufferedTrial[] = raw ? JSON.parse(raw) : [];

    const clientId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `buf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const bufferedRecord: ClientBufferedTrial = {
      client_id: clientId,
      table_name: table,
      payload,
      synced: false,
      created_at: payload.recorded_at || new Date().toISOString()
    };

    buffered.push(bufferedRecord);
    localStorage.setItem(bufferKey, JSON.stringify(buffered));

    // Secondary IndexedDB buffer for zero drop-out guarantee
    bufferTrialInIDB({
      id: clientId,
      client_id: clientId,
      session_id: sessionId,
      table_name: table,
      payload,
      synced: false,
      created_at: bufferedRecord.created_at
    }).catch(() => {});

    // Fire-and-forget client push
    fireAndForgetNormalizedTrialPush(table, payload).catch(() => {});

    notifyStoreUpdate();
  } catch (err) {
    console.error('Failed to buffer normalized trial locally', err);
  }
}

/**
 * Chamber Session Flush:
 * Flushes all buffered trials for a chamber/session to Supabase.
 * 
 * Local Buffer Fallback:
 * If an insert fails for any reason (network error or session expired),
 * DOES NOT delete trials from localStorage or IndexedDB.
 * Trials remain marked as `synced: false` to be retried on next startup/sync.
 */
export async function flushChamberSession(sessionId: string, roomId: string): Promise<ChamberSealInfo> {
  const bufferKey = `TEMPLE_BUFFER_${sessionId}`;
  const raw = localStorage.getItem(bufferKey);
  let trials: any[] = raw ? JSON.parse(raw) : [];

  if (trials.length === 0) {
    const idbTrials = await getSessionTrialsFromIDB(sessionId);
    if (idbTrials.length > 0) {
      trials = idbTrials;
    }
  }

  let synced = false;
  let flushedCount = 0;

  if (trials.length > 0) {
    const isNormalized = trials.some(t => t.table_name && t.payload);

    if (isNormalized) {
      // Group unsynced trials by destination table
      const groups: Record<string, { record: ClientBufferedTrial; payload: AnyNormalizedTrialPayload }[]> = {};
      for (const item of trials) {
        if (item.table_name && item.payload && !item.synced) {
          const tbl = item.table_name;
          if (!groups[tbl]) groups[tbl] = [];
          groups[tbl].push({ record: item, payload: item.payload });
        }
      }

      const tableKeys = Object.keys(groups);
      if (tableKeys.length === 0) {
        // All already synced
        synced = true;
        flushedCount = trials.length;
      } else {
        let allGroupsSucceeded = true;
        for (const [table, items] of Object.entries(groups)) {
          const payloads = items.map(i => i.payload);
          const res = await batchFlushNormalizedTrialsToSupabase(table as TargetTrialTable, payloads);
          if (res.success) {
            flushedCount += res.count;
            items.forEach(i => {
              i.record.synced = true;
              (i.record as any).flushed_at = new Date().toISOString();
            });
          } else {
            allGroupsSucceeded = false;
            console.warn(`[Sync] Retaining ${items.length} un-synced trials for ${table} in local buffer.`);
          }
        }
        synced = allGroupsSucceeded;
      }
    }

    // Update local storage buffer with current sync statuses (never delete un-synced trials)
    localStorage.setItem(bufferKey, JSON.stringify(trials));

    // Update IndexedDB for synced trials
    const syncedIds = trials.filter(t => t.synced).map(t => t.client_id || t.id).filter(Boolean);
    if (syncedIds.length > 0) {
      markTrialsSyncedInIDB(syncedIds).catch(() => {});
    }
  }

  const sealInfo: ChamberSealInfo = {
    sessionId,
    roomId,
    flushedCount: flushedCount || trials.length,
    syncedToSupabase: synced,
    sealedAt: new Date().toISOString()
  };

  localStorage.setItem(`TEMPLE_SEAL_${sessionId}`, JSON.stringify(sealInfo));
  localStorage.setItem('TEMPLE_LATEST_SEAL', JSON.stringify(sealInfo));
  notifyStoreUpdate();

  return sealInfo;
}

/**
 * Background retry sync on window online event or app startup.
 * Exhaustively scans all session buffers in localStorage to flush pending trials.
 * Preserves un-synced records in local storage if session or network is unavailable.
 */
export async function triggerBackgroundSync(): Promise<{ synced: number; remaining: number }> {
  let totalSynced = 0;
  let totalRemaining = 0;

  try {
    const keys = Object.keys(localStorage);
    const bufferKeys = keys.filter(k => k.startsWith('TEMPLE_BUFFER_'));

    if (bufferKeys.length === 0) {
      return { synced: 0, remaining: 0 };
    }

    // Verify active session before attempting any table write
    const { session, sessionError } = await getActiveAuthSession();
    if (!session || sessionError) {
      console.warn('[Sync] Background sync deferred: no active session found. Retaining trials in local buffer.');
      return { synced: 0, remaining: bufferKeys.length };
    }

    for (const key of bufferKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      let items: any[] = [];
      try {
        items = JSON.parse(raw);
      } catch {
        continue;
      }

      const unSynced = items.filter(t => !t.synced);
      if (unSynced.length === 0) continue;

      const isNormalized = unSynced.some(t => t.table_name && t.payload);

      if (isNormalized) {
        const groups: Record<string, any[]> = {};
        for (const item of unSynced) {
          if (item.table_name && item.payload) {
            const tbl = item.table_name;
            if (!groups[tbl]) groups[tbl] = [];
            groups[tbl].push(item);
          }
        }

        for (const [table, groupItems] of Object.entries(groups)) {
          const payloads = groupItems.map(i => i.payload);
          const res = await batchFlushNormalizedTrialsToSupabase(table as TargetTrialTable, payloads);
          if (res.success) {
            totalSynced += groupItems.length;
            groupItems.forEach(i => {
              i.synced = true;
              i.flushed_at = new Date().toISOString();
            });
          } else {
            totalRemaining += groupItems.length;
          }
        }

        // Save updated states back to localStorage (un-synced remain synced: false)
        localStorage.setItem(key, JSON.stringify(items));

        const syncedIds = unSynced.filter(t => t.synced).map(t => t.client_id || t.id).filter(Boolean);
        if (syncedIds.length > 0) {
          markTrialsSyncedInIDB(syncedIds).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] Background sync error:', err);
  }

  return { synced: totalSynced, remaining: totalRemaining };
}

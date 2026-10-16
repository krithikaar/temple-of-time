/**
 * TEMPLE of Time - Local Store, Dynamic Sessions & Fail-Safe Buffering Engine
 * High-performance, zero-export psychophysics storage architecture with Supabase & IndexedDB.
 */

import { ParticipantProfile, PsychophysicsTrial, SessionResult, TaskShortcode, TempleAuthSession, WeatherSpireTrialLog, GrandParlorTrialLog, AviaryTapLog, MSITTrialLog, VaultArtifactsTrialLog, TargetTrialTable, AnyNormalizedTrialPayload, ClientBufferedTrial, ChamberSealInfo } from './types';
import { fireAndForgetTrialPush, batchFlushTrialsToSupabase } from './supabase';
import { bufferTrialInIDB, markTrialsSyncedInIDB, getSessionTrialsFromIDB } from './idb';
import {
  supabase,
  bufferNormalizedTrialLocally,
  flushChamberSession,
  triggerBackgroundSync,
  fireAndForgetNormalizedTrialPush,
  batchFlushNormalizedTrialsToSupabase
} from './dataSyncService';

export {
  supabase,
  bufferNormalizedTrialLocally,
  flushChamberSession,
  triggerBackgroundSync,
  fireAndForgetNormalizedTrialPush,
  batchFlushNormalizedTrialsToSupabase
};

export const AUTH_SESSION_KEY = 'TEMPLE_AUTH_SESSION';
export const USER_PROFILE_KEY = 'TEMPLE_USER_PROFILE';
export const LEGACY_PROFILE_KEY = 'temple_profile_data';
export const SUBJECT_ID_KEY = 'TEMPLE_SUBJECT_ID';
const LATEST_SESSION_KEY = 'temple_latest_session';
const SPIRE_LOGS_KEY = 'TEMPLE_SPIRE_LOGS';
const PARLOR_LOGS_KEY = 'TEMPLE_PARLOR_LOGS';
const AVIARY_LOGS_KEY = 'TEMPLE_AVIARY_LOGS';
const ROOM4_LOGS_KEY = 'TEMPLE_ROOM4_LOGS';
const ROOM5_LOGS_KEY = 'TEMPLE_ROOM5_LOGS';

type StateListener = () => void;
const listeners: Set<StateListener> = new Set();

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach(fn => fn());
}

/**
 * Subject ID Management: Immutable once created and locked in localStorage under TEMPLE_SUBJECT_ID
 */
export function getStoredSubjectId(): string | null {
  return localStorage.getItem(SUBJECT_ID_KEY);
}

export function lockSubjectId(id: string): void {
  const clean = id.trim();
  if (clean) {
    localStorage.setItem(SUBJECT_ID_KEY, clean);
  }
}

/**
 * Multi-day Session Persistence
 */
export function getStoredAuthSession(): TempleAuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse TEMPLE_AUTH_SESSION', e);
  }
  return null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('temple_store_update', () => notify());
}

export function saveAuthSession(session: TempleAuthSession, subjectId?: string): void {
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    if (session.access_token) {
      localStorage.setItem('TEMPLE_ACCESS_TOKEN', session.access_token);
    }
    if (session.user?.id) {
      localStorage.setItem('TEMPLE_AUTH_USER_ID', session.user.id);
    }
    if (subjectId) {
      lockSubjectId(subjectId);
    }
    if (session.access_token && session.refresh_token) {
      supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      }).catch(err => console.warn('[SupabaseClient] setSession deferred:', err));
    }
    notify();
  } catch (e) {
    console.error('Failed to save TEMPLE_AUTH_SESSION', e);
  }
}

/**
 * Gets active profile from TEMPLE_USER_PROFILE with fallback to legacy temple_profile_data
 */
export function getStoredUserProfile(): ParticipantProfile | null {
  try {
    const rawNew = localStorage.getItem(USER_PROFILE_KEY);
    if (rawNew) return JSON.parse(rawNew);
    const rawOld = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (rawOld) return JSON.parse(rawOld);
  } catch (e) {
    console.error('Failed to load profile', e);
  }
  return null;
}

/**
 * Returns rank title based on sessions and mastery
 */
export function calculateRankTitle(totalSessions: number, masteryAvg: number): string {
  if (totalSessions >= 15 || masteryAvg >= 90) return 'Master of the Celestial Wheel';
  if (totalSessions >= 10 || masteryAvg >= 75) return 'Scholar of Temporal Strata';
  if (totalSessions >= 6 || masteryAvg >= 60) return 'Disciple of the Astrolabe';
  if (totalSessions >= 3 || masteryAvg >= 40) return 'Adept of the Pendulum';
  return 'Initiate of the Chronometer';
}

/**
 * Gets active profile
 */
export function getProfile(): ParticipantProfile | null {
  return getStoredUserProfile();
}

export function saveProfile(profile: ParticipantProfile): void {
  lockSubjectId(profile.subject_id);
  const serialized = JSON.stringify(profile);
  localStorage.setItem(USER_PROFILE_KEY, serialized);
  localStorage.setItem(LEGACY_PROFILE_KEY, serialized);
  notify();
}

/**
 * Increments the longitudinal daily streak counter if the visit is on a new calendar day
 */
export function updateDailyStreakOnReturn(profile: ParticipantProfile): ParticipantProfile {
  const today = new Date().toISOString().split('T')[0];
  const lastActive = profile.last_active_date;

  if (!lastActive) {
    profile.streak_count = 1;
    profile.last_active_date = today;
  } else if (lastActive !== today) {
    const lastDate = new Date(lastActive);
    const currDate = new Date(today);
    const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) {
      profile.streak_count = (profile.streak_count || 1) + 1;
    } else if (diffDays > 1) {
      profile.streak_count = 1;
    }
    profile.last_active_date = today;
  }

  saveProfile(profile);
  return profile;
}

/**
 * Dynamic Session Naming Protocol:
 * Format: <Subject_ID>_<Task>_<Session_Number>
 * Automatically tracks and increments the session count per task in localStorage (TEMPLE_${Subject_ID}_${Task}_COUNT)
 */
export function startTaskSession(taskShortcode: TaskShortcode): string {
  const profile = getProfile();
  const subjectId = getStoredSubjectId() || profile?.subject_id || 'sub001';
  const countKey = `TEMPLE_${subjectId}_${taskShortcode}_COUNT`;
  const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10);
  const nextCount = currentCount + 1;
  localStorage.setItem(countKey, nextCount.toString());

  const sessionId = `${subjectId}_${taskShortcode}_${nextCount}`;
  localStorage.setItem('TEMPLE_ACTIVE_SESSION_ID', sessionId);
  return sessionId;
}

export function getActiveSessionId(): string {
  return localStorage.getItem('TEMPLE_ACTIVE_SESSION_ID') || `sub001_TASK_${Date.now()}`;
}

/**
 * Real-Time Per-Trial Buffering:
 * Immediately buffers the raw trial data into localStorage and IndexedDB (TEMPLE_BUFFER_${session_id}).
 * Then attempts a non-blocking fire-and-forget REST POST to Supabase while keeping the local buffer authoritative.
 */
/**
 * Legacy trial buffer helper
 */
export function bufferTrialLocally(sessionId: string, trial: PsychophysicsTrial): void {
  try {
    const bufferKey = `TEMPLE_BUFFER_${sessionId}`;
    const raw = localStorage.getItem(bufferKey);
    const buffered: PsychophysicsTrial[] = raw ? JSON.parse(raw) : [];
    buffered.push(trial);
    localStorage.setItem(bufferKey, JSON.stringify(buffered));

    // Secondary IndexedDB buffer for zero drop-out guarantee
    bufferTrialInIDB({
      ...trial,
      session_id: sessionId,
      synced: false
    }).catch(() => {});

    // Non-blocking fire-and-forget REST push
    fireAndForgetTrialPush({
      ...trial,
      session_id: sessionId
    });

    notify();
  } catch (err) {
    console.error('Failed to buffer trial locally', err);
  }
}

export function recordTrial(trial: PsychophysicsTrial): void {
  const activeSessionId = getActiveSessionId();
  bufferTrialLocally(activeSessionId, trial);
}

export function getSessionBufferedTrials(sessionId: string): PsychophysicsTrial[] {
  try {
    const raw = localStorage.getItem(`TEMPLE_BUFFER_${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestChamberSeal(): ChamberSealInfo | null {
  try {
    const raw = localStorage.getItem('TEMPLE_LATEST_SEAL');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Updates participant's daily streak upon session completion
 */
export function recordSessionCompletion(roomId: string, score: number): ParticipantProfile {
  let profile = getProfile();
  const today = new Date().toISOString().split('T')[0];
  const subjectId = getStoredSubjectId() || profile?.subject_id || 'sub001';

  if (!profile) {
    profile = {
      id: crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`,
      subject_id: subjectId,
      name: 'Arcane Initiate',
      player_name: 'Arcane Initiate',
      streak_count: 1,
      last_active_date: today,
      created_at: new Date().toISOString(),
      rank_title: 'Initiate of the Chronometer',
      total_sessions: 1,
      room_mastery: { [roomId]: score }
    };
  } else {
    const lastActive = profile.last_active_date;
    if (!lastActive) {
      profile.streak_count = 1;
    } else if (lastActive === today) {
      // Already completed today
    } else {
      const lastDate = new Date(lastActive);
      const currDate = new Date(today);
      const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        profile.streak_count += 1;
      } else {
        profile.streak_count = 1;
      }
    }

    profile.last_active_date = today;
    profile.total_sessions = (profile.total_sessions || 0) + 1;
    profile.room_mastery = profile.room_mastery || {};
    profile.room_mastery[roomId] = Math.max(profile.room_mastery[roomId] || 0, Math.round(score));

    const scores = Object.values(profile.room_mastery);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    profile.rank_title = calculateRankTitle(profile.total_sessions, avg);
  }

  saveProfile(profile);
  return profile;
}

export function saveLatestSession(session: SessionResult): void {
  localStorage.setItem(LATEST_SESSION_KEY, JSON.stringify(session));
}

export function getLatestSession(): SessionResult | null {
  try {
    const raw = localStorage.getItem(LATEST_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Task-specific buffered logs getters for chamber views
 */
export function recordWeatherSpireTrialLog(trial: WeatherSpireTrialLog): void {
  try {
    const raw = localStorage.getItem(SPIRE_LOGS_KEY);
    const logs: WeatherSpireTrialLog[] = raw ? JSON.parse(raw) : [];
    logs.push(trial);
    localStorage.setItem(SPIRE_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to log Weather Spire trial', err);
  }
}

export function recordGrandParlorTrialLog(trial: GrandParlorTrialLog): void {
  try {
    const raw = localStorage.getItem(PARLOR_LOGS_KEY);
    const logs: GrandParlorTrialLog[] = raw ? JSON.parse(raw) : [];
    logs.push(trial);
    localStorage.setItem(PARLOR_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to log Grand Parlor trial', err);
  }
}

export function recordAviaryTapLog(log: AviaryTapLog): void {
  try {
    const raw = localStorage.getItem(AVIARY_LOGS_KEY);
    const logs: AviaryTapLog[] = raw ? JSON.parse(raw) : [];
    logs.push(log);
    localStorage.setItem(AVIARY_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to log Aviary tap', err);
  }
}

export function recordMSITTrialLog(trial: MSITTrialLog): void {
  try {
    const raw = localStorage.getItem(ROOM4_LOGS_KEY);
    const logs: MSITTrialLog[] = raw ? JSON.parse(raw) : [];
    logs.push(trial);
    localStorage.setItem(ROOM4_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to log MSIT trial', err);
  }
}

export function recordVaultTrialLog(trial: VaultArtifactsTrialLog): void {
  try {
    const raw = localStorage.getItem(ROOM5_LOGS_KEY);
    const logs: VaultArtifactsTrialLog[] = raw ? JSON.parse(raw) : [];
    logs.push(trial);
    localStorage.setItem(ROOM5_LOGS_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to log Vault trial', err);
  }
}


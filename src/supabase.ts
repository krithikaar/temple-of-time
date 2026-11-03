/**
 * TEMPLE of Time - Live Supabase Integration & Psychophysics Storage Engine
 * Native Browser fetch() with zero external dependencies.
 */

import { ParticipantProfile, PsychophysicsTrial, TempleAuthSession, TargetTrialTable, AnyNormalizedTrialPayload } from './types';
import { saveAuthSession, getStoredAuthSession, saveProfile, getProfile, updateDailyStreakOnReturn } from './store';
import { supabase, fireAndForgetNormalizedTrialPush, batchFlushNormalizedTrialsToSupabase } from './dataSyncService';

export { supabase, fireAndForgetNormalizedTrialPush, batchFlushNormalizedTrialsToSupabase };

// LIVE BACKEND CONFIGURATION (SUPABASE + RLS)
export const SUPABASE_CONFIG = {
  baseUrl: "https://wltwbiwbmuxwepqorarq.supabase.co",
  anonKey: "sb_publishable_dC1a3bkX31-89kjDpqXr_w_7yUpOHvx"
};

/**
 * Standard Supabase REST API headers with dynamically injected Bearer token
 */
export function getSupabaseHeaders(customToken?: string): Record<string, string> {
  const accessToken = customToken || localStorage.getItem('TEMPLE_ACCESS_TOKEN') || SUPABASE_CONFIG.anonKey;
  return {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };
}

/**
 * Maps every Subject ID to an internal deterministic credential
 */
export function getSubjectCredentials(subjectId: string): { email: string; password: string } {
  const clean = subjectId.toLowerCase().trim();
  return {
    email: `${clean}@temple.study`,
    password: `Temple_Chrono_${clean}`
  };
}

/**
 * Silently refreshes the active session using the stored refresh_token
 */
export async function refreshSessionSilently(): Promise<TempleAuthSession | null> {
  const cached = getStoredAuthSession();
  if (!cached || !cached.refresh_token) return cached;

  try {
    const res = await fetch(`${SUPABASE_CONFIG.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: cached.refresh_token })
    });

    if (res.ok) {
      const data = await res.json();
      const updatedSession: TempleAuthSession = {
        access_token: data.access_token || cached.access_token,
        refresh_token: data.refresh_token || cached.refresh_token,
        expires_in: data.expires_in,
        expires_at: data.expires_at,
        token_type: data.token_type,
        user: data.user || cached.user
      };
      saveAuthSession(updatedSession);
      return updatedSession;
    }
  } catch (err) {
    console.warn('Silent session refresh deferred (retaining cached token):', err);
  }
  return cached;
}

/**
 * Internal password authentication helper
 */
async function loginWithPasswordGrant(email: string, password: string): Promise<TempleAuthSession | null> {
  try {
    const res = await fetch(`${SUPABASE_CONFIG.baseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore network failure
  }
  return null;
}

/**
 * Calculates the next unique Subject ID starting from TEMP-0001 onwards.
 * Queries the database RPC sequence or scans existing participants to guarantee monotonic continuity.
 */
export async function getNextSubjectId(): Promise<string> {
  // 1. Try atomic database sequence function (immune to RLS)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_next_subject_id');
    if (!rpcError && typeof rpcData === 'string' && /^TEMP-\d+$/i.test(rpcData.trim())) {
      const assignedId = rpcData.trim();
      const numMatch = assignedId.match(/^TEMP-(\d+)$/i);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        const curr = parseInt(localStorage.getItem('TEMPLE_MAX_TEMP_NUM') || '0', 10);
        localStorage.setItem('TEMPLE_MAX_TEMP_NUM', String(Math.max(curr, num)));
      }
      return assignedId;
    }
  } catch (err) {
    console.warn('[Supabase] RPC get_next_subject_id notice:', err);
  }

  // 2. Direct table query scanning all registered subject_ids
  let maxNum = 0;
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('subject_id')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const match = String(row.subject_id || '').trim().match(/^TEMP-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
  } catch (err) {
    console.warn('[Supabase] Deferred getNextSubjectId table lookup:', err);
  }

  // 3. Fallback: check highest sequence recorded in local storage
  const localStoredNum = parseInt(localStorage.getItem('TEMPLE_MAX_TEMP_NUM') || '0', 10);
  if (localStoredNum > maxNum) maxNum = localStoredNum;

  const nextNum = maxNum + 1;
  return `TEMP-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Searches Supabase participants by email across devices.
 * Uses SECURITY DEFINER RPC first (to bypass RLS restriction), then falls back to direct queries.
 */
export async function fetchParticipantByEmail(email: string): Promise<{
  subject_id: string;
  player_name: string;
  age: number;
  gender: string;
  email: string;
  created_at?: string;
  auth_user_id?: string;
  has_consented?: boolean;
  consented_at?: string | null;
} | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Try dedicated lookup RPC function (SECURITY DEFINER, completely immune to RLS)
  try {
    const { data: rpcRows, error: rpcErr } = await supabase
      .rpc('lookup_participant_by_email', { lookup_email: cleanEmail });

    if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
      const row = rpcRows[0];
      return {
        subject_id: row.subject_id,
        player_name: row.player_name,
        age: row.age,
        gender: row.gender,
        email: row.e_mail || cleanEmail,
        created_at: row.created_at,
        auth_user_id: row.auth_user_id,
        has_consented: Boolean(row.has_consented),
        consented_at: row.consented_at || null
      };
    }
  } catch (rpcErr) {
    console.warn('[Supabase] RPC lookup_participant_by_email notice:', rpcErr);
  }

  // 2. Direct query on e_mail column with case-insensitivity
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .ilike('e_mail', cleanEmail)
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        subject_id: row.subject_id,
        player_name: row.player_name,
        age: row.age,
        gender: row.gender,
        email: row.e_mail || cleanEmail,
        created_at: row.created_at,
        auth_user_id: row.auth_user_id,
        has_consented: Boolean(row.has_consented),
        consented_at: row.consented_at || null
      };
    }
  } catch (err) {
    console.warn('[Supabase] Direct e_mail query notice:', err);
  }

  // 3. Fallback query checking legacy gender JSON formatting if any
  try {
    const { data: legacyData } = await supabase
      .from('participants')
      .select('*')
      .ilike('gender', `%"email":"${cleanEmail}"%`)
      .limit(1);

    if (Array.isArray(legacyData) && legacyData.length > 0) {
      const row = legacyData[0];
      let parsedGender = 'Prefer not to say';
      try {
        const parsed = JSON.parse(row.gender);
        parsedGender = parsed.gender || parsedGender;
      } catch {
        parsedGender = row.gender || parsedGender;
      }
      return {
        subject_id: row.subject_id,
        player_name: row.player_name,
        age: row.age,
        gender: parsedGender,
        email: cleanEmail,
        created_at: row.created_at,
        auth_user_id: row.auth_user_id,
        has_consented: Boolean(row.has_consented),
        consented_at: row.consented_at || null
      };
    }
  } catch (err) {
    console.warn('[Supabase] Legacy format query notice:', err);
  }

  // 4. Fallback: check locally cached profile if on same device/browser
  const localProf = getProfile();
  if (localProf && localProf.email && localProf.email.toLowerCase() === cleanEmail) {
    return {
      subject_id: localProf.subject_id,
      player_name: localProf.player_name || localProf.name,
      age: localProf.age || 26,
      gender: localProf.gender || 'Prefer not to say',
      email: localProf.email,
      created_at: localProf.created_at,
      auth_user_id: localProf.auth_user_id,
      has_consented: Boolean(localProf.has_consented),
      consented_at: localProf.consented_at || null
    };
  }

  return null;
}

/**
 * Enrolls a new initiate using Supabase Anonymous Authentication.
 * Automatically assigns a unique Subject ID (starting from TEMP-0001 onwards).
 * Subject ID is immutable and permanently saved to Supabase with the e_mail column.
 */
export async function signUpNewInitiate(payload: {
  email: string;
  player_name: string;
  age: number;
  gender: string;
  assigned_subject_id?: string;
}): Promise<{ success: boolean; session?: TempleAuthSession; profile?: ParticipantProfile; error?: string }> {
  const cleanEmail = payload.email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  try {
    // Check if email is already registered across any device
    const existing = await fetchParticipantByEmail(cleanEmail);
    if (existing) {
      return {
        success: false,
        error: `Email "${cleanEmail}" is already registered with Subject ID "${existing.subject_id}". Please switch to "Returning Initiate" to sign in.`
      };
    }

    // Determine unique Subject ID starting from TEMP-0001 onwards
    let subjectId = await getNextSubjectId();

    // 1. Authenticate anonymously using Supabase client
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          email: cleanEmail,
          subject_id: subjectId,
          player_name: payload.player_name
        }
      }
    });
    if (authError) throw authError;

    if (!authData?.user) {
      throw new Error('Anonymous authentication did not return a user record.');
    }

    const authUserId = authData.user.id;

    const session: TempleAuthSession = {
      access_token: authData.session?.access_token || '',
      refresh_token: authData.session?.refresh_token || '',
      expires_in: authData.session?.expires_in,
      expires_at: authData.session?.expires_at,
      token_type: authData.session?.token_type || 'bearer',
      user: {
        id: authUserId,
        email: cleanEmail
      }
    };

    // Persist session locally and synchronize into Supabase JS client
    saveAuthSession(session, subjectId);

    // 2. Insert demographics into participants table in Supabase
    let insertSuccess = false;
    let attempts = 0;
    while (!insertSuccess && attempts < 25) {
      attempts++;
      const currentDemoPayload = {
        auth_user_id: authUserId,
        subject_id: subjectId,
        player_name: payload.player_name,
        age: Number(payload.age),
        gender: payload.gender,
        e_mail: cleanEmail,
        has_consented: false,
        consented_at: null
      };

      const { error: insertError } = await supabase
        .from('participants')
        .insert([currentDemoPayload]);

      if (!insertError) {
        insertSuccess = true;
      } else if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
        const fullErr = ((insertError.message || '') + ' ' + (insertError.details || '')).toLowerCase();
        if (fullErr.includes('e_mail') || fullErr.includes('email') || fullErr.includes('idx_participants_email')) {
          return {
            success: false,
            error: `Email "${cleanEmail}" is already registered. Please switch to "Returning Initiate" to sign in.`
          };
        }

        // Subject ID collision: increment to next available sequential number and retry
        const freshNext = await getNextSubjectId();
        const freshNum = parseInt(freshNext.replace(/^TEMP-/i, ''), 10) || 0;
        const seqMatch: RegExpMatchArray | null = subjectId.match(/^TEMP-(\d+)$/i);
        const currNum: number = seqMatch && seqMatch[1] ? parseInt(seqMatch[1], 10) : attempts;
        const nextNum: number = Math.max(freshNum, currNum + 1);
        subjectId = `TEMP-${String(nextNum).padStart(4, '0')}`;
      } else {
        console.warn('[Participants] Supabase client insert note:', insertError.message);
        await insertParticipantDemographics(currentDemoPayload, session.access_token);
        insertSuccess = true;
      }
    }

    // Save max sequence number locally
    const match = subjectId.match(/^TEMP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const curr = parseInt(localStorage.getItem('TEMPLE_MAX_TEMP_NUM') || '0', 10);
      localStorage.setItem('TEMPLE_MAX_TEMP_NUM', String(Math.max(curr, num)));
    }

    const today = new Date().toISOString().split('T')[0];
    const profile: ParticipantProfile = {
      id: authUserId,
      subject_id: subjectId,
      name: payload.player_name,
      player_name: payload.player_name,
      email: cleanEmail,
      age: Number(payload.age),
      gender: payload.gender,
      auth_user_id: authUserId,
      access_token: session.access_token,
      streak_count: 1,
      last_active_date: today,
      created_at: new Date().toISOString(),
      rank_title: 'Initiate of the Chronometer',
      total_sessions: 0,
      room_mastery: {},
      has_consented: false,
      consented_at: null
    };

    saveProfile(profile);
    return { success: true, session, profile };
  } catch (err) {
    console.error('Error during initiate enrollment:', err);
    return { success: false, error: (err as Error).message || 'Authentication error during initiate enrollment' };
  }
}

/**
 * Restores a returning initiate's session using their registered email address.
 * Looks up the email in Supabase to retrieve and restore their unique assigned Subject ID.
 */
export async function signInReturningInitiate(email: string): Promise<{
  success: boolean;
  session?: TempleAuthSession;
  profile?: ParticipantProfile;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter your registered email address.' };
  }

  try {
    // 1. Look up existing participant record in Supabase by email
    const existingRecord = await fetchParticipantByEmail(cleanEmail);

    if (!existingRecord) {
      return {
        success: false,
        error: `No initiate record was found for "${cleanEmail}". If you are a new initiate, select "New Initiate" to register.`
      };
    }

    const subjectId = existingRecord.subject_id;

    // Update highest sequence tracker so this device does not lag behind
    const match = subjectId.match(/^TEMP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const curr = parseInt(localStorage.getItem('TEMPLE_MAX_TEMP_NUM') || '0', 10);
      localStorage.setItem('TEMPLE_MAX_TEMP_NUM', String(Math.max(curr, num)));
    }

    // 2. Sign in anonymously to acquire an active Supabase JWT session
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          email: cleanEmail,
          subject_id: subjectId,
          player_name: existingRecord.player_name
        }
      }
    });
    if (authError) {
      console.warn('[ReturningInitiate] Anonymous session notice:', authError);
    }

    const authUserId = authData?.user?.id || existingRecord.auth_user_id || (crypto.randomUUID ? crypto.randomUUID() : `usr_${Date.now()}`);

    const session: TempleAuthSession = {
      access_token: authData?.session?.access_token || '',
      refresh_token: authData?.session?.refresh_token || '',
      expires_in: authData?.session?.expires_in,
      expires_at: authData?.session?.expires_at,
      token_type: authData?.session?.token_type || 'bearer',
      user: {
        id: authUserId,
        email: cleanEmail
      }
    };

    saveAuthSession(session, subjectId);

    // Retrieve local state if returning on same device
    const localProf = getProfile();
    const isSameSubject = localProf && localProf.subject_id.toLowerCase() === subjectId.toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    const profile: ParticipantProfile = {
      id: authUserId,
      subject_id: subjectId,
      name: existingRecord.player_name || subjectId,
      player_name: existingRecord.player_name || subjectId,
      email: cleanEmail,
      age: Number(existingRecord.age || 26),
      gender: existingRecord.gender || 'Prefer not to say',
      auth_user_id: authUserId,
      access_token: session.access_token,
      streak_count: isSameSubject ? localProf.streak_count : 1,
      last_active_date: isSameSubject ? localProf.last_active_date : today,
      created_at: isSameSubject ? localProf.created_at : (existingRecord.created_at || new Date().toISOString()),
      rank_title: isSameSubject ? localProf.rank_title : 'Initiate of the Chronometer',
      total_sessions: isSameSubject ? localProf.total_sessions : 0,
      room_mastery: isSameSubject ? localProf.room_mastery : {},
      has_consented: existingRecord.has_consented !== undefined ? Boolean(existingRecord.has_consented) : (isSameSubject ? Boolean(localProf.has_consented) : false),
      consented_at: existingRecord.consented_at ?? (isSameSubject ? localProf.consented_at : null)
    };

    const updatedProfile = updateDailyStreakOnReturn(profile);
    saveProfile(updatedProfile);

    return { success: true, session, profile: updatedProfile };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Network error while restoring initiate account' };
  }
}

/**
 * Updates an initiate's editable profile fields: name, age, gender, email.
 * Note: Subject ID is immutable and cannot be modified.
 */
export async function updateInitiateProfile(payload: {
  subject_id: string;
  email: string;
  player_name: string;
  age: number;
  gender: string;
}): Promise<{ success: boolean; profile?: ParticipantProfile; error?: string }> {
  const cleanEmail = payload.email.trim().toLowerCase();
  const subjectId = payload.subject_id.trim();

  if (!cleanEmail) {
    return { success: false, error: 'Email address cannot be empty.' };
  }

  try {
    // Update in Supabase participants table using e_mail column
    const { error: updateError } = await supabase
      .from('participants')
      .update({
        player_name: payload.player_name,
        age: Number(payload.age),
        gender: payload.gender,
        e_mail: cleanEmail
      })
      .eq('subject_id', subjectId);

    if (updateError) {
      console.warn('[Participants] Update note from Supabase:', updateError.message);
    }

    // Update local profile
    const current = getProfile();
    if (current) {
      const updated: ParticipantProfile = {
        ...current,
        name: payload.player_name,
        player_name: payload.player_name,
        email: cleanEmail,
        age: Number(payload.age),
        gender: payload.gender
      };
      saveProfile(updated);
      return { success: true, profile: updated };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update profile.' };
  }
}

/**
 * Records informed participant consent in Supabase and updates local storage.
 * Enforces has_consented = true and consented_at = NOW() (ISO timestamp).
 */
export async function recordParticipantConsent(subjectId: string): Promise<{
  success: boolean;
  consented_at: string;
  error?: string;
}> {
  const consentedAt = new Date().toISOString();
  let updatedInSupabase = false;
  let lastError = '';

  try {
    const { error } = await supabase
      .from('participants')
      .update({
        has_consented: true,
        consented_at: consentedAt
      })
      .eq('subject_id', subjectId);

    if (!error) {
      updatedInSupabase = true;
    } else {
      lastError = error.message;
      console.warn('[Consent] Supabase client update warning:', error.message);
    }
  } catch (err) {
    lastError = (err as Error).message;
    console.warn('[Consent] Supabase update catch:', err);
  }

  // Fallback REST PATCH if client-side query did not succeed
  if (!updatedInSupabase) {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.baseUrl}/rest/v1/participants?subject_id=eq.${encodeURIComponent(subjectId)}`, {
        method: 'PATCH',
        headers: getSupabaseHeaders(),
        body: JSON.stringify({
          has_consented: true,
          consented_at: consentedAt
        })
      });
      if (res.ok) {
        updatedInSupabase = true;
      }
    } catch (fetchErr) {
      console.warn('[Consent] REST fallback error:', fetchErr);
    }
  }

  // Update profile in local store
  const currentProfile = getProfile();
  if (currentProfile) {
    const updated: ParticipantProfile = {
      ...currentProfile,
      has_consented: true,
      consented_at: consentedAt
    };
    saveProfile(updated);
  }

  return { success: true, consented_at: consentedAt, error: updatedInSupabase ? undefined : lastError };
}

/**
 * Fetches demographic record from Supabase `participants` by subject_id
 */
async function fetchParticipantRecord(subjectId: string, customToken?: string): Promise<{
  player_name?: string;
  age?: number;
  gender?: string;
  created_at?: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('subject_id', subjectId)
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    const res = await fetch(`${SUPABASE_CONFIG.baseUrl}/rest/v1/participants?subject_id=eq.${encodeURIComponent(subjectId)}&select=*`, {
      method: 'GET',
      headers: getSupabaseHeaders(customToken)
    });
    if (res.ok) {
      const restData = await res.json();
      if (Array.isArray(restData) && restData.length > 0) {
        return restData[0];
      }
    }
  } catch {
    // Ignore network error during lookup
  }
  return null;
}

/**
 * Executes anonymous sign-in to acquire access_token and auth_user_id (legacy fallback)
 */
export async function performAnonymousSignUp(): Promise<{ accessToken: string; authUserId: string }> {
  const cachedToken = localStorage.getItem('TEMPLE_ACCESS_TOKEN');
  const cachedUser = localStorage.getItem('TEMPLE_AUTH_USER_ID');
  if (cachedToken && cachedUser) {
    return { accessToken: cachedToken, authUserId: cachedUser };
  }

  try {
    const { data: authData } = await supabase.auth.signInAnonymously();
    if (authData?.user && authData?.session) {
      localStorage.setItem('TEMPLE_ACCESS_TOKEN', authData.session.access_token);
      localStorage.setItem('TEMPLE_AUTH_USER_ID', authData.user.id);
      return { accessToken: authData.session.access_token, authUserId: authData.user.id };
    }
  } catch (err) {
    console.warn('Anonymous sign-up notice:', err);
  }

  const fallbackToken = SUPABASE_CONFIG.anonKey;
  const fallbackUser = localStorage.getItem('TEMPLE_AUTH_USER_ID') || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `anon_${Date.now()}`);
  localStorage.setItem('TEMPLE_ACCESS_TOKEN', fallbackToken);
  localStorage.setItem('TEMPLE_AUTH_USER_ID', fallbackUser);
  return { accessToken: fallbackToken, authUserId: fallbackUser };
}

/**
 * Inserts participant demographic profile into Supabase `participants` table
 */
export async function insertParticipantDemographics(payload: {
  auth_user_id: string;
  subject_id: string;
  player_name: string;
  age: number;
  gender: string;
}, customToken?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const endpoint = `${SUPABASE_CONFIG.baseUrl}/rest/v1/participants`;
    const headers = {
      ...getSupabaseHeaders(customToken),
      'Prefer': 'resolution=merge-duplicates'
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const msg = errJson?.message || errJson?.details || errJson?.hint || (await res.text().catch(() => 'Insert failed'));
      // Mirror to legacy profiles for backward compatibility
      await pushProfileToSupabaseLegacy(payload);
      return { success: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
    return { success: true };
  } catch (err) {
    await pushProfileToSupabaseLegacy(payload);
    return { success: false, error: (err as Error).message || 'Network offline' };
  }
}

/**
 * Legacy profile mirror fallback
 */
async function pushProfileToSupabaseLegacy(payload: {
  auth_user_id: string;
  subject_id: string;
  player_name: string;
  age: number;
  gender: string;
}): Promise<void> {
  try {
    await fetch(`${SUPABASE_CONFIG.baseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({
        id: payload.auth_user_id,
        subject_id: payload.subject_id,
        name: payload.player_name,
        age: payload.age
      })
    });
  } catch {
    // Ignore legacy mirror failures
  }
}

/**
 * Legacy fire-and-forget trial push
 */
export function fireAndForgetTrialPush(trial: PsychophysicsTrial): void {
  const payload = {
    id: trial.id,
    user_id: trial.user_id,
    room_id: trial.room_id,
    session_id: trial.session_id,
    trial_index: Number(trial.trial_index) || 0,
    stimulus_parameters: trial.stimulus_parameters || {},
    timing_data: trial.timing_data || {},
    user_response: trial.user_response || {},
    accuracy_or_score: Number(trial.accuracy_or_score) || 0,
    created_at: trial.created_at || new Date().toISOString()
  };

  fetch(`${SUPABASE_CONFIG.baseUrl}/rest/v1/psychophysics_trials`, {
    method: 'POST',
    headers: {
      ...getSupabaseHeaders(),
      'Prefer': 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

/**
 * Legacy batch flush of buffered trials
 */
export async function batchFlushTrialsToSupabase(
  trials: PsychophysicsTrial[],
  maxRetries: number = 3
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!trials || trials.length === 0) {
    return { success: true, count: 0 };
  }

  const sanitizedPayload = trials.map(t => ({
    id: String(t.id),
    user_id: String(t.user_id),
    room_id: String(t.room_id),
    session_id: t.session_id ? String(t.session_id) : null,
    trial_index: Number(t.trial_index) || 0,
    stimulus_parameters: t.stimulus_parameters || {},
    timing_data: t.timing_data || {},
    user_response: t.user_response || {},
    accuracy_or_score: Number(t.accuracy_or_score) || 0,
    created_at: t.created_at || new Date().toISOString()
  }));

  const CHUNK_SIZE = 50;
  let totalFlushed = 0;

  for (let i = 0; i < sanitizedPayload.length; i += CHUNK_SIZE) {
    const chunk = sanitizedPayload.slice(i, i + CHUNK_SIZE);
    let attempt = 0;
    let chunkSuccess = false;
    let lastError = '';

    while (attempt < maxRetries && !chunkSuccess) {
      attempt++;
      try {
        const res = await fetch(`${SUPABASE_CONFIG.baseUrl}/rest/v1/psychophysics_trials`, {
          method: 'POST',
          headers: {
            ...getSupabaseHeaders(),
            'Prefer': 'return=minimal,resolution=merge-duplicates'
          },
          body: JSON.stringify(chunk)
        });

        if (res.ok) {
          chunkSuccess = true;
          totalFlushed += chunk.length;
        } else {
          const errJson = await res.json().catch(() => null);
          lastError = errJson?.message || errJson?.details || (await res.text().catch(() => `HTTP ${res.status}`));
          
          if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
            const backoffMs = attempt * 350;
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          } else {
            break;
          }
        }
      } catch (networkErr) {
        lastError = (networkErr as Error).message || 'Network unreachable';
        if (attempt < maxRetries) {
          const backoffMs = attempt * 350;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!chunkSuccess) {
      return {
        success: false,
        count: totalFlushed,
        error: `Failed after ${attempt} attempts: ${lastError}`
      };
    }
  }

  return { success: true, count: totalFlushed };
}

/**
 * Verifies live Supabase connectivity using the official Supabase client
 */
export async function testSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const { error } = await supabase.from('participants').select('id', { count: 'exact', head: true });
    if (!error) {
      return { connected: true, message: 'Supabase Client live & operational.' };
    } else {
      return { connected: false, message: `Supabase status: ${error.message}` };
    }
  } catch (err) {
    return { connected: false, message: (err as Error).message || 'Connection timed out' };
  }
}

/**
 * Production PostgreSQL database schema with normalized tables & RLS
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- TEMPLE of Time: Production Database Schema (Supabase PostgreSQL + RLS)
-- Project: wltwbiwbmuxwepqorarq.supabase.co
-- ==============================================================================

-- 1. Participants Table
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT UNIQUE NOT NULL,
    player_name TEXT NOT NULL,
    age INT NOT NULL,
    gender TEXT NOT NULL,
    e_mail TEXT,
    has_consented BOOLEAN DEFAULT false NOT NULL,
    consented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration for existing installations:
-- ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS has_consented BOOLEAN DEFAULT false;
-- ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_participants_subject_id ON public.participants(subject_id);

-- 2. Task 1: Simultaneity & Temporal Order (SJ)
CREATE TABLE IF NOT EXISTS public.trials_sj (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'SJ',
    session TEXT NOT NULL,             -- e.g., 'sub001_SJ_1'
    trial_number INT NOT NULL,
    response INT NOT NULL,             -- 1 = audio first, 3 = simultaneous, 5 = visual first
    confidence INT NOT NULL,           -- 0 to 100
    soa NUMERIC NOT NULL,              -- negative: visual first, 0: sim, positive: audio first
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_sj_subject ON public.trials_sj(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_sj_session ON public.trials_sj(session);

-- 3. Task 2: Sense of Agency (SOA)
CREATE TABLE IF NOT EXISTS public.trials_soa (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'SOA',
    session TEXT NOT NULL,             -- e.g., 'sub001_SOA_1'
    trial_number INT NOT NULL,
    response INT NOT NULL,             -- 1 if <= 50, 5 if > 50
    confidence INT NOT NULL,           -- 0 to 100
    delay NUMERIC NOT NULL,            -- 0 to 1400 in steps of 140
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_soa_subject ON public.trials_soa(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_soa_session ON public.trials_soa(session);

-- 4. Task 3: Spontaneous Motor Tempo (SMT)
CREATE TABLE IF NOT EXISTS public.trials_smt (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'SMT',
    session TEXT NOT NULL,             -- e.g., 'sub001_SMT_1'
    tap_index INT NOT NULL,
    rt NUMERIC NOT NULL,               -- tap-to-tap interval (ms)
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_smt_subject ON public.trials_smt(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_smt_session ON public.trials_smt(session);

-- 5. Task 4: Time Production (TP)
CREATE TABLE IF NOT EXISTS public.trials_tp (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'TP',
    session TEXT NOT NULL,             -- e.g., 'sub001_TP_1'
    trial_number INT NOT NULL,
    rt NUMERIC NOT NULL,               -- produced duration / reaction time (ms)
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_tp_subject ON public.trials_tp(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_tp_session ON public.trials_tp(session);

-- 6. Task 5: Delay Discounting (DD)
CREATE TABLE IF NOT EXISTS public.trials_dd (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'DD',
    session TEXT NOT NULL,             -- e.g., 'sub001_DD_1'
    trial_number INT NOT NULL,
    delay_option INT NOT NULL,         -- 7, 15, 30, 60
    immediate_reward_option INT NOT NULL, -- 100, 400, 700
    reaction_time NUMERIC NOT NULL,    -- ms
    response_chosen TEXT NOT NULL,     -- 'immediate' | 'delayed'
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_dd_subject ON public.trials_dd(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_dd_session ON public.trials_dd(session);

-- 7. Task 6: Multi-Source Interference Task (MSIT)
CREATE TABLE IF NOT EXISTS public.trials_msit (
    id BIGSERIAL PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id),
    subject_id TEXT NOT NULL,
    task TEXT DEFAULT 'MSIT',
    session TEXT NOT NULL,             -- e.g., 'sub001_MSIT_1'
    trial_number INT NOT NULL,
    stimulus_presented TEXT NOT NULL,  -- e.g., '100', '331'
    trial_type TEXT NOT NULL,          -- 'control' | 'simon' | 'flanker' | 'multisource'
    accuracy INT NOT NULL,             -- 0 if wrong, 1 if right
    reaction_time NUMERIC NOT NULL,    -- ms
    recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trials_msit_subject ON public.trials_msit(subject_id);
CREATE INDEX IF NOT EXISTS idx_trials_msit_session ON public.trials_msit(session);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_sj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_soa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_smt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_tp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_dd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials_msit ENABLE ROW LEVEL SECURITY;

-- Allow cross-device read/insert/update for both anon and authenticated users
DROP POLICY IF EXISTS "Allow participant insert" ON public.participants;
DROP POLICY IF EXISTS "Allow participant read" ON public.participants;
DROP POLICY IF EXISTS "Allow participant update" ON public.participants;

CREATE POLICY "Allow participant insert" ON public.participants FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow participant read" ON public.participants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow participant update" ON public.participants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Automatic Deduplication of Repeated Email Rows (keeps earliest record)
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(e_mail)) ORDER BY created_at ASC, id ASC) AS rn
    FROM public.participants WHERE e_mail IS NOT NULL AND TRIM(e_mail) <> ''
)
DELETE FROM public.participants WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Unique index on email to prevent duplicate accounts
DROP INDEX IF EXISTS public.idx_participants_email_unique;
CREATE UNIQUE INDEX idx_participants_email_unique ON public.participants (LOWER(TRIM(e_mail))) WHERE e_mail IS NOT NULL AND TRIM(e_mail) <> '';

-- Sequence generation function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_next_subject_id()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE next_val INT;
BEGIN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(subject_id, '^TEMP-0*', '', 'i'), '')::INT), 0) + 1 INTO next_val
    FROM public.participants WHERE subject_id ~* '^TEMP-\d+$';
    RETURN 'TEMP-' || lpad(next_val::TEXT, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_next_subject_id() TO anon, authenticated, service_role;

-- Account recovery function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.lookup_participant_by_email(lookup_email TEXT)
RETURNS SETOF public.participants LANGUAGE sql SECURITY DEFINER AS $$
    SELECT * FROM public.participants
    WHERE LOWER(TRIM(e_mail)) = LOWER(TRIM(lookup_email))
    ORDER BY created_at ASC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_participant_by_email(TEXT) TO anon, authenticated, service_role;

CREATE POLICY "Allow insert trials_sj" ON public.trials_sj FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_sj" ON public.trials_sj FOR SELECT USING (true);

CREATE POLICY "Allow insert trials_soa" ON public.trials_soa FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_soa" ON public.trials_soa FOR SELECT USING (true);

CREATE POLICY "Allow insert trials_smt" ON public.trials_smt FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_smt" ON public.trials_smt FOR SELECT USING (true);

CREATE POLICY "Allow insert trials_tp" ON public.trials_tp FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_tp" ON public.trials_tp FOR SELECT USING (true);

CREATE POLICY "Allow insert trials_dd" ON public.trials_dd FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_dd" ON public.trials_dd FOR SELECT USING (true);

CREATE POLICY "Allow insert trials_msit" ON public.trials_msit FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read trials_msit" ON public.trials_msit FOR SELECT USING (true);
`;

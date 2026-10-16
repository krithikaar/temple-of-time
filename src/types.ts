/**
 * TEMPLE of Time - Psychophysics Battery Types & Data Models
 */

export type ScreenState = 'auth' | 'dashboard' | 'task_arena' | 'feedback';

export type TaskShortcode = 'SJ' | 'SOA' | 'SMT' | 'TP' | 'DD' | 'MSIT';

export interface TempleAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  };
}

export interface ParticipantProfile {
  id: string;
  subject_id: string;
  name: string;
  email?: string;
  player_name?: string;
  age?: number;
  gender?: string;
  handedness?: 'right' | 'left' | 'ambidextrous';
  auth_user_id?: string;
  access_token?: string;
  streak_count: number;
  last_active_date: string; // YYYY-MM-DD
  created_at: string;
  rank_title: string;
  total_sessions: number;
  room_mastery: Record<string, number>; // roomId -> percentage (0-100)
}

export interface PsychophysicsTrial {
  id: string;
  user_id: string;
  room_id: string;
  session_id?: string;
  synced?: boolean;
  flushed_at?: string;
  trial_index: number;
  stimulus_parameters: {
    programmed_delay_ms: number;
    tone_frequency_hz: number;
    is_catch_trial?: boolean;
    iti_duration_ms?: number;
    [key: string]: unknown;
  };
  timing_data: {
    stimulus_onset_perf: number;
    response_perf: number;
    reaction_time_ms: number;
    audio_dispatch_perf: number;
    actual_measured_delay_ms: number;
    [key: string]: unknown;
  };
  user_response: {
    agency_rating: number; // 0 - 100
    estimated_delay_ms?: number;
    binding_delta_ms?: number;
    [key: string]: unknown;
  };
  accuracy_or_score: number; // 0 - 100
  created_at: string;
}

export interface ChamberDefinition {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  timescale: string;
  paradigm: string;
  description: string;
  instructions: string[];
  scientificObjective: string;
  status: 'active' | 'coming_soon';
  masteryThreshold: number;
  iconName: string;
}

export interface SessionResult {
  roomId: string;
  roomName: string;
  trials: PsychophysicsTrial[];
  masteryScore: number;
  meanReactionTimeMs: number;
  meanAgencyShortDelay: number;
  meanAgencyLongDelay: number;
  bindingEffectMagnitude: number;
  completedAt: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
}

export interface SyncQueueItem {
  id: string;
  type: 'profile' | 'trial';
  data: ParticipantProfile | PsychophysicsTrial;
  createdAt: string;
  retryCount: number;
}

export type GroundTruthCondition = 'audio_first' | 'simultaneous' | 'visual_first' | 'sound_first' | 'light_first';
export type ParticipantChoice = 'sound_first' | 'simultaneous' | 'light_first' | 'audio_first' | 'visual_first';

export interface WeatherSpireTrialLog {
  trial_index: number;
  user_id: string;
  chamber: 'Room_1_Weather_Spire';
  soa_ms: number;
  ground_truth_condition: GroundTruthCondition;
  participant_choice: ParticipantChoice;
  confidence_pct: number;
  reaction_time_ms: number;
  timestamp: string;
}

export interface WeatherSpireSessionResult {
  roomId: string;
  roomName: string;
  totalTrials: number;
  simultaneityRatePct: number;
  meanReactionTimeMs: number;
  meanConfidencePct: number;
  trials: WeatherSpireTrialLog[];
  completedAt: string;
}

export type ChessPieceAllegiance = 'white_knight' | 'black_rook';

export interface GrandParlorTrialLog {
  trial_index: number;
  user_id: string;
  chamber: 'Room_2_Grand_Parlor';
  assigned_piece: ChessPieceAllegiance;
  origin_square: number;
  destination_square: number;
  programmed_delay_ms: number;
  measured_delay_ms: number;
  attribution_rating: number; // 0 to 100
  slider_initial_random_pos: number;
  response_time_ms: number;
  timestamp: string;
}

export interface GrandParlorSessionResult {
  roomId: string;
  roomName: string;
  totalTrials: number;
  meanAttribution: number;
  meanResponseTimeMs: number;
  assignedPiece: ChessPieceAllegiance;
  trials: GrandParlorTrialLog[];
  completedAt: string;
}

export type AviaryFamiliar = 'celestial_owl' | 'storm_raven' | 'sun_hawk';

export interface AviaryTapLog {
  trial_index: number;
  user_id: string;
  chamber: 'Room_3_The_Aviary';
  sub_task: 'SMT' | '3S_PROD';
  block_type: 'free' | 'practice_feedback' | 'test_silent';
  tap_index: number;
  timestamp_perf_now: number;
  inter_tap_interval_ms: number | null;
  target_interval_ms: number | null;
  chosen_familiar: AviaryFamiliar;
  date_iso: string;
}

export interface AviarySessionResult {
  roomId: string;
  roomName: string;
  chosenFamiliar: AviaryFamiliar;
  smtMeanItiMs: number;
  smtCv: number;
  prodMeanIntervalMs: number;
  prodAccuracyErrorMs: number;
  totalTaps: number;
  logs: AviaryTapLog[];
  completedAt: string;
}

export type MSITCondition = 'control' | 'simon' | 'flanker' | 'multisource';

export interface MSITTrialLog {
  trial_number: number;
  participant_id: string;
  room_id: 'room_4_msit';
  miniblock_id: number;
  condition: MSITCondition;
  stimulus: string;
  target_digit: number;
  response_digit: number | null;
  correct: boolean;
  rt_ms: number | null;
  is_practice: boolean;
  timestamp: string;
}

export interface MSITConditionMetrics {
  count: number;
  accuracyPct: number;
  meanRtMs: number;
  interferenceCostMs: number;
}

export interface MSITSessionResult {
  roomId: string;
  roomName: string;
  totalTrials: number;
  overallAccuracyPct: number;
  medianRtMs: number;
  conditionBreakdown: Record<MSITCondition, MSITConditionMetrics>;
  trials: MSITTrialLog[];
  completedAt: string;
}

export type VaultAvatar = 'chrono_warden' | 'astral_scout' | 'void_seeker' | 'solar_courier';
export type DelayChoice = 'immediate' | 'delayed';

export interface VaultArtifactsTrialLog {
  trial_number: number;
  participant_id: string;
  room_id: 'room_5_delay_discounting';
  character_chosen: VaultAvatar;
  delayed_lane_duration_s: number; // 7, 15, 30, 60
  immediate_reward_coins: number; // 100, 400, 700
  delayed_reward_coins: number; // 1000
  choice_made: DelayChoice; // 'immediate' | 'delayed'
  chosen_delay_s: number; // 0, 7, 15, 30, 60
  chosen_reward_coins: number;
  decision_rt_ms: number;
  total_accumulated_score: number;
  timestamp: string;
}

export interface VaultArtifactsSessionResult {
  roomId: string;
  roomName: string;
  totalTrials: number;
  totalCoins: number;
  percentPatientChoices: number;
  meanDecisionRtMs: number;
  characterChosen: VaultAvatar;
  byDelay: Record<number, { trials: number; patientCount: number; patientPct: number }>;
  byImmediateReward: Record<number, { trials: number; patientCount: number; patientPct: number }>;
  trials: VaultArtifactsTrialLog[];
  completedAt: string;
}

/* ==============================================================================
   PRODUCTION SUPABASE NORMALIZED TABLES & PAYLOAD DEFINITIONS
   ============================================================================== */

export type TargetTrialTable =
  | 'trials_sj'
  | 'trials_soa'
  | 'trials_smt'
  | 'trials_tp'
  | 'trials_dd'
  | 'trials_msit';

/**
 * Task 1: Simultaneity & Temporal Order (SJ)
 * Target Table: trials_sj
 */
export interface SJTrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'SJ';
  session: string; // e.g., 'sub001_SJ_1'
  trial_number: number;
  response: number; // 1 = audio first, 3 = simultaneous, 5 = visual first
  confidence: number; // 0 to 100
  soa: number; // negative: visual first, 0: simultaneous, positive: audio first
  recorded_at: string; // TIMESTAMPTZ ISO string
}

/**
 * Task 2: Sense of Agency (SOA)
 * Target Table: trials_soa
 */
export interface SOATrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'SOA';
  session: string; // e.g., 'sub001_SOA_1'
  trial_number: number;
  response: number; // 1 if <= 50, 5 if > 50
  confidence: number; // 0 to 100
  delay: number; // 0 to 1400 in steps of 140
  recorded_at: string; // TIMESTAMPTZ ISO string
}

/**
 * Task 3: Spontaneous Motor Tempo (SMT)
 * Target Table: trials_smt
 */
export interface SMTTrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'SMT';
  session: string; // e.g., 'sub001_SMT_1'
  tap_index: number;
  rt: number; // tap-to-tap interval (ms)
  recorded_at: string; // TIMESTAMPTZ ISO string
}

/**
 * Task 4: Time Production (TP)
 * Target Table: trials_tp
 */
export interface TPTrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'TP';
  session: string; // e.g., 'sub001_TP_1'
  trial_number: number;
  rt: number; // produced duration / reaction time (ms)
  recorded_at: string; // TIMESTAMPTZ ISO string
}

/**
 * Task 5: Delay Discounting (DD)
 * Target Table: trials_dd
 */
export interface DDTrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'DD';
  session: string; // e.g., 'sub001_DD_1'
  trial_number: number;
  delay_option: number; // 7, 15, 30, 60
  immediate_reward_option: number; // 100, 400, 700
  reaction_time: number; // ms
  response_chosen: 'immediate' | 'delayed';
  recorded_at: string; // TIMESTAMPTZ ISO string
}

/**
 * Task 6: Multi-Source Interference Task (MSIT)
 * Target Table: trials_msit
 */
export interface MSITTrialPayload {
  auth_user_id: string; // UUID references auth.users(id)
  subject_id: string;
  task: 'MSIT';
  session: string; // e.g., 'sub001_MSIT_1'
  trial_number: number;
  stimulus_presented: string; // e.g., '100', '331'
  trial_type: 'control' | 'simon' | 'flanker' | 'multisource';
  accuracy: number; // 0 if wrong, 1 if right
  reaction_time: number; // ms
  recorded_at: string; // TIMESTAMPTZ ISO string
}

export type AnyNormalizedTrialPayload =
  | SJTrialPayload
  | SOATrialPayload
  | SMTTrialPayload
  | TPTrialPayload
  | DDTrialPayload
  | MSITTrialPayload;

/**
 * Envelope for client-side crash buffer (localStorage & IndexedDB)
 * Retains client_id for local tracking; stripped before flushing to Supabase
 */
export interface ClientBufferedTrial<T = AnyNormalizedTrialPayload> {
  client_id: string;
  table_name: TargetTrialTable;
  payload: T;
  synced: boolean;
  created_at: string;
}

export interface ChamberSealInfo {
  sessionId: string;
  roomId: string;
  flushedCount: number;
  syncedToSupabase: boolean;
  sealedAt: string;
}




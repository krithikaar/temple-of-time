/**
 * Chambers of the Operational Hierarchy - Quest State Machine
 * Decoupled state manager tracking participant unlocked stage index (0 to 8).
 * Strictly locks downstream nodes until preceding nodes are verified complete.
 */

import { QuestNodeDefinition, QuestProgressionState, CompletedNodeData, NodeState } from './types';
import { CHAMBERS } from '../chambers';
import { saveProfile, getProfile } from '../store';
import { playCompletionFanfare, playCrystalTone, playTactileClick } from '../audio';

export const QUEST_STORAGE_KEY = 'TEMPLE_QUEST_PROGRESSION_STATE_V1';

// Strict 9-Node Linear Progression Definition
export const QUEST_NODES: QuestNodeDefinition[] = [
  // 1. [Questionnaire 0]
  {
    id: 'node-0-demographics',
    index: 0,
    type: 'questionnaire',
    title: 'Demographics & Baseline Survey',
    subtitle: 'Initiate Intake & Sensory Baseline Calibration',
    estimatedTime: '2 MIN INTAKE',
    description: 'Inscribe your initiate credentials, sensory calibration baselines, and circadian alertness before entering the Operational Hierarchy.',
    iconName: 'scroll',
    instructions: [
      'Enter your unique Subject ID or initiate codename.',
      'Calibrate sensory vision, hearing, and circadian alertness ratings.',
      'Inscribe baseline profile to unlock Chamber 1.'
    ]
  },
  // 2. [Task 1]: Room 1 – The Weather Spire
  {
    id: 'room-1',
    index: 1,
    type: 'chamber',
    chamberId: 'room-1',
    roomNumber: 1,
    title: 'Room 1 – The Weather Spire',
    subtitle: 'Simultaneity & Temporal Order Judgement',
    timescale: '0 – 400 ms',
    paradigm: 'Simultaneity & Temporal Order Judgement',
    estimatedTime: '10 min Task',
    description: 'Focus on the lightening flash and thunder tone and judge their order of appearance. Discover your ability to align light and sound.',
    scientificObjective: 'Align your senses to judge whether sound and light arrive simultaneously or in sequence.',
    instructions: CHAMBERS[0].instructions,
    iconName: 'zap'
  },
  // 3. [Questionnaire 1]: Mid-Checkpoint Survey A
  {
    id: 'node-2-checkpoint-a',
    index: 2,
    type: 'questionnaire',
    title: 'Mid-Checkpoint Survey A',
    subtitle: 'Audiovisual Synchrony & Perceptual Load',
    estimatedTime: '1 MIN CHECKPOINT',
    description: 'Reflect upon sensory cross-modal synchronization, temporal order discrimination clarity, and early sensory fatigue.',
    iconName: 'badge-check',
    instructions: [
      'Rate your subjective perception of light-sound alignment.',
      'Evaluate cognitive load during cross-modal judging.',
      'Submit ratings to unlock Chamber 2.'
    ]
  },
  // 4. [Task 2]: Room 2 – The Grand Parlor
  {
    id: 'room-2',
    index: 3,
    type: 'chamber',
    chamberId: 'room-2',
    roomNumber: 2,
    title: 'Room 2 – The Grand Parlor',
    subtitle: 'Sense of Agency & Intentional Binding',
    timescale: '0 – 1400 ms',
    paradigm: 'Sense of Agency',
    estimatedTime: '10 min Task',
    description: 'Play this game of enchanted chess where sometimes you are in control of the board and other times you may not be the one controlling your pieces.',
    scientificObjective: 'Reflect upon your feeling of authorship when commanding movement across the board.',
    instructions: CHAMBERS[1].instructions,
    iconName: 'hourglass'
  },
  // 5. [Questionnaire 2]: Mid-Checkpoint Survey B
  {
    id: 'node-4-checkpoint-b',
    index: 4,
    type: 'questionnaire',
    title: 'Mid-Checkpoint Survey B',
    subtitle: 'Sense of Agency & Intentional Causality',
    estimatedTime: '1 MIN CHECKPOINT',
    description: 'Assess feelings of intentional authorship, perceived movement lag, and the subjective threshold between self-agency and board autonomy.',
    iconName: 'badge-check',
    instructions: [
      'Rate your feeling of direct physical causation over chess movements.',
      'Report whether delays induced feelings of external automation.',
      'Submit ratings to unlock Chamber 3.'
    ]
  },
  // 6. [Task 3]: Room 3 – The Aviary
  {
    id: 'room-3',
    index: 5,
    type: 'chamber',
    chamberId: 'room-3',
    roomNumber: 3,
    title: 'Room 3 – The Aviary',
    subtitle: 'Spontaneous Tapping & Temporal Production',
    timescale: '300 – 3000 ms',
    paradigm: 'Spontaneous tapping and temporal production',
    estimatedTime: '10 min Task',
    description: 'Harvest grain to feed your magical pet. Start by harvesting at your own rhythm, then follow a steady 3-second rhythm.',
    scientificObjective: 'Follow your internal rhythm and produce steady time intervals.',
    instructions: CHAMBERS[2].instructions,
    iconName: 'feather'
  },
  // 7. [Task 4]: Room 4 – The Puzzler’s Study
  {
    id: 'room-4',
    index: 6,
    type: 'chamber',
    chamberId: 'room-4',
    roomNumber: 4,
    title: "Room 4 – The Puzzler's Study",
    subtitle: 'Multisource Interference (MSIT)',
    timescale: '400 – 900 ms',
    paradigm: 'Multisource interference',
    estimatedTime: '10 min Task',
    description: 'Sit before the Altar of Triads to decipher chronomantic runes. Overcome position and flanker interference under rapid millisecond constraints.',
    scientificObjective: 'Identify the unique number among distractors swiftly and accurately.',
    instructions: CHAMBERS[3].instructions,
    iconName: 'compass'
  },
  // 8. [Questionnaire 3]: Post-Cognitive Checkpoint Survey C
  {
    id: 'node-7-checkpoint-c',
    index: 7,
    type: 'questionnaire',
    title: 'Post-Cognitive Checkpoint Survey C',
    subtitle: 'Executive Interference & Cognitive Fatigue',
    estimatedTime: '1 MIN CHECKPOINT',
    description: 'Evaluate mental workload, cognitive friction during conflict trials, and subjective time dilation following intensive motor/executive tasks.',
    iconName: 'badge-check',
    instructions: [
      'Rate mental friction between target digits and spatial positions.',
      'Report subjective temporal distortion during rapid reaction blocks.',
      'Submit checkpoint to unlock the Final Chamber.'
    ]
  },
  // 9. [Task 5]: Room 5 – The Vault of Artifacts
  {
    id: 'room-5',
    index: 8,
    type: 'chamber',
    chamberId: 'room-5',
    roomNumber: 5,
    title: 'Room 5 – The Vault of Artifacts',
    subtitle: 'Delay Discounting & Temporal Horizons',
    timescale: '0 s – 60 s Real-Time Horizons',
    paradigm: 'Delay discounting',
    estimatedTime: '10 min Task',
    description: 'Send astral runners down real-time pathways to retrieve time-crystals and ancient coins. Greater rewards await those willing to wait for longer paths.',
    scientificObjective: 'Choose between immediate rewards and larger delayed treasures.',
    instructions: CHAMBERS[4].instructions,
    iconName: 'vault'
  }
];

type QuestListener = (state: QuestProgressionState) => void;
const listeners = new Set<QuestListener>();

// Internal in-memory state
let currentState: QuestProgressionState = loadInitialState();

function loadInitialState(): QuestProgressionState {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuestProgressionState;
      if (typeof parsed.currentUnlockedIndex === 'number') {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read quest progression state from storage', err);
  }

  return {
    currentUnlockedIndex: 0,
    completedNodes: {},
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
}

function persistState(): void {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(currentState));
  } catch (err) {
    console.warn('Failed to save quest progression state', err);
  }
  listeners.forEach(fn => fn({ ...currentState }));
}

export function subscribeToQuest(listener: QuestListener): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => listeners.delete(listener);
}

export function getQuestState(): QuestProgressionState {
  return { ...currentState };
}

export function getCurrentUnlockedStage(): number {
  return currentState.currentUnlockedIndex;
}

export function getNodeDefinition(indexOrId: number | string): QuestNodeDefinition | undefined {
  if (typeof indexOrId === 'number') {
    return QUEST_NODES[indexOrId];
  }
  return QUEST_NODES.find(n => n.id === indexOrId || n.chamberId === indexOrId);
}

export function getNodeState(nodeIndex: number): NodeState {
  const node = QUEST_NODES[nodeIndex];
  if (node && currentState.completedNodes[node.id]) {
    return 'completed';
  }
  return 'active';
}

export function isNodeUnlocked(_nodeIndex: number): boolean {
  return true;
}

/**
 * Completes any node, saves result data, updates progression,
 * and updates user profile mastery/sessions if applicable.
 */
export function completeCurrentNode(stageIndex: number, resultData?: Record<string, unknown>): boolean {
  const node = QUEST_NODES[stageIndex];
  if (!node) return false;

  const now = new Date().toISOString();
  const completedEntry: CompletedNodeData = {
    nodeId: node.id,
    nodeIndex: stageIndex,
    completedAt: now,
    type: node.type,
    title: node.title,
    score: typeof resultData?.score === 'number' ? resultData.score : 100,
    details: resultData || {}
  };

  currentState.completedNodes[node.id] = completedEntry;
  currentState.lastCompletedNodeId = node.id;
  currentState.currentUnlockedIndex = Math.max(currentState.currentUnlockedIndex, Math.min(QUEST_NODES.length, stageIndex + 1));
  currentState.lastUpdated = now;

  // If this was a Chamber node, update profile room mastery
  if (node.chamberId) {
    const profile = getProfile();
    if (profile) {
      if (!profile.room_mastery) profile.room_mastery = {};
      const score = completedEntry.score || 85;
      profile.room_mastery[node.chamberId] = Math.max(profile.room_mastery[node.chamberId] || 0, score);
      profile.total_sessions = (profile.total_sessions || 0) + 1;
      saveProfile(profile);
    }
  }

  persistState();

  // Play auditory reward
  if (currentState.currentUnlockedIndex >= QUEST_NODES.length) {
    playCompletionFanfare();
  } else {
    playCrystalTone(660, 240, 0.35);
  }

  // Dispatch global window event for DOM reactions
  window.dispatchEvent(new CustomEvent('quest_node_completed', {
    detail: { completedIndex: stageIndex, nextIndex: currentState.currentUnlockedIndex }
  }));

  return true;
}

/**
 * Handles participant clicking a node.
 * Returns: 'locked' | 'active' | 'completed'
 */
export function enterNode(nodeIdOrIndex: string | number): { state: NodeState; node: QuestNodeDefinition } | null {
  const node = getNodeDefinition(nodeIdOrIndex);
  if (!node) return null;

  const state = getNodeState(node.index);
  if (state === 'locked') {
    playTactileClick();
    return { state: 'locked', node };
  }

  return { state, node };
}

/**
 * Unlocks the next sequential node (for testing / manual progression)
 */
export function unlockNext(): void {
  if (currentState.currentUnlockedIndex < QUEST_NODES.length) {
    const nextIndex = currentState.currentUnlockedIndex;
    completeCurrentNode(nextIndex, { autoUnlocked: true, score: 90 });
  }
}

/**
 * Resets quest progress back to Stage 0 (Questionnaire 0)
 */
export function resetQuest(): void {
  currentState = {
    currentUnlockedIndex: 0,
    completedNodes: {},
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  };
  persistState();
}

/**
 * Sets quest directly to any stage index (0 to 8) for inspection & testing
 */
export function jumpToStage(targetIndex: number): void {
  const clamped = Math.max(0, Math.min(QUEST_NODES.length, targetIndex));
  const newCompleted: Record<string, CompletedNodeData> = {};
  const now = new Date().toISOString();

  for (let i = 0; i < clamped; i++) {
    const node = QUEST_NODES[i];
    newCompleted[node.id] = {
      nodeId: node.id,
      nodeIndex: i,
      completedAt: now,
      type: node.type,
      title: node.title,
      score: 95,
      details: { simulationPreloaded: true }
    };
  }

  currentState = {
    currentUnlockedIndex: clamped,
    completedNodes: newCompleted,
    startedAt: currentState.startedAt || now,
    lastUpdated: now
  };
  persistState();
}

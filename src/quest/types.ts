/**
 * Chambers of the Operational Hierarchy - Quest Path Progression Types
 * Strict 9-node linear hierarchy: alternating chambers and checkpoints.
 */

import { ChamberDefinition } from '../types';

export type QuestNodeType = 'chamber' | 'questionnaire';

export type NodeState = 'completed' | 'active' | 'locked';

export interface QuestNodeDefinition {
  id: string;
  index: number; // 0 to 8
  type: QuestNodeType;
  title: string;
  subtitle: string;
  chamberId?: string; // e.g. 'room-1'
  roomNumber?: number;
  timescale?: string;
  estimatedTime: string;
  description: string;
  scientificObjective?: string;
  paradigm?: string;
  instructions?: string[];
  iconName: string;
}

export interface DemographicsFormData {
  subjectId: string;
  playerName: string;
  age: number;
  gender: string;
  handedness: 'right' | 'left' | 'ambidextrous';
  visionStatus: 'normal' | 'corrected' | 'impaired';
  hearingStatus: 'normal' | 'corrected' | 'impaired';
  sleepHours: number;
  alertnessRating: number; // 1-5
  deviceType: string;
}

export interface CheckpointSurveyFormData {
  surveyId: string;
  ratings: Record<string, number>; // questionId -> 1..5 Likert
  notes?: string;
  submittedAt: string;
}

export interface CompletedNodeData {
  nodeId: string;
  nodeIndex: number;
  completedAt: string;
  type: QuestNodeType;
  title: string;
  score?: number;
  details?: Record<string, unknown>;
}

export interface QuestProgressionState {
  currentUnlockedIndex: number; // 0 to 8 (9 = all complete)
  completedNodes: Record<string, CompletedNodeData>;
  lastCompletedNodeId?: string;
  startedAt: string;
  lastUpdated: string;
}

/**
 * TEMPLE of Time - Academy Central Dashboard
 * Vertical Quest-Path Progression Map for "Chambers of the Operational Hierarchy".
 * 
 * Free-entry structure: All nodes are kept always active and unlocked.
 * Players are free to enter any chamber whenever they want.
 * Touching any room goes directly into that room:
 * instruction screen --> interactive demo screen --> game screen --> result.
 * There is no option to review previous results.
 * Guiding arrows are preserved throughout the room sequence (Room 1 to Room 6).
 */

import { ParticipantProfile, ChamberDefinition } from '../types';
import { CHAMBERS } from '../chambers';
import { playTactileClick } from '../audio';
import { saveProfile, getProfile } from '../store';
import {
  QUEST_NODES,
  getQuestState,
  getNodeState,
  subscribeToQuest,
  resetQuest
} from '../quest/questState';
import { QuestNodeDefinition } from '../quest/types';
import { openQuestionnaireModal } from '../quest/questModals';

export interface DashboardCallbacks {
  onEnterChamber: (chamber: ChamberDefinition) => void;
  onOpenAuth: () => void;
}

// 5 Main Operational Hierarchy Chambers (Room 1 to Room 5)
const CHAMBER_NODES = QUEST_NODES.filter(n => n.type === 'chamber');
// Questionnaire nodes for Room 6 Questionnaire Suite
const SURVEY_NODES = QUEST_NODES.filter(n => n.type === 'questionnaire');

const ROOM_6_STORAGE_KEY = 'TEMPLE_ROOM_6_COMPLETED';

let activeQuestUnsubscribe: (() => void) | null = null;

function showResetToast(message: string): void {
  const existing = document.getElementById('temple-reset-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'temple-reset-toast';
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0c101d] border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] font-mono text-xs flex items-center space-x-2 animate-[scaleIn_0.2s_ease]';
  toast.innerHTML = `
    <span class="text-emerald-400 font-bold">✓</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  }, 2400);
}

export function renderDashboard(container: HTMLElement, profile: ParticipantProfile, callbacks: DashboardCallbacks): void {
  let currentProfile = profile;
  let isDrawerOpen = false;
  let resetNotificationActive = false;

  function isRoom6Completed(): boolean {
    const questState = getQuestState();
    const hasAnySurveyComplete = SURVEY_NODES.some(n => questState.completedNodes[n.id]);
    return localStorage.getItem(ROOM_6_STORAGE_KEY) === 'true' || hasAnySurveyComplete;
  }

  function executeResetRecords(): void {
    playTactileClick();

    // 1. Clear Room 6 completion flag from localStorage
    localStorage.removeItem(ROOM_6_STORAGE_KEY);

    // 2. Clear frontend room mastery in profile (preserving session count and streak)
    const activeProf = getProfile() || currentProfile;
    if (activeProf) {
      activeProf.room_mastery = {};
      saveProfile(activeProf);
      currentProfile = activeProf;
    }

    // 3. Reset quest progression state in store
    resetQuest();

    // 4. Update state flags & re-render view
    resetNotificationActive = true;
    renderView();
    showResetToast('Dashboard records reset: 0% Completed');

    setTimeout(() => {
      resetNotificationActive = false;
      const pulseEl = container.querySelector('#quest-tools-drawer .reset-feedback-badge');
      pulseEl?.remove();
    }, 2800);
  }

  function renderView(): void {
    const activeProfile = getProfile() || currentProfile;
    const questState = getQuestState();
    const completedRoomsCount = CHAMBER_NODES.filter(n => questState.completedNodes[n.id]).length;
    const progressPercent = Math.min(100, Math.round((completedRoomsCount / CHAMBER_NODES.length) * 100));
    const room6Done = isRoom6Completed();

    container.innerHTML = `
      <!-- Top Navigation Bar -->
      <header class="border-b border-stone-800 bg-[#070913]/95 backdrop-blur-md sticky top-0 z-30">
        <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          
          <!-- Left: Temple of Time Wordmark -->
          <div class="flex items-center space-x-2.5">
            <div class="w-7 h-7 rounded-full border border-amber-500/50 bg-amber-500/10 flex items-center justify-center text-amber-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <span class="text-sm sm:text-base font-arcane text-amber-100 font-bold tracking-wider whitespace-nowrap">
              TEMPLE OF TIME
            </span>
          </div>

          <!-- Right: Sub_ID and Settings Button -->
          <div class="flex items-center space-x-2">
            <!-- Subject ID Badge -->
            <button id="btn-profile-badge" 
                    title="Initiate Registry: ${activeProfile.subject_id}"
                    class="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/40 text-stone-200 text-xs font-mono transition-colors cursor-pointer flex items-center space-x-1">
              <span class="text-stone-400 text-[10px] hidden xs:inline">ID:</span>
              <span class="font-semibold text-amber-300">${activeProfile.subject_id}</span>
            </button>

            <!-- Settings Widget Toggle -->
            <button id="btn-quest-tools-toggle"
                    title="Settings"
                    class="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>

        </div>
      </header>

      <!-- Settings Quick Drawer -->
      <div id="quest-tools-drawer" class="${isDrawerOpen ? '' : 'hidden'} border-b border-amber-500/30 bg-[#0d1222] px-4 py-3 shadow-xl transition-all">
        <div class="max-w-md mx-auto flex items-center justify-between gap-3 text-xs font-mono">
          <div class="flex items-center space-x-2">
            <span class="text-amber-400 font-semibold uppercase text-[11px] tracking-wide">Settings:</span>
            <span class="text-stone-400 text-[11px]">Dashboard Progression</span>
          </div>
          <div class="flex items-center space-x-2">
            ${resetNotificationActive ? `
              <span class="reset-feedback-badge text-emerald-400 font-mono text-[11px] flex items-center space-x-1 animate-pulse">
                <span>✓</span>
                <span>Reset to 0%</span>
              </span>
            ` : ''}
            <button id="btn-tool-reset" 
                    type="button"
                    class="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/50 hover:border-rose-400 text-rose-200 hover:text-rose-100 text-xs font-mono transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm active:scale-95">
              <span>↺</span>
              <span>Reset Records</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Quest Progression Canvas -->
      <main class="max-w-md mx-auto px-4 py-6 sm:py-8 space-y-6 flex-1 w-full">
        
        <!-- Hero Banner Image Area right below Header -->
        <div class="relative w-full rounded-2xl overflow-hidden border border-amber-500/30 bg-[#080a14] shadow-[0_12px_36px_rgba(0,0,0,0.85)] group">
          <div class="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden">
            <img 
              src="/assets/temple_bg.png" 
              alt="Temple of Time Sanctuary" 
              class="w-full h-full object-cover object-center filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              loading="eager"
              decoding="async"
              onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='/temple_bg.png';}"
            />
            <!-- Gradient scrims and glowing inner rim to blend with dark arcane aesthetic -->
            <div class="absolute inset-0 bg-gradient-to-t from-[#08090e] via-transparent to-black/30 pointer-events-none"></div>
            <div class="absolute inset-0 ring-1 ring-inset ring-amber-500/20 rounded-2xl pointer-events-none"></div>
          </div>
        </div>

        <!-- First Card: Welcome to the TEMPLE of Time! attached directly below hero image -->
        <section class="bg-[#0e1424] border border-amber-500/25 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl">
          <div class="absolute -right-8 -top-8 w-44 h-44 rounded-full border border-amber-500/10 pointer-events-none"></div>

          <div class="space-y-3 relative z-10">
            <!-- Top bar: Yellow font Quest Progression Map on left; tasks completed on right -->
            <div class="flex items-center justify-between text-[11px] font-mono">
              <span class="uppercase tracking-widest font-semibold text-amber-400">Quest Progression Map</span>
              <span class="text-stone-400 font-mono-num">${completedRoomsCount} of ${CHAMBER_NODES.length} tasks completed</span>
            </div>

            <div>
              <h1 class="text-lg sm:text-xl font-arcane text-stone-100 font-bold tracking-wide">
                Welcome to the TEMPLE of Time!
              </h1>
              <p class="text-xs text-stone-300 mt-1 leading-relaxed">
                Take an expedition through timescales of human perception. Enter any room to begin a task. Complete all 5 tasks at your own pace. Practice everyday to level up.
              </p>
            </div>

            <!-- Glowing Progress Track (retained as is) -->
            <div class="space-y-1.5 pt-1">
              <div class="w-full h-2.5 bg-[#070912] rounded-full overflow-hidden border border-stone-800 relative">
                <div class="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-[#E5A93C] rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(212,175,55,0.6)]"
                     style="width: ${progressPercent}%;"></div>
              </div>
              <div class="flex justify-between items-center text-[10px] font-mono text-stone-400">
                <span>Room 1: The Weather Spire</span>
                <span class="text-amber-400 font-semibold font-mono-num">${progressPercent}% Complete</span>
                <span>Room 5: The Vault</span>
              </div>
            </div>

            <!-- Streak Counter Button & Daily Reminder -->
            <div class="pt-3 border-t border-stone-800/80 flex items-center gap-3">
              <button id="btn-streak-counter"
                      type="button"
                      title="Daily Login Streak: ${activeProfile.streak_count || 1} day(s)"
                      class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)] active:scale-95 cursor-pointer select-none shrink-0">
                <span class="text-amber-400 text-sm">🔥</span>
                <span>${activeProfile.streak_count || 1}d Streak</span>
              </button>
              <span class="text-[11px] text-stone-400 leading-tight">
                Log in every day to maintain your streak
              </span>
            </div>
          </div>
        </section>

        <!-- Vertical Progression Path Map (Room 1 to Room 6 with Guiding Arrows) -->
        <section class="relative py-2" id="quest-path-container">
          
          <!-- Rooms 1 through 5 -->
          ${CHAMBER_NODES.map((node) => {
            const state = getNodeState(node.index);

            return `
              <div class="quest-path-node-wrapper relative" data-node-index="${node.index}" id="node-item-${node.index}">
                
                <!-- Room Card Item (Without timescale numbers) -->
                ${renderChamberNodeCard(node, state, activeProfile)}

                <!-- Connecting Vertical Guiding Arrow to Next Room -->
                ${renderConnectorPath(state, node.index)}

              </div>
            `;
          }).join('')}

          <!-- Room 6: The Scroll Library (Questionnaire Suite) -->
          <div class="quest-path-node-wrapper relative" id="node-item-room-6">
            ${renderRoom6Card(room6Done)}
          </div>

        </section>

        <!-- Master Completion Crest if all rooms completed -->
        ${completedRoomsCount >= 5 && room6Done ? `
          <div class="bg-gradient-to-b from-[#141d33] to-[#0c1220] border-2 border-amber-400 rounded-2xl p-6 text-center space-y-3 shadow-[0_0_40px_rgba(212,175,55,0.35)] animate-[scaleIn_0.3s_ease]">
            <div class="w-16 h-16 rounded-full mx-auto border-2 border-amber-400 bg-amber-500/20 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(212,175,55,0.5)]">
              👑
            </div>
            <h2 class="text-xl font-arcane text-amber-200 font-bold tracking-wider">
              OPERATIONAL HIERARCHY COMPLETE
            </h2>
            <p class="text-xs text-stone-300 max-w-sm mx-auto leading-relaxed">
              All 5 Psychophysics Chambers and the Scroll Library archives have been inscribed. Your complete multi-timescale temporal profile is archived in the Master Registry.
            </p>
            <div class="pt-2">
              <button id="btn-reset-full-exp" 
                      class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer shadow-lg">
                Re-traverse the Hierarchy
              </button>
            </div>
          </div>
        ` : ''}

      </main>

      <!-- Clean Minimal Application Master Footer (Retained As Is) -->
      <footer id="app-footer" class="border-t border-stone-900/80 py-5 px-4 text-center">
        TEMPLE of TIME: Timescales of Experience: Motor, Perceptual & Latency of Executive-function
      </footer>
    `;

    // Setup event listeners for the rendered dashboard
    attachDashboardListeners();
  }

  function attachDashboardListeners(): void {
    // 1. Profile Badge Click
    document.getElementById('btn-profile-badge')?.addEventListener('click', () => {
      playTactileClick();
      callbacks.onOpenAuth();
    });

    // Streak Counter Button Click
    document.getElementById('btn-streak-counter')?.addEventListener('click', () => {
      playTactileClick();
      const prof = getProfile() || currentProfile;
      const count = prof.streak_count || 1;
      showResetToast(`🔥 Streak: ${count} day${count === 1 ? '' : 's'} active. Log in every day to maintain your streak!`);
    });

    // 2. Settings Drawer Toggle
    const toolsToggle = document.getElementById('btn-quest-tools-toggle');
    const toolsDrawer = document.getElementById('quest-tools-drawer');
    toolsToggle?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playTactileClick();
      isDrawerOpen = !isDrawerOpen;
      toolsDrawer?.classList.toggle('hidden', !isDrawerOpen);
    });

    // 3. Tool: Reset Records (Immediate front-end reset, 0% displayed, zero database changes)
    document.getElementById('btn-tool-reset')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeResetRecords();
    });

    // 4. Reset on Final Complete Crest
    document.getElementById('btn-reset-full-exp')?.addEventListener('click', (e) => {
      e.preventDefault();
      executeResetRecords();
    });

    // 6. Interactive Chamber Card Clicks (Rooms 1 to 5) - Touching any room goes directly into that room
    const nodeElements = container.querySelectorAll('.quest-node-chamber');
    nodeElements.forEach(el => {
      el.addEventListener('click', () => {
        const indexStr = el.getAttribute('data-index');
        if (indexStr === null) return;
        const index = parseInt(indexStr, 10);
        const node = QUEST_NODES.find(n => n.index === index);
        if (!node) return;

        playTactileClick();

        // Direct room entry: instruction screen --> interactive demo screen --> game screen --> result
        const chamber = CHAMBERS.find(c => c.id === node.chamberId);
        if (chamber) {
          callbacks.onEnterChamber(chamber);
        }
      });
    });

    // 7. Interactive Room 6 Card Click (The Scroll Library: Questionnaire suite)
    const room6Card = container.querySelector('.quest-node-room-6');
    room6Card?.addEventListener('click', () => {
      playTactileClick();
      openScrollLibraryModal(() => {
        localStorage.setItem(ROOM_6_STORAGE_KEY, 'true');
        renderView();
      });
    });
  }

  // Subscribe to state changes to auto-re-render with cleanup
  if (activeQuestUnsubscribe) {
    activeQuestUnsubscribe();
  }
  activeQuestUnsubscribe = subscribeToQuest(() => {
    renderView();
  });

  // Initial render
  renderView();
}

/**
 * Render Chamber / Task Node Card (Prominent rectangular card)
 * Kept always active and unlocked. Clicking directly enters the room.
 * Note: Timescale numbers (e.g. 0-400ms) are removed as requested.
 */
function renderChamberNodeCard(node: QuestNodeDefinition, state: string, profile: ParticipantProfile): string {
  const mastery = (profile.room_mastery && node.chamberId && profile.room_mastery[node.chamberId]) || 0;
  const isCompleted = state === 'completed';

  const cardStateClass = isCompleted 
    ? 'quest-node-completed border-amber-500/60 shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:border-amber-400' 
    : 'quest-node-active border-amber-400/80 shadow-[0_0_18px_rgba(212,175,55,0.2)] hover:border-amber-300';

  return `
    <div class="quest-node-interactive quest-node-chamber ${cardStateClass} border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer relative overflow-hidden select-none group"
         data-index="${node.index}"
         role="button"
         tabindex="0"
         title="Touch to enter ${node.title}">
      
      <!-- Top Bar: Room Kicker & State Badge (Timescale numbers removed) -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            ROOM ${node.roomNumber}
          </span>
        </div>

        ${isCompleted ? `
          <div class="px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-semibold flex items-center space-x-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>COMPLETED</span>
          </div>
        ` : `
          <div class="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>READY TO ENTER</span>
          </div>
        `}
      </div>

      <!-- Chamber Title & Subtitle -->
      <div>
        <h3 class="text-base sm:text-lg font-arcane text-stone-100 font-bold tracking-wide uppercase group-hover:text-amber-300 transition-colors">
          ${node.title}
        </h3>
        <div class="text-xs text-amber-400/90 font-mono font-medium mt-0.5">
          ${node.subtitle}
        </div>
      </div>

      <!-- Lore / Mechanism Excerpt -->
      <p class="text-xs text-stone-300 mt-2 leading-relaxed">
        ${node.description}
      </p>

      <!-- Card Bottom: Mastery & Direct Enter Action Button -->
      <div class="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between">
        
        <!-- Duration / Status text -->
        <div class="flex items-center space-x-2">
          <span class="text-[11px] font-mono text-stone-400">
            ${isCompleted ? 'Completed Record' : `${node.estimatedTime}`}
          </span>
        </div>

        <!-- Direct Enter Action Button -->
        <div>
          <span class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 group-hover:from-amber-400 group-hover:to-amber-300 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all">
            <span>ENTER</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>

      </div>

    </div>
  `;
}

/**
 * Render Room 6: The Scroll Library (Questionnaire Suite)
 * Designed exactly like the rest of the room cards.
 */
function renderRoom6Card(isCompleted: boolean): string {
  const cardStateClass = isCompleted 
    ? 'quest-node-completed border-amber-500/60 shadow-[0_0_15px_rgba(212,175,55,0.15)] hover:border-amber-400' 
    : 'quest-node-active border-amber-400/80 shadow-[0_0_18px_rgba(212,175,55,0.2)] hover:border-amber-300';

  return `
    <div class="quest-node-interactive quest-node-room-6 ${cardStateClass} border rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer relative overflow-hidden select-none group"
         data-room6="true"
         role="button"
         tabindex="0"
         title="Touch to enter Room 6: The Scroll Library">
      
      <!-- Top Bar: Room Kicker & State Badge (Timescale numbers removed) -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            ROOM 6
          </span>
        </div>

        ${isCompleted ? `
          <div class="px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-semibold flex items-center space-x-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>COMPLETED</span>
          </div>
        ` : `
          <div class="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center space-x-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>READY TO ENTER</span>
          </div>
        `}
      </div>

      <!-- Chamber Title & Subtitle -->
      <div>
        <h3 class="text-base sm:text-lg font-arcane text-stone-100 font-bold tracking-wide uppercase group-hover:text-amber-300 transition-colors">
          Room 6 – The Scroll Library
        </h3>
        <div class="text-xs text-amber-400/90 font-mono font-medium mt-0.5">
          Questionnaire suite
        </div>
      </div>

      <!-- Lore / Mechanism Excerpt -->
      <p class="text-xs text-stone-300 mt-2 leading-relaxed">
        Examine your subjective introspections, sensory baselines, and cognitive reflections. Inscribe your responses within the sacred scroll archives.
      </p>

      <!-- Card Bottom: Mastery & Direct Enter Action Button -->
      <div class="mt-4 pt-3 border-t border-stone-800/80 flex items-center justify-between">
        
        <!-- Duration / Status text -->
        <div class="flex items-center space-x-2">
          <span class="text-[11px] font-mono text-stone-400">
            ${isCompleted ? 'Completed Record' : '10 min Task'}
          </span>
        </div>

        <!-- Direct Enter Action Button -->
        <div>
          <span class="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 group-hover:from-amber-400 group-hover:to-amber-300 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all">
            <span>ENTER</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>

      </div>

    </div>
  `;
}

/**
 * Render Connecting Path Segment with Dynamic Guiding Arrows
 * Preserves the vertical sequence structure between rooms.
 */
function renderConnectorPath(fromState: string, _fromIndex: number): string {
  const isCompleted = fromState === 'completed';

  return `
    <div class="w-full flex flex-col items-center my-1 select-none pointer-events-none" aria-hidden="true">
      <svg width="24" height="42" viewBox="0 0 24 42" fill="none" class="text-amber-400">
        <!-- Illuminated vertical line -->
        <line x1="12" y1="0" x2="12" y2="30" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" 
              ${isCompleted ? '' : 'stroke-dasharray="5 4"'}
              style="filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.6));"/>
        <!-- Downward arrow head -->
        <path d="M7 25 L12 33 L17 25" fill="none" stroke="#D4AF37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
              style="filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.6));"/>
      </svg>
    </div>
  `;
}

/**
 * Open Room 6: The Scroll Library Google Form Suite Modal
 * Embeds the Google Form directly in-app while providing a direct external link option.
 */
function openScrollLibraryModal(onCompleteCallback: () => void): void {
  const existing = document.getElementById('scroll-library-suite-modal');
  if (existing) existing.remove();

  const googleFormEmbedUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc70McR5eCpufXmyxwd0NTOLNelKum3awV7nENp5Pj1mE5k9g/viewform?embedded=true';
  const googleFormExternalUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSc70McR5eCpufXmyxwd0NTOLNelKum3awV7nENp5Pj1mE5k9g/viewform?usp=header';

  const modalContainer = document.createElement('div');
  modalContainer.id = 'scroll-library-suite-modal';
  modalContainer.className = 'fixed inset-0 z-50 bg-[#06080F]/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none transition-all duration-200';

  modalContainer.innerHTML = `
    <div class="bg-[#0b0f1d] border border-amber-500/40 rounded-2xl w-full max-w-3xl h-[92vh] sm:h-[88vh] overflow-hidden shadow-[0_0_50px_rgba(212,175,55,0.25)] flex flex-col animate-[scaleIn_0.2s_ease]">
      
      <!-- Modal Header (3-zone) -->
      <div class="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-stone-800 flex items-center justify-between bg-[#080c18] shrink-0">
        
        <!-- Left: Wordmark & Room Info -->
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 text-base shadow-[0_0_12px_rgba(212,175,55,0.3)]">
            📜
          </div>
          <div>
            <div class="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
              ROOM 6 · THE SCROLL LIBRARY
            </div>
            <h2 class="text-sm sm:text-base font-arcane text-stone-100 font-bold tracking-wide">
              Questionnaire Suite
            </h2>
          </div>
        </div>

        <!-- Right: Actions (Open in new tab + Return to Dashboard) -->
        <div class="flex items-center space-x-2">
          <!-- Direct External Link Button -->
          <a href="${googleFormExternalUrl}" 
             target="_blank" 
             rel="noopener noreferrer"
             title="Open Google Form in separate tab"
             class="hidden xs:flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 text-xs font-mono transition-colors">
            <span>Open in Tab</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>

          <!-- Return to Dashboard Button -->
          <button id="btn-close-scroll-library" 
                  class="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold transition-colors cursor-pointer flex items-center space-x-1">
            <span>← Dashboard</span>
          </button>
        </div>

      </div>

      <!-- Modal Body: Embedded Google Form in Iframe with responsive scrolling -->
      <div class="relative flex-1 w-full bg-[#f0ebf8] overflow-hidden">
        <!-- Subtle loading indicator underneath -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-stone-600 bg-[#0e1324] font-mono text-xs z-0">
          <div class="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mb-3"></div>
          <span>Unrolling Archival Scroll...</span>
        </div>

        <!-- Google Form Embed Iframe -->
        <iframe 
          src="${googleFormEmbedUrl}" 
          title="Temple of Time Questionnaire Suite"
          class="relative z-10 w-full h-full border-0"
          frameborder="0" 
          marginheight="0" 
          marginwidth="0"
          loading="lazy">
          Loading questionnaire…
        </iframe>
      </div>

      <!-- Modal Footer -->
      <div class="px-4 py-3 border-t border-stone-800 bg-[#080c18] flex items-center justify-between shrink-0">
        <div class="text-[11px] font-mono text-stone-400 flex items-center space-x-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>Google Forms Secure Archival Form</span>
        </div>
        <button id="btn-complete-scroll-library" 
                class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-mono text-xs font-bold uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.3)] transition-all">
          Mark Inscribed & Return
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modalContainer);

  const closeModal = () => {
    modalContainer.classList.add('opacity-0', 'scale-95');
    setTimeout(() => modalContainer.remove(), 180);
  };

  document.getElementById('btn-close-scroll-library')?.addEventListener('click', () => {
    playTactileClick();
    closeModal();
  });

  document.getElementById('btn-complete-scroll-library')?.addEventListener('click', () => {
    playTactileClick();
    closeModal();
    onCompleteCallback();
  });
}


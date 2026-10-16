/**
 * Chambers of the Operational Hierarchy - Interactive Quest Modals & Overlays
 * Includes:
 * 1. Streamlined Questionnaire Survey forms (Demographics Node 0, Checkpoint A Node 2, Checkpoint B Node 4, Checkpoint C Node 7)
 * 2. Chamber Task View & Interactive Trials (Rooms 1 - 5)
 * 3. Completed Node Inspection Review Modal
 */

import { QuestNodeDefinition, DemographicsFormData, CheckpointSurveyFormData } from './types';
import { completeCurrentNode, getQuestState } from './questState';
import { getProfile, saveProfile } from '../store';
import {
  playTactileClick,
  playWeatherSpireTone,
  playChessPieceSound,
  playGrainSeedSound,
  playFamiliarCall,
  playGemstoneStoneClick,
  playPathSelectClick,
  playVaultArrivalChime,
  playCoinCollectPulse,
  playRuneHum
} from '../audio';
import { CHAMBERS } from '../chambers';

/**
 * Removes any existing quest modal
 */
function closeAnyModal(): void {
  const existing = document.getElementById('quest-active-modal');
  if (existing) {
    existing.classList.add('opacity-0', 'scale-95');
    setTimeout(() => existing.remove(), 180);
  }
}

/**
 * Open the Questionnaire Survey Modal
 */
export function openQuestionnaireModal(node: QuestNodeDefinition, onCompleteCallback: () => void): void {
  closeAnyModal();

  const profile = getProfile();
  const modalContainer = document.createElement('div');
  modalContainer.id = 'quest-active-modal';
  modalContainer.className = 'fixed inset-0 z-50 bg-[#06080F]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none transition-all duration-200';

  let formHtml = '';

  if (node.index === 0) {
    // Node 0: Demographics & Baseline Survey
    const defaultSubjectId = profile?.subject_id || `ARCHON-${Math.floor(1000 + Math.random() * 9000)}`;
    const defaultName = profile?.player_name || profile?.name || 'Initiate Chronos';

    formHtml = `
      <form id="quest-survey-form" class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-mono uppercase tracking-wider text-amber-400 mb-1">Subject ID / Registry Code</label>
            <input type="text" id="demo-subject-id" value="${defaultSubjectId}" required
                   class="w-full bg-[#0a0e18] border border-amber-500/30 rounded-xl px-3 py-2 text-stone-100 font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50" />
          </div>
          <div>
            <label class="block font-mono uppercase tracking-wider text-amber-400 mb-1">Initiate Name</label>
            <input type="text" id="demo-player-name" value="${defaultName}" required
                   class="w-full bg-[#0a0e18] border border-amber-500/30 rounded-xl px-3 py-2 text-stone-100 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-mono uppercase tracking-wider text-stone-300 mb-1">Age</label>
            <input type="number" id="demo-age" min="16" max="99" value="${profile?.age || 26}" required
                   class="w-full bg-[#0a0e18] border border-stone-700 rounded-xl px-3 py-2 text-stone-100 font-mono focus:border-amber-400 focus:outline-none" />
          </div>
          <div>
            <label class="block font-mono uppercase tracking-wider text-stone-300 mb-1">Gender</label>
            <select id="demo-gender" class="w-full bg-[#0a0e18] border border-stone-700 rounded-xl px-2 py-2 text-stone-100 focus:border-amber-400 focus:outline-none">
              <option value="unspecified">Select...</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="nonbinary">Non-binary</option>
              <option value="other">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label class="block font-mono uppercase tracking-wider text-stone-300 mb-1">Handedness</label>
            <select id="demo-handedness" class="w-full bg-[#0a0e18] border border-stone-700 rounded-xl px-2 py-2 text-stone-100 focus:border-amber-400 focus:outline-none">
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="ambidextrous">Ambidextrous</option>
            </select>
          </div>
        </div>

        <!-- Sensory Calibration -->
        <div class="bg-[#0b101c] border border-stone-800 rounded-xl p-3 space-y-3">
          <div class="font-mono text-amber-300 uppercase tracking-wider text-[11px] flex items-center justify-between">
            <span>Sensory Acuity Baselines</span>
            <span class="text-stone-400 font-sans font-normal text-[10px]">Verification</span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <span class="block text-stone-300 text-[11px] mb-1">Visual Status:</span>
              <div class="flex items-center space-x-2">
                <label class="flex items-center space-x-1 cursor-pointer text-stone-300">
                  <input type="radio" name="vision" value="normal" checked class="accent-amber-400" />
                  <span>Normal</span>
                </label>
                <label class="flex items-center space-x-1 cursor-pointer text-stone-300">
                  <input type="radio" name="vision" value="corrected" class="accent-amber-400" />
                  <span>Corrected</span>
                </label>
              </div>
            </div>
            <div>
              <span class="block text-stone-300 text-[11px] mb-1">Auditory Status:</span>
              <div class="flex items-center space-x-2">
                <label class="flex items-center space-x-1 cursor-pointer text-stone-300">
                  <input type="radio" name="hearing" value="normal" checked class="accent-amber-400" />
                  <span>Normal</span>
                </label>
                <label class="flex items-center space-x-1 cursor-pointer text-stone-300">
                  <input type="radio" name="hearing" value="corrected" class="accent-amber-400" />
                  <span>Assisted</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center text-stone-300 text-[11px] mb-1">
              <span>Circadian Alertness (1: Drowsy · 5: Peak Alert)</span>
              <span id="alertness-val" class="font-mono text-amber-400 font-bold">4 / 5</span>
            </div>
            <input type="range" id="demo-alertness" min="1" max="5" value="4" step="1"
                   class="w-full accent-amber-400 cursor-pointer" />
          </div>
        </div>

        <button type="submit" id="btn-submit-survey"
                class="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-stone-950 font-semibold font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center justify-center space-x-2 cursor-pointer mt-2">
          <span>Inscribe Demographics & Unlock Spire</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </form>
    `;
  } else {
    // Checkpoint surveys (Node 2, 4, 7)
    const questions = getQuestionsForNode(node.index);
    formHtml = `
      <form id="quest-survey-form" class="space-y-4 text-xs">
        <p class="text-stone-300 text-xs leading-relaxed">
          Rate your subjective experience on a 1 to 5 scale (1 = Strongly Disagree, 5 = Strongly Agree).
        </p>

        <div class="space-y-3">
          ${questions.map((q, idx) => `
            <div class="bg-[#0b101c] border border-stone-800 rounded-xl p-3 space-y-2">
              <div class="text-stone-200 font-medium text-xs leading-snug">
                <span class="text-amber-400 font-mono mr-1">${idx + 1}.</span>
                ${q.text}
              </div>
              <div class="flex items-center justify-between pt-1">
                <span class="text-[10px] text-stone-400">Disagree</span>
                <div class="flex items-center space-x-3">
                  ${[1, 2, 3, 4, 5].map(val => `
                    <label class="flex flex-col items-center space-y-0.5 cursor-pointer">
                      <input type="radio" name="q_${q.id}" value="${val}" ${val === 4 ? 'checked' : ''} class="accent-amber-400" />
                      <span class="text-[10px] font-mono text-stone-300">${val}</span>
                    </label>
                  `).join('')}
                </div>
                <span class="text-[10px] text-amber-400">Agree</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div>
          <label class="block font-mono uppercase tracking-wider text-stone-400 mb-1 text-[11px]">Qualitative Observations (Optional)</label>
          <textarea id="survey-notes" rows="2" placeholder="Note any sensory anomalies or perceived latency distortions..."
                    class="w-full bg-[#0a0e18] border border-stone-800 rounded-xl p-2.5 text-stone-200 text-xs focus:border-amber-400 focus:outline-none"></textarea>
        </div>

        <button type="submit" id="btn-submit-survey"
                class="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-stone-950 font-semibold font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center justify-center space-x-2 cursor-pointer mt-2">
          <span>Inscribe Checkpoint & Unlock Next Chamber</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </form>
    `;
  }

  modalContainer.innerHTML = `
    <div class="bg-[#0e1322] border border-amber-500/40 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-[scaleIn_0.2s_ease]">
      
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-stone-800 bg-[#090d17] flex justify-between items-center">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center text-amber-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <div>
            <div class="text-[10px] font-mono uppercase tracking-wider text-amber-400">Survey Checkpoint · Stage ${node.index + 1} of 9</div>
            <h2 class="text-base sm:text-lg font-arcane text-stone-100 font-semibold tracking-wide">${node.title}</h2>
          </div>
        </div>

        <button id="modal-close-btn" class="p-2 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" title="Return">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 overflow-y-auto space-y-4">
        ${formHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modalContainer);

  // Close button listener
  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    playTactileClick();
    closeAnyModal();
  });

  // Dynamic alertness slider label update
  const alertnessInput = document.getElementById('demo-alertness') as HTMLInputElement | null;
  const alertnessVal = document.getElementById('alertness-val');
  if (alertnessInput && alertnessVal) {
    alertnessInput.addEventListener('input', () => {
      alertnessVal.textContent = `${alertnessInput.value} / 5`;
    });
  }

  // Form submit handler
  const form = document.getElementById('quest-survey-form') as HTMLFormElement | null;
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    playTactileClick();

    if (node.index === 0) {
      // Save demographics
      const subjectId = (document.getElementById('demo-subject-id') as HTMLInputElement)?.value.trim() || 'ARCHON-01';
      const playerName = (document.getElementById('demo-player-name') as HTMLInputElement)?.value.trim() || 'Initiate Chronos';
      const age = parseInt((document.getElementById('demo-age') as HTMLInputElement)?.value || '25', 10);
      const gender = (document.getElementById('demo-gender') as HTMLSelectElement)?.value || 'unspecified';
      const handedness = ((document.getElementById('demo-handedness') as HTMLSelectElement)?.value || 'right') as 'right' | 'left' | 'ambidextrous';
      const alertness = parseInt(alertnessInput?.value || '4', 10);

      // Update participant profile
      const activeProf = getProfile() || {
        id: 'sub-' + Date.now(),
        subject_id: subjectId,
        name: playerName,
        player_name: playerName,
        age,
        gender,
        handedness,
        streak_count: 1,
        last_active_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
        rank_title: 'Initiate of the Chronometer',
        total_sessions: 0,
        room_mastery: {}
      };

      activeProf.subject_id = subjectId;
      activeProf.player_name = playerName;
      activeProf.name = playerName;
      activeProf.age = age;
      activeProf.gender = gender;
      activeProf.handedness = handedness;
      saveProfile(activeProf);

      const demoData: DemographicsFormData = {
        subjectId,
        playerName,
        age,
        gender,
        handedness,
        visionStatus: 'normal',
        hearingStatus: 'normal',
        sleepHours: 7.5,
        alertnessRating: alertness,
        deviceType: navigator.userAgent
      };

      completeCurrentNode(0, demoData as unknown as Record<string, unknown>);
    } else {
      // Checkpoint survey
      const ratings: Record<string, number> = {};
      const questions = getQuestionsForNode(node.index);
      questions.forEach(q => {
        const checked = form.querySelector(`input[name="q_${q.id}"]:checked`) as HTMLInputElement | null;
        ratings[q.id] = checked ? parseInt(checked.value, 10) : 4;
      });

      const notes = (document.getElementById('survey-notes') as HTMLTextAreaElement)?.value || '';

      const checkpointData: CheckpointSurveyFormData = {
        surveyId: node.id,
        ratings,
        notes,
        submittedAt: new Date().toISOString()
      };

      completeCurrentNode(node.index, checkpointData as unknown as Record<string, unknown>);
    }

    closeAnyModal();
    onCompleteCallback();
  });
}

/**
 * Open Chamber Task Modal (Interactive Mini-Trial + Direct Entry Option)
 */
export function openChamberModal(
  node: QuestNodeDefinition,
  onCompleteChamber: (result: Record<string, unknown>) => void,
  onLaunchArena: (chamberId: string) => void
): void {
  closeAnyModal();

  const chamberDef = CHAMBERS.find(c => c.id === node.chamberId);
  const modalContainer = document.createElement('div');
  modalContainer.id = 'quest-active-modal';
  modalContainer.className = 'fixed inset-0 z-50 bg-[#06080F]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none transition-all duration-200';

  const previewInteractiveHtml = renderInteractiveTaskSimulation(node);

  modalContainer.innerHTML = `
    <div class="bg-[#0e1322] border border-amber-500/40 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-[scaleIn_0.2s_ease]">
      
      <!-- Header -->
      <div class="px-5 py-4 border-b border-stone-800 bg-[#090d17] flex justify-between items-center">
        <div>
          <div class="text-[10px] font-mono uppercase tracking-wider text-amber-400">
            Chamber ${node.roomNumber} · Timescale: ${node.timescale}
          </div>
          <h2 class="text-base sm:text-lg font-arcane text-stone-100 font-semibold tracking-wide">${node.title}</h2>
          <p class="text-xs text-amber-500 font-mono mt-0.5">${node.subtitle}</p>
        </div>

        <button id="modal-close-btn" class="p-2 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" title="Return">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Scrollable Task View Body -->
      <div class="p-5 overflow-y-auto space-y-5 text-xs">
        
        <!-- Objective & Mandate -->
        <div class="space-y-1.5">
          <div class="text-[11px] font-mono uppercase tracking-wider text-amber-300">Experimental Mandate</div>
          <p class="text-stone-300 leading-relaxed text-xs">
            ${node.description}
          </p>
        </div>

        <!-- Interactive Mini-Simulation Container -->
        <div class="bg-[#070a13] border border-amber-500/30 rounded-xl p-4 relative overflow-hidden">
          <div class="flex items-center justify-between mb-3 border-b border-stone-800/80 pb-2">
            <span class="font-mono text-amber-400 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Psychophysics Simulation</span>
            </span>
            <span class="text-stone-400 font-mono text-[10px]">Direct Response Active</span>
          </div>

          ${previewInteractiveHtml}
        </div>

        <!-- Task Instructions List -->
        <div class="space-y-2">
          <div class="text-[11px] font-mono uppercase tracking-wider text-cyan-400">Interaction Guide</div>
          <ul class="space-y-1.5">
            ${(node.instructions || chamberDef?.instructions || []).map((inst, idx) => `
              <li class="flex items-start text-stone-300 text-xs">
                <span class="text-amber-500 font-mono mr-2">${idx + 1}.</span>
                <span>${inst}</span>
              </li>
            `).join('')}
          </ul>
        </div>

      </div>

      <!-- Action Footer -->
      <div class="p-4 sm:p-5 border-t border-stone-800 bg-[#090d17] flex flex-col sm:flex-row gap-2.5 justify-between">
        <button id="btn-launch-full-arena"
                class="px-4 py-2.5 rounded-xl border border-amber-500/40 hover:bg-amber-500/10 text-amber-300 text-xs font-mono uppercase tracking-wider transition-colors flex items-center justify-center space-x-1.5 cursor-pointer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8"></polygon>
          </svg>
          <span>Launch Full Task Arena</span>
        </button>

        <button id="btn-complete-in-situ"
                class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-[0.98] text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center justify-center space-x-2 cursor-pointer">
          <span>Inscribe Chamber Mastery & Proceed</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modalContainer);

  // Setup interactive simulation event bindings
  bindInteractiveSimulationListeners(node);

  // Close button
  document.getElementById('modal-close-btn')?.addEventListener('click', () => {
    playTactileClick();
    closeAnyModal();
  });

  // Launch Full Task Arena
  document.getElementById('btn-launch-full-arena')?.addEventListener('click', () => {
    playTactileClick();
    closeAnyModal();
    if (node.chamberId) {
      onLaunchArena(node.chamberId);
    }
  });

  // Inscribe Mastery & Complete Step
  document.getElementById('btn-complete-in-situ')?.addEventListener('click', () => {
    playTactileClick();
    closeAnyModal();
    onCompleteChamber({
      score: 95,
      completedInSitu: true,
      chamberNumber: node.roomNumber,
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Inspection Modal for Completed Nodes (Allows participant to review recorded data)
 */
export function openReviewModal(node: QuestNodeDefinition): void {
  closeAnyModal();

  const state = getQuestState();
  const completedData = state.completedNodes[node.id];

  const modalContainer = document.createElement('div');
  modalContainer.id = 'quest-active-modal';
  modalContainer.className = 'fixed inset-0 z-50 bg-[#06080F]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none transition-all duration-200';

  modalContainer.innerHTML = `
    <div class="bg-[#0e1322] border border-emerald-500/40 rounded-2xl w-full max-w-md flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-[scaleIn_0.2s_ease]">
      
      <div class="px-5 py-4 border-b border-stone-800 bg-[#090d17] flex justify-between items-center">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-full border border-emerald-500/50 bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div>
            <div class="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Completed Objective Inscribed</div>
            <h2 class="text-base font-arcane text-stone-100 font-semibold">${node.title}</h2>
          </div>
        </div>

        <button id="modal-close-btn" class="p-2 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="p-5 space-y-4 text-xs">
        <div class="bg-[#070a13] border border-stone-800 rounded-xl p-3 space-y-2">
          <div class="flex justify-between items-center text-stone-400">
            <span>Status:</span>
            <span class="text-emerald-400 font-mono font-bold">SEALED & ARCHIVED</span>
          </div>
          <div class="flex justify-between items-center text-stone-400">
            <span>Stage Position:</span>
            <span class="text-stone-200 font-mono">Stage ${node.index + 1} of 9</span>
          </div>
          <div class="flex justify-between items-center text-stone-400">
            <span>Completion Time:</span>
            <span class="text-stone-300 font-mono">${completedData?.completedAt ? new Date(completedData.completedAt).toLocaleTimeString() : 'Verified'}</span>
          </div>
          <div class="flex justify-between items-center text-stone-400">
            <span>Mastery Recorded:</span>
            <span class="text-amber-400 font-mono font-bold">${completedData?.score || 100}%</span>
          </div>
        </div>

        <div class="text-stone-300 leading-relaxed">
          ${node.description}
        </div>
      </div>

      <div class="p-4 border-t border-stone-800 bg-[#090d17] flex justify-end">
        <button id="btn-close-review"
                class="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono uppercase tracking-wider rounded-xl transition-colors cursor-pointer">
          Close Review
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modalContainer);

  const close = () => {
    playTactileClick();
    closeAnyModal();
  };

  document.getElementById('modal-close-btn')?.addEventListener('click', close);
  document.getElementById('btn-close-review')?.addEventListener('click', close);
}

/**
 * Question sets for checkpoint surveys
 */
function getQuestionsForNode(index: number): Array<{ id: string; text: string }> {
  if (index === 2) {
    // Checkpoint A (Post Spire)
    return [
      { id: 'spire_1', text: 'I could easily discriminate whether the lightning flash or thunder chime arrived first.' },
      { id: 'spire_2', text: 'During simultaneous trials, the visual and acoustic stimuli felt harmoniously unified.' },
      { id: 'spire_3', text: 'I felt high perceptual confidence when deciding temporal order.' },
      { id: 'spire_4', text: 'Sensory fatigue remained low and manageable throughout the trials.' }
    ];
  } else if (index === 4) {
    // Checkpoint B (Post Parlor)
    return [
      { id: 'parlor_1', text: 'I felt that my physical touch directly caused the movement of the chess piece.' },
      { id: 'parlor_2', text: 'When delays were short, I felt strong intentional binding and ownership of the action.' },
      { id: 'parlor_3', text: 'At longer latencies (>700ms), the piece felt guided by autonomous board forces.' },
      { id: 'parlor_4', text: 'I remained conscious of the boundary between self-intent and external lag.' }
    ];
  } else {
    // Checkpoint C (Post Aviary & Puzzler)
    return [
      { id: 'puzzler_1', text: 'The Altar of Triads (MSIT) provoked strong spatial interference between number and stone slot.' },
      { id: 'puzzler_2', text: 'Maintaining steady spontaneous cadence in the Aviary felt natural and steady.' },
      { id: 'puzzler_3', text: 'I experienced mental friction and reaction slowing during incongruent conflict trials.' },
      { id: 'puzzler_4', text: 'Subjective perception of time felt accelerated during intense cognitive blocks.' }
    ];
  }
}

/**
 * HTML for chamber interactive mini-simulation
 */
function renderInteractiveTaskSimulation(node: QuestNodeDefinition): string {
  if (node.chamberId === 'room-1') {
    return `
      <div id="sim-spire" class="space-y-3">
        <div id="spire-flash-box" class="h-24 rounded-lg bg-[#04060b] border border-stone-800 flex items-center justify-center transition-all duration-100">
          <span id="spire-flash-icon" class="text-2xl transition-transform duration-100">⚡</span>
        </div>

        <div class="flex justify-center">
          <button type="button" id="btn-trigger-spire-trial"
                  class="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg font-mono text-[11px] uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer">
            <span>Trigger Stimulus Burst</span>
          </button>
        </div>

        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] font-mono text-stone-400">Temporal Order Judgment:</span>
          <div class="grid grid-cols-3 gap-2">
            <button type="button" class="sim-spire-choice py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-[10px] text-center cursor-pointer" data-val="sound_first">
              Sound First
            </button>
            <button type="button" class="sim-spire-choice py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-[10px] text-center cursor-pointer" data-val="simultaneous">
              Simultaneous
            </button>
            <button type="button" class="sim-spire-choice py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-[10px] text-center cursor-pointer" data-val="light_first">
              Light First
            </button>
          </div>
        </div>

        <div id="spire-sim-feedback" class="text-center font-mono text-[10px] text-amber-400 hidden pt-1">
          Judgment Inscribed · Stimulus Offset: 120ms
        </div>
      </div>
    `;
  }

  if (node.chamberId === 'room-2') {
    return `
      <div id="sim-parlor" class="space-y-3">
        <div class="h-28 rounded-lg bg-[#04060b] border border-stone-800 relative overflow-hidden flex items-center justify-around px-4">
          <div id="parlor-piece" class="w-14 h-14 rounded-xl border border-amber-500/50 bg-amber-500/20 text-amber-300 text-3xl flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            ♘
          </div>
          <div class="text-[11px] font-mono text-stone-400 text-center">
            <span id="parlor-status-text">Tap the Knight to test Agency Latency</span>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex justify-between items-center text-[10px] font-mono text-stone-400">
            <span>Autonomous Force (0%)</span>
            <span class="text-amber-300 font-bold">Sense of Agency</span>
            <span>Self-Authored (100%)</span>
          </div>
          <input type="range" id="sim-parlor-slider" min="0" max="100" value="80"
                 class="w-full accent-amber-400 cursor-pointer" />
        </div>
      </div>
    `;
  }

  if (node.chamberId === 'room-3') {
    return `
      <div id="sim-aviary" class="space-y-3">
        <div class="flex justify-center space-x-2">
          <button type="button" class="sim-familiar-btn px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 text-amber-300 font-mono text-[10px] cursor-pointer" data-familiar="celestial_owl">
            Celestial Owl
          </button>
          <button type="button" class="sim-familiar-btn px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900 text-stone-400 font-mono text-[10px] cursor-pointer" data-familiar="storm_raven">
            Storm Raven
          </button>
          <button type="button" class="sim-familiar-btn px-2.5 py-1.5 rounded-lg border border-stone-800 bg-stone-900 text-stone-400 font-mono text-[10px] cursor-pointer" data-familiar="sun_hawk">
            Sun Hawk
          </button>
        </div>

        <div id="sim-aviary-pad"
             class="h-24 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 active:bg-amber-500/15 flex flex-col items-center justify-center cursor-pointer transition-colors">
          <span class="text-2xl mb-1">🪶</span>
          <span class="font-mono text-amber-300 text-[11px] font-semibold">Tap to Scatter Grain (Spontaneous Rhythm)</span>
          <span id="aviary-tap-counter" class="text-[10px] font-mono text-stone-400 mt-0.5">Taps Inscribed: 0 · Cadence: -- ms</span>
        </div>
      </div>
    `;
  }

  if (node.chamberId === 'room-4') {
    return `
      <div id="sim-study" class="space-y-3">
        <div class="h-20 rounded-xl bg-[#03050a] border border-stone-800 flex items-center justify-center space-x-3">
          <span class="text-2xl font-mono font-bold tracking-[0.3em] text-stone-100" id="study-triad-display">3 3 1</span>
        </div>

        <div class="flex justify-center space-x-4">
          <button type="button" class="sim-gem-btn w-12 h-12 rounded-xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 font-arcane text-xl font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" data-gem="1">
            1
          </button>
          <button type="button" class="sim-gem-btn w-12 h-12 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 font-arcane text-xl font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" data-gem="2">
            2
          </button>
          <button type="button" class="sim-gem-btn w-12 h-12 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 font-arcane text-xl font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" data-gem="3">
            3
          </button>
        </div>

        <div id="study-feedback" class="text-center font-mono text-[10px] text-amber-400 hidden">
          Correct Gemstone 1 · Reaction Time: 432ms
        </div>
      </div>
    `;
  }

  // Room 5
  return `
    <div id="sim-vault" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <button type="button" id="btn-vault-instant"
                class="p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-left transition-colors cursor-pointer">
          <div class="text-[10px] font-mono text-cyan-400 uppercase">Immediate Vault</div>
          <div class="text-lg font-mono font-bold text-cyan-200 mt-0.5">400 Coins</div>
          <div class="text-[9px] font-mono text-stone-400 mt-1">0s Delay · Instant Claim</div>
        </button>

        <button type="button" id="btn-vault-delayed"
                class="p-3 rounded-xl border border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/40 text-left transition-colors cursor-pointer">
          <div class="text-[10px] font-mono text-amber-400 uppercase">Delayed Vault</div>
          <div class="text-lg font-mono font-bold text-amber-200 mt-0.5">1000 Coins</div>
          <div class="text-[9px] font-mono text-stone-400 mt-1">15s Deep Path · Max Yield</div>
        </button>
      </div>

      <div id="vault-status-box" class="h-10 rounded-lg bg-[#04060b] border border-stone-800 flex items-center justify-center font-mono text-[10px] text-stone-400">
        Select a pathway to initiate runner journey
      </div>
    </div>
  `;
}

/**
 * Event bindings for chamber interactive previews
 */
function bindInteractiveSimulationListeners(node: QuestNodeDefinition): void {
  if (node.chamberId === 'room-1') {
    const triggerBtn = document.getElementById('btn-trigger-spire-trial');
    const flashBox = document.getElementById('spire-flash-box');
    const feedback = document.getElementById('spire-sim-feedback');

    triggerBtn?.addEventListener('click', () => {
      playTactileClick();
      // Flash screen box
      flashBox?.classList.add('bg-white', 'border-white');
      setTimeout(() => {
        flashBox?.classList.remove('bg-white', 'border-white');
      }, 55);

      // Play chime tone with delay
      setTimeout(() => {
        playWeatherSpireTone(0.4);
      }, 120);
    });

    const choices = document.querySelectorAll('.sim-spire-choice');
    choices.forEach(btn => {
      btn.addEventListener('click', () => {
        playTactileClick();
        choices.forEach(b => b.classList.remove('border-amber-400', 'text-amber-300', 'bg-amber-500/20'));
        btn.classList.add('border-amber-400', 'text-amber-300', 'bg-amber-500/20');
        if (feedback) {
          feedback.classList.remove('hidden');
          feedback.textContent = `Order Judged: ${(btn as HTMLElement).dataset.val} · Recorded`;
        }
      });
    });
  } else if (node.chamberId === 'room-2') {
    const piece = document.getElementById('parlor-piece');
    const statusText = document.getElementById('parlor-status-text');

    piece?.addEventListener('click', () => {
      playTactileClick();
      piece.classList.add('scale-125', 'rotate-12');
      if (statusText) statusText.textContent = 'Awaiting neural command latency...';

      setTimeout(() => {
        piece.classList.remove('scale-125', 'rotate-12');
        playChessPieceSound(0.5);
        if (statusText) statusText.textContent = 'Piece moved (240ms lag). Rate your agency.';
      }, 240);
    });
  } else if (node.chamberId === 'room-3') {
    const pad = document.getElementById('sim-aviary-pad');
    const counter = document.getElementById('aviary-tap-counter');
    let tapCount = 0;
    let lastTap = 0;

    pad?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playGrainSeedSound(0.4);
      tapCount++;
      const now = performance.now();
      const diff = lastTap ? Math.round(now - lastTap) : 0;
      lastTap = now;

      if (counter) {
        counter.textContent = `Taps Inscribed: ${tapCount} · Cadence: ${diff ? diff + ' ms' : 'Initiating'}`;
      }
    });

    const familiarBtns = document.querySelectorAll('.sim-familiar-btn');
    familiarBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const f = (btn as HTMLElement).dataset.familiar as 'celestial_owl' | 'storm_raven' | 'sun_hawk';
        playFamiliarCall(f);
        familiarBtns.forEach(b => b.classList.remove('border-amber-500/40', 'bg-amber-500/20', 'text-amber-300'));
        btn.classList.add('border-amber-500/40', 'bg-amber-500/20', 'text-amber-300');
      });
    });
  } else if (node.chamberId === 'room-4') {
    const gemBtns = document.querySelectorAll('.sim-gem-btn');
    const feedback = document.getElementById('study-feedback');

    gemBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = (btn as HTMLElement).dataset.gem;
        playGemstoneStoneClick(0.35);
        if (val === '1') {
          playRuneHum(300, 150);
          if (feedback) {
            feedback.classList.remove('hidden');
            feedback.textContent = '✓ Correct Unique Gemstone! RT: 388ms';
          }
        } else {
          if (feedback) {
            feedback.classList.remove('hidden');
            feedback.textContent = 'Distractor Gemstone pressed. Flanker interference detected.';
          }
        }
      });
    });
  } else if (node.chamberId === 'room-5') {
    const instantBtn = document.getElementById('btn-vault-instant');
    const delayedBtn = document.getElementById('btn-vault-delayed');
    const statusBox = document.getElementById('vault-status-box');

    instantBtn?.addEventListener('click', () => {
      playPathSelectClick();
      playCoinCollectPulse();
      playVaultArrivalChime();
      if (statusBox) {
        statusBox.innerHTML = '<span class="text-cyan-400">⚡ Claimed 400 Instant Coins into Vault!</span>';
      }
    });

    delayedBtn?.addEventListener('click', () => {
      playPathSelectClick();
      if (statusBox) {
        statusBox.innerHTML = '<span class="text-amber-400 animate-pulse">Astral runner traveling 15s deep pathway...</span>';
      }
      setTimeout(() => {
        playVaultArrivalChime();
        if (statusBox) {
          statusBox.innerHTML = '<span class="text-amber-300 font-bold">★ 1000 Coins Vaulted! High Delay Tolerance!</span>';
        }
      }, 1500);
    });
  }
}

/**
 * TEMPLE of Time - Room 4: The Puzzler's Study
 * Paradigm: Multi-Source Interference Task (MSIT) / Rune Decoding Task
 * Strict Landscape Enforcement, 3-stone Altar Base (1, 2, 3), 900ms stimulus presentation,
 * 4 conditions (Control, Simon, Flanker, Multi-Source), Miniblock clustering,
 * Sub-millisecond performance.now() telemetry, Dual persistence.
 */

import { ParticipantProfile, MSITCondition, MSITTrialLog, MSITSessionResult, MSITConditionMetrics, PsychophysicsTrial, MSITTrialPayload } from '../types';
import { playMSITCorrectTone, playMSITIncorrectTone, playGemstoneStoneClick, playTactileClick, playCompletionFanfare, playRuneHum } from '../audio';
import { recordMSITTrialLog, recordSessionCompletion, startTaskSession, bufferTrialLocally, bufferNormalizedTrialLocally, flushChamberSession } from '../store';

export interface PuzzlerStudyCallbacks {
  onComplete: (session: MSITSessionResult) => void;
  onExit: () => void;
}

export class PuzzlerStudyTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: PuzzlerStudyCallbacks;
  private sessionId = '';

  // Stimulus set per condition
  private readonly stimuli = {
    control: ['100', '020', '003'],
    simon: ['010', '001', '200', '002', '300', '030'],
    flanker: ['122', '133', '121', '323', '113', '223'],
    multisource: ['212', '313', '221', '331', '211', '233', '112', '332', '311', '322', '131', '232']
  };

  // State
  private isRunning = false;
  private activePhase: 'onboarding' | 'sandbox' | 'practice_ready' | 'practice' | 'main_ready' | 'main' | 'break' | 'completed' = 'onboarding';

  // Orientation listener handle
  private orientationHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private sandboxInputCallback: ((digit: number) => void) | null = null;

  // Sandbox validation count (must achieve 3 correct taps before advancing)
  private sandboxSuccessCount = 0;
  private sandboxCurrentStimulus = '100';

  // Trial sequences
  private practiceSequence: { condition: MSITCondition; stimulus: string; target: number }[] = [];
  private mainSequence: { miniblockId: number; condition: MSITCondition; stimulus: string; target: number; isBlockStart: boolean }[] = [];

  // Active trial state
  private currentTrialIndex = 0;
  private trialOnsetTimestamp = 0;
  private isTrialAwaitingResponse = false;
  private stimulusTimer: number | null = null;
  private activeTimeouts: number[] = [];

  // Completed rest pause milestones (60, 120, 180)
  private completedBreaks: Set<number> = new Set();

  // Logging
  private trialLogs: MSITTrialLog[] = [];
  private practiceLogs: MSITTrialLog[] = [];

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: PuzzlerStudyCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
    this.generateTrialSequences();
  }

  /**
   * Helper: determines the unique target digit from a 3-character string
   */
  public static getTargetDigit(triad: string): number {
    const counts: Record<string, number> = {};
    for (const ch of triad) {
      counts[ch] = (counts[ch] || 0) + 1;
    }
    for (const ch of triad) {
      if (counts[ch] === 1 && ch !== '0') {
        return parseInt(ch, 10);
      }
    }
    // Fallback if 0 appears once, find non-zero
    for (const ch of triad) {
      if (ch !== '0') return parseInt(ch, 10);
    }
    return 1;
  }

  /**
   * Pre-generates the 10 practice trials and 240 main experimental trials
   * (60 Control, 60 Simon, 60 Flanker, 60 Multi-Source).
   * Rules strictly enforced:
   * 1. WITHIN A MINIBLOCK: ZERO REPETITIONS (all stimuli sampled without replacement).
   * 2. ACROSS THE ENTIRE SEQUENCE: ZERO CONSECUTIVE REPETITIONS (stim[i] !== stim[i-1]).
   */
  private generateTrialSequences(): void {
    // 1. Practice trials (10 unique trials drawn across all 4 conditions, no duplicate stimuli)
    const practicePicks: { condition: MSITCondition; stimulus: string; target: number }[] = [];
    const usedPracticeStimuli = new Set<string>();
    const conditionQuotas: { cond: MSITCondition; count: number }[] = [
      { cond: 'control', count: 2 },
      { cond: 'simon', count: 3 },
      { cond: 'flanker', count: 3 },
      { cond: 'multisource', count: 2 }
    ];

    for (const quota of conditionQuotas) {
      const pool = [...this.stimuli[quota.cond]];
      this.shuffle(pool);
      let picked = 0;
      for (const stim of pool) {
        if (!usedPracticeStimuli.has(stim) && picked < quota.count) {
          usedPracticeStimuli.add(stim);
          practicePicks.push({
            condition: quota.cond,
            stimulus: stim,
            target: PuzzlerStudyTaskRunner.getTargetDigit(stim)
          });
          picked++;
        }
      }
    }

    // Shuffle practice sequence ensuring no consecutive identical stimuli or conditions
    this.shuffle(practicePicks);
    for (let i = 1; i < practicePicks.length; i++) {
      if (practicePicks[i].stimulus === practicePicks[i - 1].stimulus) {
        for (let j = i + 1; j < practicePicks.length; j++) {
          if (practicePicks[j].stimulus !== practicePicks[i - 1].stimulus) {
            [practicePicks[i], practicePicks[j]] = [practicePicks[j], practicePicks[i]];
            break;
          }
        }
      }
    }
    this.practiceSequence = practicePicks;

    // 2. Main trials (240 trials total: exactly 60 per condition)
    // Within every miniblock, trials are sampled WITHOUT REPLACEMENT so there are ZERO repetitions.
    interface Miniblock {
      condition: MSITCondition;
      trials: { stimulus: string; target: number }[];
    }
    const blocks: Miniblock[] = [];

    // Helper: sample N distinct items from pool without replacement
    const sampleUniqueFromPool = (pool: string[], n: number): string[] => {
      const copy = [...pool];
      this.shuffle(copy);
      return copy.slice(0, n);
    };

    // A. Control (pool size = 3: '100', '020', '003')
    // 20 blocks of 3 trials = 60 trials (all 3 distinct in each block)
    for (let b = 0; b < 20; b++) {
      const chosen = sampleUniqueFromPool(this.stimuli.control, 3);
      blocks.push({
        condition: 'control',
        trials: chosen.map(stim => ({ stimulus: stim, target: PuzzlerStudyTaskRunner.getTargetDigit(stim) }))
      });
    }

    // B. Simon (pool size = 6: 15 blocks of 4 trials = 60 trials, all 4 distinct in each block)
    for (let b = 0; b < 15; b++) {
      const chosen = sampleUniqueFromPool(this.stimuli.simon, 4);
      blocks.push({
        condition: 'simon',
        trials: chosen.map(stim => ({ stimulus: stim, target: PuzzlerStudyTaskRunner.getTargetDigit(stim) }))
      });
    }

    // C. Flanker (pool size = 6: 15 blocks of 4 trials = 60 trials, all 4 distinct in each block)
    for (let b = 0; b < 15; b++) {
      const chosen = sampleUniqueFromPool(this.stimuli.flanker, 4);
      blocks.push({
        condition: 'flanker',
        trials: chosen.map(stim => ({ stimulus: stim, target: PuzzlerStudyTaskRunner.getTargetDigit(stim) }))
      });
    }

    // D. Multi-Source (pool size = 12: 15 blocks of 4 trials = 60 trials, all 4 distinct in each block)
    for (let b = 0; b < 15; b++) {
      const chosen = sampleUniqueFromPool(this.stimuli.multisource, 4);
      blocks.push({
        condition: 'multisource',
        trials: chosen.map(stim => ({ stimulus: stim, target: PuzzlerStudyTaskRunner.getTargetDigit(stim) }))
      });
    }

    // Shuffle miniblocks to prevent identical conditions back-to-back
    this.shuffleBlocks(blocks);

    // Flatten into mainSequence
    this.mainSequence = [];
    let blockCounter = 1;
    for (const blk of blocks) {
      for (let i = 0; i < blk.trials.length; i++) {
        const tr = blk.trials[i];
        this.mainSequence.push({
          miniblockId: blockCounter,
          condition: blk.condition,
          stimulus: tr.stimulus,
          target: tr.target,
          isBlockStart: i === 0
        });
      }
      blockCounter++;
    }

    // STRICT CONSECUTIVE REPETITION ELIMINATION:
    // Ensure stim[i] !== stim[i - 1] across block boundaries by swapping within the block
    for (let i = 1; i < this.mainSequence.length; i++) {
      if (this.mainSequence[i].stimulus === this.mainSequence[i - 1].stimulus) {
        const currentBlockId = this.mainSequence[i].miniblockId;
        // Swap with an internal trial in the same block if possible (preserves miniblock integrity)
        let resolved = false;
        for (let j = i + 1; j < this.mainSequence.length; j++) {
          if (this.mainSequence[j].miniblockId !== currentBlockId) break;
          if (this.mainSequence[j].stimulus !== this.mainSequence[i - 1].stimulus) {
            const nextTrial = this.mainSequence[i + 1];
            if (!nextTrial || nextTrial.stimulus !== this.mainSequence[j].stimulus) {
              const temp = this.mainSequence[i];
              this.mainSequence[i] = { ...this.mainSequence[j], isBlockStart: temp.isBlockStart };
              this.mainSequence[j] = { ...temp, isBlockStart: this.mainSequence[j].isBlockStart };
              resolved = true;
              break;
            }
          }
        }

        // Secondary fallback if swap within block was constrained
        if (!resolved) {
          for (let j = i + 1; j < this.mainSequence.length; j++) {
            if (this.mainSequence[j].miniblockId === currentBlockId) {
              const temp = this.mainSequence[i];
              this.mainSequence[i] = { ...this.mainSequence[j], isBlockStart: temp.isBlockStart };
              this.mainSequence[j] = { ...temp, isBlockStart: this.mainSequence[j].isBlockStart };
              break;
            }
          }
        }
      }
    }

    // Final safety guarantee: absolutely zero consecutive duplicates
    for (let i = 1; i < this.mainSequence.length; i++) {
      if (this.mainSequence[i].stimulus === this.mainSequence[i - 1].stimulus) {
        for (let j = i + 1; j < this.mainSequence.length; j++) {
          if (
            this.mainSequence[j].stimulus !== this.mainSequence[i - 1].stimulus &&
            (!this.mainSequence[j + 1] || this.mainSequence[j + 1].stimulus !== this.mainSequence[i].stimulus)
          ) {
            const temp = this.mainSequence[i];
            this.mainSequence[i] = { ...this.mainSequence[j], isBlockStart: temp.isBlockStart };
            this.mainSequence[j] = { ...temp, isBlockStart: this.mainSequence[j].isBlockStart };
            break;
          }
        }
      }
    }
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private shuffleBlocks<T extends { condition: MSITCondition }>(blocks: T[]): void {
    this.shuffle(blocks);
    // Simple pass to separate adjacent identical conditions
    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].condition === blocks[i + 1].condition) {
        for (let j = i + 2; j < blocks.length; j++) {
          if (blocks[j].condition !== blocks[i].condition) {
            [blocks[i + 1], blocks[j]] = [blocks[j], blocks[i + 1]];
            break;
          }
        }
      }
    }
  }

  public start(): void {
    this.sessionId = startTaskSession('MSIT');
    this.isRunning = true;
    this.setupOrientationWatcher();
    this.setupKeyboardHandler();
    this.renderOnboardingBriefing();
  }

  public terminateToResults(): void {
    this.isRunning = false;
    this.clearAllTimers();
    if (this.orientationHandler) {
      window.removeEventListener('resize', this.orientationHandler);
      window.removeEventListener('orientationchange', this.orientationHandler);
      this.orientationHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.sandboxInputCallback = null;
    this.renderCompletionScreen();
  }

  public abort(): void {
    if (this.isRunning || this.trialLogs.length > 0) {
      this.terminateToResults();
    } else {
      this.isRunning = false;
      this.clearAllTimers();
      if (this.orientationHandler) {
        window.removeEventListener('resize', this.orientationHandler);
        window.removeEventListener('orientationchange', this.orientationHandler);
        this.orientationHandler = null;
      }
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      this.sandboxInputCallback = null;
      this.callbacks.onExit();
    }
  }

  /* =========================================================================
     KEYBOARD CONTROLS FOR NON-TOUCH & DESKTOP USE (1, 2, 3 BUTTONS)
     ========================================================================= */

  private setupKeyboardHandler(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.isRunning) return;

      // Ignore if user is focusing an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Check digit 1, 2, or 3 (both number row and numpad)
      let digit: number | null = null;
      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        digit = 1;
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        digit = 2;
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        digit = 3;
      }

      if (digit !== null) {
        if (this.activePhase === 'sandbox') {
          e.preventDefault();
          this.triggerSandboxDigit(digit);
          return;
        }

        if (this.activePhase === 'practice' || this.activePhase === 'main') {
          e.preventDefault();
          this.triggerArenaDigit(digit);
          return;
        }
      }

      // Escape key aborts ritual to results screen
      if (e.key === 'Escape') {
        if (this.activePhase === 'practice' || this.activePhase === 'main' || this.activePhase === 'break') {
          e.preventDefault();
          this.terminateToResults();
          return;
        }
      }

      // Enter or Space key for advancing prompts
      if (e.key === 'Enter' || e.key === ' ') {
        if (this.activePhase === 'onboarding') {
          const btn = document.getElementById('btn-msit-start-sandbox');
          if (btn) {
            e.preventDefault();
            playTactileClick();
            this.renderSandboxDemo();
          }
        } else if (this.activePhase === 'sandbox' && this.sandboxSuccessCount >= 3) {
          e.preventDefault();
          playTactileClick();
          this.sandboxInputCallback = null;
          this.clearAllTimers();
          this.startPracticePhase();
        } else if (this.activePhase === 'practice_ready') {
          const btn = document.getElementById('btn-begin-main-msit');
          if (btn) {
            e.preventDefault();
            playTactileClick();
            this.startMainTrials();
          }
        } else if (this.activePhase === 'break') {
          const btn = document.getElementById('btn-resume-msit-break');
          if (btn) {
            e.preventDefault();
            btn.click();
          }
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  public triggerSandboxDigit(digit: number): void {
    const stoneEl = document.getElementById(`sandbox-stone-${digit}`);
    if (stoneEl) {
      stoneEl.classList.add('scale-95');
      if (digit === 1) stoneEl.classList.add('border-cyan-400', 'bg-cyan-950/40');
      if (digit === 2) stoneEl.classList.add('border-amber-400', 'bg-amber-950/40');
      if (digit === 3) stoneEl.classList.add('border-emerald-400', 'bg-emerald-950/40');
      window.setTimeout(() => {
        stoneEl.classList.remove('scale-95', 'border-cyan-400', 'bg-cyan-950/40', 'border-amber-400', 'bg-amber-950/40', 'border-emerald-400', 'bg-emerald-950/40');
      }, 120);
    }

    if (this.sandboxInputCallback) {
      this.sandboxInputCallback(digit);
    }
  }

  public triggerArenaDigit(digit: number): void {
    // Visual feedback on the corresponding stone without altering UI markup
    const stoneEl = document.getElementById(`altar-stone-${digit}`);
    if (stoneEl) {
      stoneEl.classList.add('scale-95');
      if (digit === 1) stoneEl.classList.add('border-cyan-400', 'bg-cyan-950/40');
      if (digit === 2) stoneEl.classList.add('border-amber-400', 'bg-amber-950/40');
      if (digit === 3) stoneEl.classList.add('border-emerald-400', 'bg-emerald-950/40');
      window.setTimeout(() => {
        stoneEl.classList.remove('scale-95', 'border-cyan-400', 'bg-cyan-950/40', 'border-amber-400', 'bg-amber-950/40', 'border-emerald-400', 'bg-emerald-950/40');
      }, 120);
    }

    if (!this.isTrialAwaitingResponse) return;
    const rt = performance.now() - this.trialOnsetTimestamp;

    if (this.activePhase === 'practice') {
      const curTrial = this.practiceSequence[this.currentTrialIndex];
      this.handlePracticeResponse(digit, rt, curTrial, false);
    } else if (this.activePhase === 'main') {
      const curTrial = this.mainSequence[this.currentTrialIndex];
      this.handleMainResponse(digit, rt, curTrial, false);
    }
  }

  private clearAllTimers(): void {
    if (this.stimulusTimer !== null) {
      clearTimeout(this.stimulusTimer);
      this.stimulusTimer = null;
    }
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts = [];
  }

  /* =========================================================================
     LANDSCAPE ORIENTATION ENFORCEMENT
     ========================================================================= */

  private setupOrientationWatcher(): void {
    // Attempt system orientation lock if available
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore if not supported
    }

    this.orientationHandler = () => {
      this.checkOrientationState();
    };
    window.addEventListener('resize', this.orientationHandler);
    window.addEventListener('orientationchange', this.orientationHandler);
  }

  private isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  private checkOrientationState(): void {
    const overlay = document.getElementById('landscape-enforce-overlay');
    if (!overlay) return;
    if (this.isPortrait()) {
      overlay.classList.remove('hidden');
      overlay.classList.add('flex');
    } else {
      overlay.classList.add('hidden');
      overlay.classList.remove('flex');
    }
  }

  /* =========================================================================
     ONBOARDING, ERGONOMICS & INTERACTIVE DEMO (ZERO JARGON)
     ========================================================================= */

  private renderOnboardingBriefing(): void {
    this.activePhase = 'onboarding';

    this.container.innerHTML = `
      <div class="relative w-full min-h-screen bg-[#08090e] text-stone-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/Puzzler_library_bg.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/Puzzler_library_bg.png'; } else { this.src = '/puzzler_library_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-[#08090e]/85 backdrop-blur-[2px]"></div>
        </div>

        <!-- Subtle Ambient Glow -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
          <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div class="absolute bottom-0 right-10 w-[450px] h-[250px] bg-purple-500/5 rounded-full blur-[120px]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span class="text-xl">🧭</span>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-amber-400 font-semibold">Room 4</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Altar of Triads</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The Puzzler's Study
                </h1>
              </div>
            </div>

            <button id="btn-puzzler-intro-exit" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Dashboard</span>
            </button>
          </div>

          <!-- Main Instructions Body -->
          <div class="space-y-5">

            <!-- Banner Image Right Below Header with Welcome Card -->
            <div class="relative rounded-2xl overflow-hidden border border-amber-500/35 shadow-2xl bg-[#0b0e19] backdrop-blur-sm">
              <!-- Banner Image Viewport with Responsive Aspect & Fit -->
              <div class="relative w-full h-56 sm:h-72 md:h-84 lg:h-96 max-h-[420px] overflow-hidden bg-[#070913] flex items-center justify-center">
                <img 
                  src="/assets/Puzzler_library_bg.png" 
                  alt="The Puzzler's Study Library"
                  class="w-full h-full object-cover object-center sm:object-[center_35%] filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/Puzzler_library_bg.png'; } else { this.src = '/puzzler_library_bg.svg'; }"
                />
                <!-- Gradient Scrim for Visual Depth & Text Legibility -->
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0b0e19] via-[#0b0e19]/35 to-transparent"></div>
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0b0e19]/50 via-transparent to-[#0b0e19]/30"></div>
                <!-- Subtle Arcane Inner Glow -->
                <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-amber-500/20 rounded-t-2xl"></div>
              </div>

              <!-- Welcome Card (Inside / Right Below the Image) -->
              <div class="p-5 sm:p-6 bg-[#0f121d]/95 backdrop-blur-md border-t border-amber-500/30 space-y-3">
                <div class="flex items-start space-x-3.5">
                  <div class="mt-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] shrink-0"></div>
                  <div class="space-y-2.5 flex-1">
                    <h2 class="text-lg sm:text-2xl font-arcane text-amber-200 font-bold tracking-wide">
                      Welcome to the Puzzler's Study!
                    </h2>
                    <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                      Before you sits the ancient Altar of Triads.
                    </p>

                    <!-- Your Goal Card as it is -->
                    <div class="p-3.5 sm:p-4 bg-[#08090e]/80 border border-amber-500/30 rounded-xl space-y-1.5 mt-2">
                      <strong class="text-xs font-mono uppercase text-amber-400 block tracking-wider flex items-center space-x-2">
                        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span>Your Goal: Identify the Unique Rune</span>
                      </strong>
                      <p class="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
                        Find the single number that is different from the other two. Tap its matching stone at the bottom.
                        <strong class="text-amber-300 block mt-1.5">Never match the position of the rune—match only the identity of the odd number.</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Posture & Ergonomics Guide (Retained) -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-lg">
              <div class="flex items-center space-x-2 text-xs sm:text-sm font-mono text-cyan-300 font-semibold uppercase tracking-wider">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <line x1="6" y1="12" x2="18" y2="12"/>
                </svg>
                <span>Required Ergonomics & Finger Rest</span>
              </div>
              <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                Lay your device <strong>flat on a table</strong> in landscape orientation. Rest three fingers of your dominant hand hovering directly above the three altar stones:
              </p>
              <div class="grid grid-cols-3 gap-2.5 sm:gap-3 text-center text-xs font-mono pt-1">
                <div class="p-2.5 sm:p-3 rounded-xl bg-stone-900/90 border border-cyan-500/30 text-stone-200 shadow-sm">
                  <span class="text-cyan-400 font-bold block mb-1">Index Finger</span>
                  <span class="text-stone-300 font-semibold">Stone 1</span>
                </div>
                <div class="p-2.5 sm:p-3 rounded-xl bg-stone-900/90 border border-amber-500/30 text-stone-200 shadow-sm">
                  <span class="text-amber-400 font-bold block mb-1">Middle Finger</span>
                  <span class="text-stone-300 font-semibold">Stone 2</span>
                </div>
                <div class="p-2.5 sm:p-3 rounded-xl bg-stone-900/90 border border-emerald-500/30 text-stone-200 shadow-sm">
                  <span class="text-emerald-400 font-bold block mb-1">Ring Finger</span>
                  <span class="text-stone-300 font-semibold">Stone 3</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-msit-exit" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Return to Dashboard
            </button>

            <button id="btn-msit-start-sandbox" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:bg-amber-600 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Go to Interactive Tutorial</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    const handleExit = (e: Event) => {
      e.preventDefault();
      playTactileClick();
      this.abort();
    };

    const exitHeaderBtn = document.getElementById('btn-puzzler-intro-exit');
    exitHeaderBtn?.addEventListener('pointerdown', handleExit);
    exitHeaderBtn?.addEventListener('click', handleExit);

    const exitFooterBtn = document.getElementById('btn-msit-exit');
    exitFooterBtn?.addEventListener('pointerdown', handleExit);
    exitFooterBtn?.addEventListener('click', handleExit);

    const startSandboxBtn = document.getElementById('btn-msit-start-sandbox');
    const handleStartSandbox = (e: Event) => {
      e.preventDefault();
      playTactileClick();
      this.renderSandboxDemo();
    };
    startSandboxBtn?.addEventListener('pointerdown', handleStartSandbox);
    startSandboxBtn?.addEventListener('click', handleStartSandbox);
  }

  /* =========================================================================
     INTERACTIVE SANDBOX DEMO (REQUIRE 3 CONSECUTIVE CORRECT TAPS)
     ========================================================================= */

  private renderSandboxDemo(): void {
    this.activePhase = 'sandbox';
    this.sandboxSuccessCount = 0;

    const sandboxItems = [
      { stim: '100', target: 1, explanation: 'Example 1: "1 0 0" -> Tap Stone 1 (Identical number and position).' },
      { stim: '331', target: 1, explanation: 'Example 2: "3 3 1" -> Tap Stone 1 ("1" is on far right, but the odd number itself is 1; do NOT tap stone 3).' },
      { stim: '020', target: 2, explanation: 'Example 3: "0 2 0" -> Tap Stone 2 (The odd number is 2).' },
      { stim: '212', target: 1, explanation: 'Example 4: "2 1 2" -> Tap Stone 1 (The unique odd number is 1).' }
    ];

    let currentItemIdx = 0;

    const renderCurrentSandboxItem = () => {
      const item = sandboxItems[currentItemIdx % sandboxItems.length];
      this.sandboxCurrentStimulus = item.stim;
      const isMastered = this.sandboxSuccessCount >= 3;

      this.container.innerHTML = `
        <div class="fixed inset-0 z-50 bg-[#08090e] flex items-center justify-center p-3 sm:p-6 overflow-y-auto select-none">
          <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-7 space-y-4 relative overflow-hidden animate-[fadeIn_0.2s_ease]">
            
            <!-- Header -->
            <div class="flex justify-between items-center border-b border-stone-800 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Interactive Practice Sandbox
              </span>
              <span id="sandbox-counter" class="text-xs font-mono text-stone-400">
                Mastered: <strong class="${isMastered ? 'text-emerald-400' : 'text-amber-300'} font-bold">${this.sandboxSuccessCount} / 3${isMastered ? ' (Ready!)' : ''}</strong>
              </span>
            </div>

            <!-- Current Demonstration Box -->
            <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 text-center space-y-2">
              <span class="text-[10px] font-mono text-stone-500 uppercase tracking-widest block">Scrying Viewport</span>
              
              <!-- Stimulus Triad -->
              <div class="py-2">
                <span class="text-5xl sm:text-6xl font-mono font-bold text-white tracking-[0.35em] drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                  ${item.stim.split('').join(' ')}
                </span>
              </div>

              <!-- Rule Explanation -->
              <div id="sandbox-explanation" class="text-xs font-mono text-amber-200/90 pt-1">
                ${item.explanation}
              </div>
            </div>

            <!-- Interactive Altar Base Stones -->
            <div class="space-y-1.5 pt-1">
              <span class="text-[10px] font-mono text-stone-500 uppercase tracking-wider block text-center">
                Tap matching odd number stone:
              </span>

              <div class="grid grid-cols-3 gap-3">
                <div id="sandbox-stone-1" role="button" class="cursor-pointer h-16 rounded-xl bg-[#10141d] border-2 border-stone-800 hover:border-cyan-400 active:scale-95 flex items-center justify-center transition-all shadow-md">
                  <span class="text-2xl font-arcane text-stone-200 font-bold">1</span>
                </div>
                <div id="sandbox-stone-2" role="button" class="cursor-pointer h-16 rounded-xl bg-[#10141d] border-2 border-stone-800 hover:border-amber-400 active:scale-95 flex items-center justify-center transition-all shadow-md">
                  <span class="text-2xl font-arcane text-stone-200 font-bold">2</span>
                </div>
                <div id="sandbox-stone-3" role="button" class="cursor-pointer h-16 rounded-xl bg-[#10141d] border-2 border-stone-800 hover:border-emerald-400 active:scale-95 flex items-center justify-center transition-all shadow-md">
                  <span class="text-2xl font-arcane text-stone-200 font-bold">3</span>
                </div>
              </div>
            </div>

            <!-- Feedback Label -->
            <div id="sandbox-feedback" class="h-6 flex items-center justify-center text-xs font-mono text-stone-400 text-center">
              ${isMastered ? '<span class="text-emerald-400 font-bold">✓ Mastery unlocked! You may enter the practice phase.</span>' : 'Tap the stone corresponding to the odd number.'}
            </div>

            <!-- Actions -->
            <div class="flex justify-between items-center pt-2">
              <button id="btn-sandbox-back" class="px-4 py-2.5 rounded-xl border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
                Back
              </button>
              <button id="btn-sandbox-proceed" ${isMastered ? '' : 'disabled'} class="px-7 py-3 ${isMastered ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer' : 'bg-stone-800 text-stone-500 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all cursor-not-allowed'}">
                ${isMastered ? 'Enter Practice Phase' : 'Enter The Study (Complete 3)'}
              </button>
            </div>

          </div>
        </div>
      `;

      const fb = document.getElementById('sandbox-feedback');
      const proceedBtn = document.getElementById('btn-sandbox-proceed') as HTMLButtonElement | null;

      const handleProceed = (e?: Event) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (this.sandboxSuccessCount >= 3) {
          playTactileClick();
          this.sandboxInputCallback = null;
          this.clearAllTimers();
          this.startPracticePhase();
        }
      };

      proceedBtn?.addEventListener('pointerdown', handleProceed);
      proceedBtn?.addEventListener('click', handleProceed);

      let isAdvancing = false;

      const handleStoneTap = (digit: number) => {
        if (isAdvancing) return;

        if (digit === item.target) {
          playMSITCorrectTone(0.35);
          this.sandboxSuccessCount++;
          const nowMastered = this.sandboxSuccessCount >= 3;

          if (fb) {
            fb.innerHTML = `<span class="text-emerald-400 font-bold">✓ Correct! Number ${digit} was unique.${nowMastered ? ' Practice unlocked!' : ''}</span>`;
          }

          if (proceedBtn && nowMastered) {
            proceedBtn.disabled = false;
            proceedBtn.className = 'px-7 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer';
            proceedBtn.textContent = 'Enter Practice Phase';
          }

          const counter = document.getElementById('sandbox-counter');
          if (counter) {
            counter.innerHTML = `Mastered: <strong class="${nowMastered ? 'text-emerald-400' : 'text-amber-300'} font-bold">${this.sandboxSuccessCount} / 3${nowMastered ? ' (Ready!)' : ''}</strong>`;
          }

          isAdvancing = true;
          const advanceTimer = window.setTimeout(() => {
            isAdvancing = false;
            if (this.activePhase === 'sandbox') {
              currentItemIdx++;
              renderCurrentSandboxItem();
            }
          }, 600);
          this.activeTimeouts.push(advanceTimer);
        } else {
          playMSITIncorrectTone(0.35);
          if (fb) {
            fb.innerHTML = `<span class="text-rose-400 font-bold">✗ Incorrect. The unique number is ${item.target}, not ${digit}.</span>`;
          }
        }
      };

      this.sandboxInputCallback = handleStoneTap;

      document.getElementById('sandbox-stone-1')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleStoneTap(1);
      });
      document.getElementById('sandbox-stone-2')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleStoneTap(2);
      });
      document.getElementById('sandbox-stone-3')?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleStoneTap(3);
      });

      const backBtn = document.getElementById('btn-sandbox-back');
      const handleBack = (e: Event) => {
        e.preventDefault();
        playTactileClick();
        this.sandboxInputCallback = null;
        this.clearAllTimers();
        this.renderOnboardingBriefing();
      };
      backBtn?.addEventListener('pointerdown', handleBack);
      backBtn?.addEventListener('click', handleBack);
    };

    renderCurrentSandboxItem();
  }

  /* =========================================================================
     PRACTICE PHASE (10 TRIALS WITH VISUAL & AUDIO FEEDBACK)
     ========================================================================= */

  private startPracticePhase(): void {
    this.activePhase = 'practice';
    this.sandboxInputCallback = null;
    this.clearAllTimers();
    this.currentTrialIndex = 0;
    this.practiceLogs = [];
    this.renderArenaShell();
    this.checkOrientationState();
    this.runPracticeTrial(0);
  }

  private runPracticeTrial(idx: number): void {
    if (!this.isRunning || this.activePhase !== 'practice') return;

    if (idx >= this.practiceSequence.length) {
      this.renderPracticeCompletePrompt();
      return;
    }

    this.currentTrialIndex = idx;
    const trialData = this.practiceSequence[idx];

    // Show fixation cross for 1000 - 1500 ms jitter
    this.renderFixationCross();

    const itiDuration = 1000 + Math.random() * 500;
    const itiTimer = window.setTimeout(() => {
      this.presentPracticeStimulus(idx, trialData);
    }, itiDuration);
    this.activeTimeouts.push(itiTimer);
  }

  private presentPracticeStimulus(idx: number, trial: { condition: MSITCondition; stimulus: string; target: number }): void {
    if (!this.isRunning) return;

    const viewport = document.getElementById('scrying-viewport');
    if (!viewport) return;

    this.isTrialAwaitingResponse = true;
    this.trialOnsetTimestamp = performance.now();

    // Render high-contrast stimulus triad in top zone
    viewport.innerHTML = `
      <div id="active-triad" class="text-6xl sm:text-7xl font-mono font-bold text-white tracking-[0.4em] drop-shadow-[0_0_15px_rgba(255,255,255,0.45)] select-none animate-[fadeIn_0.08s_ease]">
        ${trial.stimulus.split('').join(' ')}
      </div>
    `;

    // 900 ms presentation window
    this.stimulusTimer = window.setTimeout(() => {
      if (this.isTrialAwaitingResponse) {
        this.handlePracticeResponse(null, 900, trial, true);
      }
    }, 900);
  }

  private handlePracticeResponse(responseDigit: number | null, rt: number, trial: { condition: MSITCondition; stimulus: string; target: number }, isOmission = false): void {
    if (!this.isTrialAwaitingResponse) return;
    this.isTrialAwaitingResponse = false;

    if (this.stimulusTimer !== null) {
      clearTimeout(this.stimulusTimer);
      this.stimulusTimer = null;
    }

    const isCorrect = !isOmission && responseDigit === trial.target;

    // Practice audio & visual feedback
    if (isCorrect) {
      playMSITCorrectTone(0.35);
    } else {
      playMSITIncorrectTone(0.35);
    }

    const viewport = document.getElementById('scrying-viewport');
    if (viewport) {
      let feedbackText = '<span class="text-emerald-400 font-bold">CORRECT</span>';
      if (isOmission) {
        feedbackText = '<span class="text-amber-400 font-bold">TOO SLOW</span>';
      } else if (!isCorrect) {
        feedbackText = '<span class="text-rose-400 font-bold">INCORRECT</span>';
      }
      viewport.innerHTML = `
        <div class="text-2xl font-mono tracking-widest animate-[scaleIn_0.1s_ease]">
          ${feedbackText}
        </div>
      `;
    }

    // Advance to next practice trial after 600 ms feedback display
    const feedbackTimer = window.setTimeout(() => {
      this.runPracticeTrial(this.currentTrialIndex + 1);
    }, 600);
    this.activeTimeouts.push(feedbackTimer);
  }

  private renderPracticeCompletePrompt(): void {
    this.activePhase = 'practice_ready';
    playRuneHum(200, 450);

    const viewport = document.getElementById('scrying-viewport');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="flex flex-col items-center justify-center space-y-3 p-4 text-center max-w-md animate-[fadeIn_0.2s_ease]">
        <span class="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
          Training Complete
        </span>
        <h3 class="text-xl font-arcane text-stone-100 font-semibold">
          Enter The Chamber of 240 Runes
        </h3>
        <p class="text-xs font-mono text-stone-300 leading-relaxed">
          The 240 trials will now proceed in total silence without feedback. Keep your three fingers hovering over stones 1, 2, and 3. Rest pauses will occur every 60 trials.
        </p>
        <button id="btn-begin-main-msit" class="px-8 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer">
          Begin Main Ritual
        </button>
      </div>
    `;

    const beginBtn = document.getElementById('btn-begin-main-msit');
    const handleBegin = (e: Event) => {
      e.preventDefault();
      playTactileClick();
      this.startMainTrials();
    };
    beginBtn?.addEventListener('pointerdown', handleBegin);
    beginBtn?.addEventListener('click', handleBegin);
  }

  /* =========================================================================
     MAIN EXPERIMENTAL PHASE (240 TRIALS, ZERO FEEDBACK, 3 STRUCTURED BREAKS)
     ========================================================================= */

  private startMainTrials(): void {
    this.activePhase = 'main';
    this.currentTrialIndex = 0;
    this.trialLogs = [];
    this.completedBreaks.clear();
    this.renderArenaShell();
    this.checkOrientationState();
    this.runMainTrial(0);
  }

  private runMainTrial(idx: number): void {
    if (!this.isRunning || this.activePhase !== 'main') return;

    // Check for 3 structured breaks: trial 60, 120, 180
    const breakMilestones = [60, 120, 180];
    for (const milestone of breakMilestones) {
      if (idx === milestone && !this.completedBreaks.has(milestone)) {
        this.completedBreaks.add(milestone);
        this.renderStructuredBreak(milestone);
        return;
      }
    }

    if (idx >= this.mainSequence.length) {
      this.renderCompletionScreen();
      return;
    }

    this.currentTrialIndex = idx;
    const trial = this.mainSequence[idx];

    // Inter-Block Interval (IBI) vs Inter-Trial Interval (ITI)
    const isBlockStart = trial.isBlockStart && idx > 0;
    const jitterDuration = isBlockStart
      ? 2000 + Math.random() * 500   // 2000 - 2500 ms IBI
      : 1000 + Math.random() * 500;  // 1000 - 1500 ms ITI

    this.renderFixationCross();

    const tTimer = window.setTimeout(() => {
      this.presentMainStimulus(idx, trial);
    }, jitterDuration);
    this.activeTimeouts.push(tTimer);
  }

  private presentMainStimulus(idx: number, trial: { miniblockId: number; condition: MSITCondition; stimulus: string; target: number }): void {
    if (!this.isRunning || this.activePhase !== 'main') return;

    const viewport = document.getElementById('scrying-viewport');
    if (!viewport) return;

    this.isTrialAwaitingResponse = true;
    this.trialOnsetTimestamp = performance.now();

    // Pure scrying triad presentation
    viewport.innerHTML = `
      <div id="active-triad" class="text-6xl sm:text-7xl font-mono font-bold text-white tracking-[0.4em] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] select-none">
        ${trial.stimulus.split('').join(' ')}
      </div>
    `;

    // 900 ms presentation window
    this.stimulusTimer = window.setTimeout(() => {
      if (this.isTrialAwaitingResponse) {
        this.handleMainResponse(null, 900, trial, true);
      }
    }, 900);
  }

  private handleMainResponse(responseDigit: number | null, rt: number, trial: { miniblockId: number; condition: MSITCondition; stimulus: string; target: number }, isOmission = false): void {
    if (!this.isTrialAwaitingResponse) return;
    this.isTrialAwaitingResponse = false;

    if (this.stimulusTimer !== null) {
      clearTimeout(this.stimulusTimer);
      this.stimulusTimer = null;
    }

    const isCorrect = !isOmission && responseDigit === trial.target;
    const responseTime = isOmission ? null : Math.round(rt);

    // Subtle stone tap sound
    if (!isOmission) {
      playGemstoneStoneClick(0.25);
    }

    // Log trial telemetry
    const log: MSITTrialLog = {
      trial_number: this.currentTrialIndex + 1,
      participant_id: this.profile.id,
      room_id: 'room_4_msit',
      miniblock_id: trial.miniblockId,
      condition: trial.condition,
      stimulus: trial.stimulus,
      target_digit: trial.target,
      response_digit: responseDigit,
      correct: isCorrect,
      rt_ms: responseTime,
      is_practice: false,
      timestamp: new Date().toISOString()
    };

    this.trialLogs.push(log);

    // Save to local buffer
    recordMSITTrialLog(log);

    // Normalized Production Schema Buffering (trials_msit)
    const msitPayload: MSITTrialPayload = {
      auth_user_id: this.profile.auth_user_id || this.profile.id,
      subject_id: this.profile.subject_id,
      task: 'MSIT',
      session: this.sessionId,
      trial_number: log.trial_number,
      stimulus_presented: String(log.stimulus),
      trial_type: log.condition as 'control' | 'simon' | 'flanker' | 'multisource',
      accuracy: log.correct ? 1 : 0,
      reaction_time: Number(Math.round(responseTime || 900)),
      recorded_at: log.timestamp
    };
    bufferNormalizedTrialLocally('trials_msit', msitPayload, this.sessionId);

    // Blank out top viewport immediately upon response
    const viewport = document.getElementById('scrying-viewport');
    if (viewport) {
      viewport.innerHTML = '';
    }

    // Advance to next trial (or structured break)
    this.runMainTrial(this.currentTrialIndex + 1);
  }

  /* =========================================================================
     STRUCTURED REST BREAKS (TRIALS 60, 120, 180)
     ========================================================================= */

  private renderStructuredBreak(breakTrialIndex: number): void {
    this.activePhase = 'break';
    playRuneHum(180, 400);

    const viewport = document.getElementById('scrying-viewport');
    if (!viewport) return;

    const breakNames: Record<number, string> = {
      60: 'First Interval Rest (Quarter 1)',
      120: 'Halfway Respite (Halftime)',
      180: 'Final Interval Rest (Quarter 3)'
    };

    viewport.innerHTML = `
      <div class="flex flex-col items-center justify-center space-y-3 p-4 text-center max-w-md animate-[fadeIn_0.3s_ease]">
        <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <span class="text-xl">⏳</span>
        </div>
        <span class="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
          ${breakNames[breakTrialIndex] || 'Chamber Pause'}
        </span>
        <h3 class="text-lg font-arcane text-stone-100 font-semibold">
          Rest Your Senses
        </h3>
        <p class="text-xs font-mono text-stone-400 leading-relaxed">
          Take a deep breath and rest your fingers. Maintain your seated posture before the altar.
        </p>
        <button id="btn-resume-msit-break" class="px-7 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] cursor-pointer">
          Tap When Ready to Resume
        </button>
      </div>
    `;

    const resumeBtn = document.getElementById('btn-resume-msit-break');
    if (resumeBtn) {
      const handleResume = (e: Event) => {
        e.preventDefault();
        playTactileClick();
        this.activePhase = 'main';
        this.runMainTrial(breakTrialIndex);
      };
      resumeBtn.addEventListener('pointerdown', handleResume);
      resumeBtn.addEventListener('click', handleResume);
    }
  }

  /* =========================================================================
     VIEWPORT & ARENA SHELL ARCHITECTURE
     ========================================================================= */

  private renderFixationCross(): void {
    const viewport = document.getElementById('scrying-viewport');
    if (viewport) {
      viewport.innerHTML = `
        <div class="text-3xl font-mono text-stone-300 font-light select-none">
          +
        </div>
      `;
    }
  }

  /**
   * Constructs the split-view visual architecture:
   * Top 65%: Scrying Viewport (pure #000000 isolation)
   * Divider line
   * Bottom 35%: Fixed 3-stone Altar Base (1, 2, 3)
   * Landscape enforcement overlay
   */
  private renderArenaShell(): void {
    this.container.innerHTML = `
      <div id="msit-arena-container" class="fixed inset-0 z-50 bg-[#000000] flex flex-col justify-between select-none overflow-hidden touch-none">
        
        <!-- TOP ZONE (65%): Scrying Viewport -->
        <div class="relative w-full h-[65%] flex flex-col items-center justify-between p-3">
          
          <!-- Subtle top abort button in corner -->
          <div class="w-full flex justify-between items-center text-[10px] font-mono text-stone-800 pointer-events-auto">
            <span>THE PUZZLER'S STUDY // MSIT</span>
            <button id="msit-abort-btn" class="px-2 py-1 text-stone-800 hover:text-stone-500 transition-colors cursor-pointer">ESC / EXIT</button>
          </div>

          <!-- Central Scrying Viewport (Stimulus Triad / Fixation Cross) -->
          <div id="scrying-viewport" class="flex-1 flex items-center justify-center w-full">
            <!-- Dynamically populated -->
          </div>

          <!-- Invisible spacer to keep center balanced -->
          <div class="h-4"></div>
        </div>

        <!-- DIVIDER BOUNDARY -->
        <div class="w-full h-px bg-stone-900 border-b border-amber-500/10"></div>

        <!-- BOTTOM ZONE (35%): Fixed Altar Base (Stones 1, 2, 3) -->
        <div id="altar-base-zone" class="w-full h-[35%] bg-[#08090e] border-t border-stone-900/80 p-3 sm:p-4 flex items-center justify-center">
          <div class="w-full max-w-2xl h-full flex items-center justify-between gap-3 sm:gap-6">
            
            <!-- Stone 1 (Lapis Blue Aura) -->
            <div id="altar-stone-1" 
                 role="button" 
                 tabindex="0"
                 class="altar-gemstone flex-1 h-full rounded-2xl bg-[#0f121d] border-2 border-stone-800 hover:border-cyan-400 active:border-cyan-300 active:bg-cyan-950/40 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              <span class="text-3xl sm:text-4xl font-arcane text-stone-100 font-bold select-none">1</span>
              <span class="text-[9px] font-mono text-stone-500 uppercase tracking-widest mt-0.5">Index</span>
            </div>

            <!-- Stone 2 (Amber Aura) -->
            <div id="altar-stone-2" 
                 role="button" 
                 tabindex="0"
                 class="altar-gemstone flex-1 h-full rounded-2xl bg-[#0f121d] border-2 border-stone-800 hover:border-amber-400 active:border-amber-300 active:bg-amber-950/40 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              <span class="text-3xl sm:text-4xl font-arcane text-stone-100 font-bold select-none">2</span>
              <span class="text-[9px] font-mono text-stone-500 uppercase tracking-widest mt-0.5">Middle</span>
            </div>

            <!-- Stone 3 (Emerald Aura) -->
            <div id="altar-stone-3" 
                 role="button" 
                 tabindex="0"
                 class="altar-gemstone flex-1 h-full rounded-2xl bg-[#0f121d] border-2 border-stone-800 hover:border-emerald-400 active:border-emerald-300 active:bg-emerald-950/40 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
              <span class="text-3xl sm:text-4xl font-arcane text-stone-100 font-bold select-none">3</span>
              <span class="text-[9px] font-mono text-stone-500 uppercase tracking-widest mt-0.5">Ring</span>
            </div>

          </div>
        </div>

        <!-- STRICT LANDSCAPE ENFORCEMENT OVERLAY -->
        <div id="landscape-enforce-overlay" class="hidden fixed inset-0 z-50 bg-[#06070a] p-6 flex-col items-center justify-center text-center space-y-4">
          <div class="w-16 h-16 rounded-2xl border-2 border-amber-400/50 bg-amber-500/10 flex items-center justify-center text-amber-300 animate-pulse">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <path d="M12 18h.01"/>
            </svg>
          </div>
          <h3 class="text-xl font-arcane text-stone-100 font-semibold">
            Rotate Device to Landscape
          </h3>
          <p class="text-xs font-mono text-stone-400 max-w-sm leading-relaxed">
            The Puzzler's Study requires landscape orientation. Please rotate your phone and place it flat on the table to access all 3 altar stones.
          </p>
        </div>

      </div>
    `;

    const handleAbort = (e: Event) => {
      e.preventDefault();
      this.terminateToResults();
    };

    document.getElementById('msit-abort-btn')?.addEventListener('pointerdown', handleAbort);
    document.getElementById('msit-abort-btn')?.addEventListener('click', handleAbort);

    // STRICT INPUT LATENCY PROTOCOL: Bind stones to pointerdown
    document.getElementById('altar-stone-1')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.triggerArenaDigit(1);
    });

    document.getElementById('altar-stone-2')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.triggerArenaDigit(2);
    });

    document.getElementById('altar-stone-3')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.triggerArenaDigit(3);
    });
  }

  /* =========================================================================
     COMPLETION SCREEN, ANALYTICS & INTERFERENCE COST BREAKDOWN
     ========================================================================= */

  private renderCompletionScreen(): void {
    this.activePhase = 'completed';
    this.isRunning = false;
    this.clearAllTimers();
    if (this.orientationHandler) {
      window.removeEventListener('resize', this.orientationHandler);
      window.removeEventListener('orientationchange', this.orientationHandler);
      this.orientationHandler = null;
    }
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    playCompletionFanfare();

    const trials = this.trialLogs;
    const total = trials.length;
    const validTrials = trials.filter(t => t.response_digit !== null);
    const correctTrials = trials.filter(t => t.correct);

    const overallAccuracy = total > 0 ? Math.round((correctTrials.length / total) * 100) : null;

    // Median RT across all correct responses
    const correctRts = correctTrials.map(t => t.rt_ms!).filter(rt => typeof rt === 'number' && !isNaN(rt)).sort((a, b) => a - b);
    let medianRt: number | null = null;
    if (correctRts.length > 0) {
      const mid = Math.floor(correctRts.length / 2);
      medianRt = correctRts.length % 2 !== 0 ? correctRts[mid] : Math.round((correctRts[mid - 1] + correctRts[mid]) / 2);
    }

    // Condition breakdowns
    const condKeys: MSITCondition[] = ['control', 'simon', 'flanker', 'multisource'];
    const breakdown: Record<MSITCondition, { count: number; accuracyPct: number | null; meanRtMs: number | null; interferenceCostMs: number | null }> = {
      control: { count: 0, accuracyPct: null, meanRtMs: null, interferenceCostMs: null },
      simon: { count: 0, accuracyPct: null, meanRtMs: null, interferenceCostMs: null },
      flanker: { count: 0, accuracyPct: null, meanRtMs: null, interferenceCostMs: null },
      multisource: { count: 0, accuracyPct: null, meanRtMs: null, interferenceCostMs: null }
    };

    condKeys.forEach(cond => {
      const cTrials = trials.filter(t => t.condition === cond);
      const cCorrect = cTrials.filter(t => t.correct);
      const count = cTrials.length;
      const acc = count > 0 ? Math.round((cCorrect.length / count) * 100) : null;
      const cRts = cCorrect.map(t => t.rt_ms!).filter(rt => typeof rt === 'number' && !isNaN(rt));
      const meanRt = cRts.length > 0 ? Math.round(cRts.reduce((a, b) => a + b, 0) / cRts.length) : null;

      breakdown[cond] = {
        count,
        accuracyPct: acc,
        meanRtMs: meanRt,
        interferenceCostMs: null
      };
    });

    // Interference costs relative to control mean RT
    const hasControlMean = breakdown.control.count > 0 && breakdown.control.meanRtMs !== null;
    const controlRt = hasControlMean ? breakdown.control.meanRtMs! : medianRt;

    condKeys.forEach(cond => {
      if (cond === 'control') {
        breakdown[cond].interferenceCostMs = 0;
      } else {
        if (breakdown[cond].meanRtMs !== null && controlRt !== null) {
          breakdown[cond].interferenceCostMs = Math.max(0, breakdown[cond].meanRtMs! - controlRt);
        } else {
          breakdown[cond].interferenceCostMs = null;
        }
      }
    });

    const msitCost = breakdown.multisource.interferenceCostMs;

    // Record session completion
    recordSessionCompletion('room-4', overallAccuracy ?? 50);

    // Flush all buffered trials from this chamber session in batch to Supabase (even 1 trial)
    flushChamberSession(this.sessionId, 'room-4').catch(() => {});

    const sessionResult: MSITSessionResult = {
      roomId: 'room-4',
      roomName: "The Puzzler's Study",
      totalTrials: total,
      overallAccuracyPct: overallAccuracy ?? 0,
      medianRtMs: medianRt ?? 0,
      conditionBreakdown: {
        control: { count: breakdown.control.count, accuracyPct: breakdown.control.accuracyPct ?? 0, meanRtMs: breakdown.control.meanRtMs ?? 0, interferenceCostMs: breakdown.control.interferenceCostMs ?? 0 },
        simon: { count: breakdown.simon.count, accuracyPct: breakdown.simon.accuracyPct ?? 0, meanRtMs: breakdown.simon.meanRtMs ?? 0, interferenceCostMs: breakdown.simon.interferenceCostMs ?? 0 },
        flanker: { count: breakdown.flanker.count, accuracyPct: breakdown.flanker.accuracyPct ?? 0, meanRtMs: breakdown.flanker.meanRtMs ?? 0, interferenceCostMs: breakdown.flanker.interferenceCostMs ?? 0 },
        multisource: { count: breakdown.multisource.count, accuracyPct: breakdown.multisource.accuracyPct ?? 0, meanRtMs: breakdown.multisource.meanRtMs ?? 0, interferenceCostMs: breakdown.multisource.interferenceCostMs ?? 0 }
      },
      trials: this.trialLogs,
      completedAt: new Date().toISOString()
    };

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto select-none">
        
        <div class="max-w-4xl mx-auto w-full space-y-6 flex-1 animate-[fadeIn_0.3s_ease]">
          
          <!-- Header -->
          <div class="border-b border-stone-800 pb-4">
            <div class="text-xs font-mono uppercase tracking-wider text-yellow-400 mb-1 font-semibold">
              Room 4: The Puzzler's Study
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-white font-semibold">
              Multisource Interference Cost
            </h1>
            <p class="text-xs sm:text-sm text-emerald-400 font-sans mt-1">
              Chamber Calibrated. Return tomorrow to reinforce your cognitive focus.
            </p>
          </div>

          <!-- Overall Summary Cards (2 boxes: Overall Accuracy & Reaction Time) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Overall Accuracy</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-amber-300 font-mono-num">
                  ${overallAccuracy !== null ? `${overallAccuracy}%` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">${correctTrials.length} / ${total} Correct</span>
            </div>

            <div class="bg-[#0f121d] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Median Reaction Time</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-cyan-300 font-mono-num">
                  ${medianRt !== null ? `${medianRt}<span class="text-xs font-mono text-stone-400 ml-1">ms</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Processing Speed</span>
            </div>

          </div>

          <!-- Condition Breakdown Table -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-5 space-y-3 overflow-x-auto">
            <div class="flex justify-between items-center border-b border-stone-800/80 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Multi-Source Interference Breakdown
              </span>
              <span class="text-[11px] font-mono text-stone-500">60 Trials Per Condition</span>
            </div>

            <table class="w-full text-left text-xs font-mono text-stone-300">
              <thead>
                <tr class="border-b border-stone-800 text-stone-500">
                  <th class="py-2">Condition</th>
                  <th class="py-2">Trials</th>
                  <th class="py-2">Accuracy</th>
                  <th class="py-2">Mean RT</th>
                  <th class="py-2">Interference Cost</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-800/60">
                <tr>
                  <td class="py-2.5 font-bold text-stone-200">Control (Neutral)</td>
                  <td class="py-2.5 text-stone-400">${breakdown.control.count}</td>
                  <td class="py-2.5 ${breakdown.control.accuracyPct !== null ? 'text-emerald-400' : 'text-stone-500'}">
                    ${breakdown.control.accuracyPct !== null ? `${breakdown.control.accuracyPct}%` : 'Not enough trials'}
                  </td>
                  <td class="py-2.5">${breakdown.control.meanRtMs !== null ? `${breakdown.control.meanRtMs} ms` : 'Not enough trials'}</td>
                  <td class="py-2.5 text-stone-500">${breakdown.control.meanRtMs !== null ? '0 ms (Baseline)' : 'Not enough trials'}</td>
                </tr>
                <tr>
                  <td class="py-2.5 font-bold text-cyan-300">Simon (Spatial Conflict)</td>
                  <td class="py-2.5 text-stone-400">${breakdown.simon.count}</td>
                  <td class="py-2.5 ${breakdown.simon.accuracyPct !== null ? 'text-cyan-400' : 'text-stone-500'}">
                    ${breakdown.simon.accuracyPct !== null ? `${breakdown.simon.accuracyPct}%` : 'Not enough trials'}
                  </td>
                  <td class="py-2.5">${breakdown.simon.meanRtMs !== null ? `${breakdown.simon.meanRtMs} ms` : 'Not enough trials'}</td>
                  <td class="py-2.5 ${breakdown.simon.interferenceCostMs !== null ? 'text-amber-300' : 'text-stone-500'}">
                    ${breakdown.simon.interferenceCostMs !== null ? `+${breakdown.simon.interferenceCostMs} ms` : 'Not enough trials'}
                  </td>
                </tr>
                <tr>
                  <td class="py-2.5 font-bold text-amber-300">Flanker (Active Distractor)</td>
                  <td class="py-2.5 text-stone-400">${breakdown.flanker.count}</td>
                  <td class="py-2.5 ${breakdown.flanker.accuracyPct !== null ? 'text-amber-400' : 'text-stone-500'}">
                    ${breakdown.flanker.accuracyPct !== null ? `${breakdown.flanker.accuracyPct}%` : 'Not enough trials'}
                  </td>
                  <td class="py-2.5">${breakdown.flanker.meanRtMs !== null ? `${breakdown.flanker.meanRtMs} ms` : 'Not enough trials'}</td>
                  <td class="py-2.5 ${breakdown.flanker.interferenceCostMs !== null ? 'text-amber-300' : 'text-stone-500'}">
                    ${breakdown.flanker.interferenceCostMs !== null ? `+${breakdown.flanker.interferenceCostMs} ms` : 'Not enough trials'}
                  </td>
                </tr>
                <tr>
                  <td class="py-2.5 font-bold text-rose-300">Multi-Source (Simon + Flanker)</td>
                  <td class="py-2.5 text-stone-400">${breakdown.multisource.count}</td>
                  <td class="py-2.5 ${breakdown.multisource.accuracyPct !== null ? 'text-rose-400' : 'text-stone-500'}">
                    ${breakdown.multisource.accuracyPct !== null ? `${breakdown.multisource.accuracyPct}%` : 'Not enough trials'}
                  </td>
                  <td class="py-2.5">${breakdown.multisource.meanRtMs !== null ? `${breakdown.multisource.meanRtMs} ms` : 'Not enough trials'}</td>
                  <td class="py-2.5 ${breakdown.multisource.interferenceCostMs !== null ? 'text-rose-300' : 'text-stone-500'}">
                    ${breakdown.multisource.interferenceCostMs !== null ? `+${breakdown.multisource.interferenceCostMs} ms` : 'Not enough trials'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Ethereal Chamber Seals Inscribed Status -->
          <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-mono">
            <div class="text-stone-300 flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span><strong class="text-emerald-400">Session recorded</strong> · Session <code class="text-amber-300">${this.sessionId}</code> synchronized.</span>
            </div>
            <div class="text-stone-500 text-[11px]">
              ${total} Trials Inscribed
            </div>
          </div>

        </div>

        <!-- Action Footer -->
        <div class="max-w-4xl mx-auto w-full pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs bg-emerald-950/20 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Task data saved</span>
          </div>

          <div class="w-full sm:w-auto flex items-center space-x-3">
            <button id="btn-msit-replay" class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              Replay
            </button>
            <button id="btn-msit-return-dashboard" class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
              <span>Return to Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Application Master Footer -->
        <footer id="app-footer" class="max-w-4xl mx-auto w-full pt-8 pb-3 text-center">
          TEMPLE of TIME: Timescales of Experience: Motor, Perceptual & Latency of Executive-function
        </footer>

      </div>
    `;

    document.getElementById('btn-msit-replay')?.addEventListener('click', () => {
      playTactileClick();
      this.start();
    });

    document.getElementById('btn-msit-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.callbacks.onComplete(sessionResult);
    });
  }
}

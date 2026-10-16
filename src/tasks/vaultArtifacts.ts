/**
 * TEMPLE of Time - Room 5: The Vault of Artifacts
 * Scientific Paradigm: Real-Time Experiential Delay Discounting / Intertemporal Choice Task
 * Core Temporal Construct: Experiential Intertemporal Valuation, Subjective Value Decay,
 * Impulsive vs. Self-Controlled Decision Making across real-time delays (0 s, 7 s, 15 s, 30 s, 60 s).
 *
 * Technical architecture:
 * - Vanilla HTML5/CSS3/JavaScript (ES6+)
 * - Zero external runtime dependencies
 * - Zero-latency procedural Web Audio sound synthesis
 * - pointerdown event bindings + sub-millisecond performance.now() telemetry
 * - Strict landscape enforcement overlay
 * - 5-lane track architecture (Lane 1 = 0s, Lane 2 = 7s, Lane 3 = 15s, Lane 4 = 30s, Lane 5 = 60s)
 * - Dual persistence (localStorage 'TEMPLE_ROOM5_LOGS' & Supabase sync queue)
 */

import { ParticipantProfile, VaultAvatar, DelayChoice, VaultArtifactsTrialLog, VaultArtifactsSessionResult, PsychophysicsTrial, DDTrialPayload } from '../types';
import { playPathSelectClick, playVaultArrivalChime, playCoinCollectPulse, playTactileClick, playCompletionFanfare } from '../audio';
import { recordVaultTrialLog, recordSessionCompletion, startTaskSession, bufferTrialLocally, bufferNormalizedTrialLocally, flushChamberSession } from '../store';

export interface VaultArtifactsCallbacks {
  onComplete: (session: VaultArtifactsSessionResult) => void;
  onExit: () => void;
}

interface TrialConfig {
  trialNumber: number;
  delayedDurationS: number;   // 7, 15, 30, or 60
  immediateRewardCoins: number; // 100, 400, or 700
  delayedRewardCoins: number;   // Always 1000
}

interface AvatarInfo {
  id: VaultAvatar;
  name: string;
  title: string;
  auraColor: string;
  borderColor: string;
  bgGlow: string;
  lore: string;
  svgIcon: string;
}

const AVATARS: AvatarInfo[] = [
  {
    id: 'chrono_warden',
    name: 'Chrono-Warden',
    title: 'Shield of Aeons',
    auraColor: 'text-cyan-300',
    borderColor: 'border-cyan-400',
    bgGlow: 'bg-cyan-500/10',
    lore: 'Steadfast defender of ancient temporal seals, unyielding against the tides of entropy.',
    svgIcon: `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <circle cx="12" cy="11" r="3"/>
      </svg>
    `
  },
  {
    id: 'astral_scout',
    name: 'Astral Scout',
    title: 'Winged Stride',
    auraColor: 'text-amber-300',
    borderColor: 'border-amber-400',
    bgGlow: 'bg-amber-500/10',
    lore: 'Swift navigator of starry currents, capable of riding the fastest temporal rifts.',
    svgIcon: `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `
  },
  {
    id: 'void_seeker',
    name: 'Void Seeker',
    title: 'Dimensional Rift',
    auraColor: 'text-indigo-300',
    borderColor: 'border-indigo-400',
    bgGlow: 'bg-indigo-500/10',
    lore: 'A silent voyager who steps beyond the clock face to plunge into abyssal depths.',
    svgIcon: `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a7 7 0 0 0 0 14 7 7 0 0 0 0-14z"/>
        <circle cx="12" cy="9" r="1"/>
      </svg>
    `
  },
  {
    id: 'solar_courier',
    name: 'Solar Courier',
    title: 'Radiant Pulse',
    auraColor: 'text-rose-300',
    borderColor: 'border-rose-400',
    bgGlow: 'bg-rose-500/10',
    lore: 'Bearer of the golden sundial flame, illuminating hidden hoards across time.',
    svgIcon: `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    `
  }
];

export class VaultArtifactsTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: VaultArtifactsCallbacks;
  private sessionId = '';

  // State
  private isRunning = false;
  private activePhase: 'onboarding' | 'tutorial' | 'trial_choice' | 'realtime_traversal' | 'completed' = 'onboarding';
  private chosenAvatar: AvatarInfo = AVATARS[0];

  // Orientation listener handle
  private orientationHandler: (() => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Trial sequence (36 trials)
  private trials: TrialConfig[] = [];
  private currentTrialIndex = 0;
  private trialOnsetTimestamp = 0;
  private isAwaitingChoice = false;

  // Real-time animation state
  private animationFrameId: number | null = null;
  private activeTimeouts: number[] = [];

  // Accumulated score and logging
  private totalAccumulatedCoins = 0;
  private trialLogs: VaultArtifactsTrialLog[] = [];

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: VaultArtifactsCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
    this.generateTrialSequence();
  }

  /**
   * Pre-generates the 36 trials:
   * 4 delays (7s, 15s, 30s, 60s) x 3 immediate rewards (100, 400, 700) x 3 repetitions = 36 trials.
   * Pseudo-randomized ensuring no consecutive identical condition configurations.
   */
  private generateTrialSequence(): void {
    const delays = [7, 15, 30, 60];
    const immediateAmounts = [100, 400, 700];
    const baseCombinations: { delay: number; immediate: number }[] = [];

    // 3 repetitions of each of the 12 pairs
    for (let rep = 0; rep < 3; rep++) {
      for (const d of delays) {
        for (const imm of immediateAmounts) {
          baseCombinations.push({ delay: d, immediate: imm });
        }
      }
    }

    // Shuffle with pseudo-random pass ensuring no consecutive identical (delay, immediate) pairs
    this.shuffle(baseCombinations);
    for (let i = 1; i < baseCombinations.length; i++) {
      if (
        baseCombinations[i].delay === baseCombinations[i - 1].delay &&
        baseCombinations[i].immediate === baseCombinations[i - 1].immediate
      ) {
        for (let j = i + 1; j < baseCombinations.length; j++) {
          if (
            baseCombinations[j].delay !== baseCombinations[i - 1].delay ||
            baseCombinations[j].immediate !== baseCombinations[i - 1].immediate
          ) {
            [baseCombinations[i], baseCombinations[j]] = [baseCombinations[j], baseCombinations[i]];
            break;
          }
        }
      }
    }

    this.trials = baseCombinations.map((comb, idx) => ({
      trialNumber: idx + 1,
      delayedDurationS: comb.delay,
      immediateRewardCoins: comb.immediate,
      delayedRewardCoins: 1000
    }));
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  public start(): void {
    this.sessionId = startTaskSession('DD');
    this.isRunning = true;
    this.setupOrientationWatcher();
    this.setupKeyboardHandler();
    this.renderOnboarding();
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
      this.callbacks.onExit();
    }
  }

  private clearAllTimers(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts = [];
  }

  /* =========================================================================
     LANDSCAPE ORIENTATION ENFORCEMENT
     ========================================================================= */

  private setupOrientationWatcher(): void {
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        (screen.orientation as any).lock('landscape').catch(() => {});
      }
    } catch {
      // Ignored if unsupported
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
    const overlay = document.getElementById('vault-landscape-overlay');
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
     KEYBOARD HANDLER FOR DESKTOP & ACCESSIBILITY (1 = Immediate, 2 = Delayed)
     ========================================================================= */

  private setupKeyboardHandler(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.isRunning) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Choice phase: 1 for immediate, 2 for delayed
      if (this.activePhase === 'trial_choice' && this.isAwaitingChoice) {
        if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
          e.preventDefault();
          this.handleChoiceSelection('immediate');
          return;
        }
        if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
          e.preventDefault();
          this.handleChoiceSelection('delayed');
          return;
        }
      }

      // Escape key to exit directly to results
      if (e.key === 'Escape') {
        if (this.activePhase === 'trial_choice' || this.activePhase === 'realtime_traversal') {
          e.preventDefault();
          this.terminateToResults();
          return;
        }
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
  }

  /* =========================================================================
     ONBOARDING, AVATAR SELECTION & BRIEFING (ZERO JARGON)
     ========================================================================= */

  private renderOnboarding(): void {
    this.activePhase = 'onboarding';

    this.container.innerHTML = `
      <div class="relative w-full min-h-screen bg-[#08090e] text-stone-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/DD_race_track_bg.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/DD_race_track_bg.png'; } else { this.src = '/dd_race_track_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-[#08090e]/85 backdrop-blur-[2px]"></div>
        </div>

        <!-- Subtle Ambient Glow -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
          <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div class="absolute bottom-0 right-10 w-[450px] h-[250px] bg-rose-500/5 rounded-full blur-[120px]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span class="text-xl">🏛️</span>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-amber-400 font-semibold">Room 5</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Chrono expedition</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The Vault of Artifacts
                </h1>
              </div>
            </div>

            <button id="btn-vault-intro-exit" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
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
                  src="/assets/DD_race_track_bg.png" 
                  alt="The Vault of Artifacts Race Track"
                  class="w-full h-full object-cover object-center sm:object-[center_40%] filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/DD_race_track_bg.png'; } else { this.src = '/dd_race_track_bg.svg'; }"
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
                      Welcome to the vault of artifacts!
                    </h2>
                    <p class="text-sm sm:text-base text-stone-100 font-medium leading-relaxed font-sans">
                      Two paths will open on each trail. One path gives an immediate reward. The other gives you a grand award (1000 coins), but requires you to run longer.
                    </p>
                    <p class="text-xs sm:text-sm text-stone-300 font-mono leading-relaxed bg-[#08090e]/80 border border-amber-500/20 p-3 rounded-xl">
                      ⚡ <span class="text-amber-300 font-semibold">Note:</span> Your runner will travel across the path in real time. Once they reach the vault on the right, the coins are secured into your treasury.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Retained 4 Side-by-Side Cards Depicting Vault Treasure Values -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-2.5 shadow-lg">
              <div class="flex items-center space-x-2 text-xs font-mono text-amber-400 uppercase tracking-widest font-semibold">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Vault Treasure Values</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center text-xs font-mono">
                <div class="p-3 rounded-xl bg-stone-900/90 border border-stone-800">
                  <span class="text-amber-300 font-bold block text-sm sm:text-base">100 Coins</span>
                  <span class="text-stone-400 text-[11px] block mt-0.5">Modest Cache</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Immediate</span>
                </div>
                <div class="p-3 rounded-xl bg-stone-900/90 border border-stone-800">
                  <span class="text-amber-300 font-bold block text-sm sm:text-base">400 Coins</span>
                  <span class="text-stone-400 text-[11px] block mt-0.5">Fine Chest</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Immediate</span>
                </div>
                <div class="p-3 rounded-xl bg-stone-900/90 border border-stone-800">
                  <span class="text-amber-300 font-bold block text-sm sm:text-base">700 Coins</span>
                  <span class="text-stone-400 text-[11px] block mt-0.5">Royal Relic</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Immediate</span>
                </div>
                <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                  <span class="text-amber-200 font-bold block text-sm sm:text-base">1000 Coins ★</span>
                  <span class="text-amber-300 text-[11px] block mt-0.5 font-semibold">Grand Hoard</span>
                  <span class="text-[10px] text-amber-400/80 font-mono mt-1 block">Delayed Vault</span>
                </div>
              </div>
            </div>

            <!-- 4 Side-by-Side Cards of Delayed Paths (7s, 15s, 30s, 60s) -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-2.5 shadow-lg">
              <div class="flex items-center space-x-2 text-xs font-mono text-cyan-300 uppercase tracking-widest font-semibold">
                <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span>Delayed Paths</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center text-xs font-mono">
                <div class="p-3 rounded-xl bg-stone-900/90 border border-cyan-500/30">
                  <span class="text-cyan-300 font-bold block text-sm sm:text-base">7s</span>
                  <span class="text-stone-300 text-[11px] block mt-0.5 font-semibold">Sprint Lane</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Fast Current</span>
                </div>
                <div class="p-3 rounded-xl bg-stone-900/90 border border-cyan-500/30">
                  <span class="text-cyan-300 font-bold block text-sm sm:text-base">15s</span>
                  <span class="text-stone-300 text-[11px] block mt-0.5 font-semibold">Paced Lane</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Steady Current</span>
                </div>
                <div class="p-3 rounded-xl bg-stone-900/90 border border-cyan-500/30">
                  <span class="text-cyan-300 font-bold block text-sm sm:text-base">30s</span>
                  <span class="text-stone-300 text-[11px] block mt-0.5 font-semibold">Endurance Lane</span>
                  <span class="text-[10px] text-stone-500 font-mono mt-1 block">Deep Current</span>
                </div>
                <div class="p-3 rounded-xl bg-stone-900/90 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                  <span class="text-indigo-300 font-bold block text-sm sm:text-base">60s</span>
                  <span class="text-stone-300 text-[11px] block mt-0.5 font-semibold">Marathon Lane</span>
                  <span class="text-[10px] text-indigo-400/80 font-mono mt-1 block">Grand Current</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-vault-exit" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Return to Dashboard
            </button>

            <button id="btn-vault-start-tutorial" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:bg-amber-600 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Begin Interactive Tutorial</span>
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

    const exitHeaderBtn = document.getElementById('btn-vault-intro-exit');
    exitHeaderBtn?.addEventListener('pointerdown', handleExit);
    exitHeaderBtn?.addEventListener('click', handleExit);

    const exitFooterBtn = document.getElementById('btn-vault-exit');
    exitFooterBtn?.addEventListener('pointerdown', handleExit);
    exitFooterBtn?.addEventListener('click', handleExit);

    const tutorialBtn = document.getElementById('btn-vault-start-tutorial');
    const handleStartTutorial = (e: Event) => {
      e.preventDefault();
      playTactileClick();
      this.renderInteractiveTutorial();
    };
    tutorialBtn?.addEventListener('pointerdown', handleStartTutorial);
    tutorialBtn?.addEventListener('click', handleStartTutorial);
  }

  /* =========================================================================
     INTERACTIVE TUTORIAL DEMO (TEST IMMEDIATE VS REAL-TIME DELAYED TRAVERSAL)
     ========================================================================= */

  private renderInteractiveTutorial(): void {
    this.activePhase = 'tutorial';
    this.clearAllTimers();

    let progressTimer: number | null = null;

    this.container.innerHTML = `
      <div class="relative w-full min-h-screen bg-[#08090e] text-stone-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        
        <!-- Subtle Ambient Glow -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
          <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div class="absolute bottom-0 right-10 w-[450px] h-[250px] bg-cyan-500/5 rounded-full blur-[120px]"></div>
        </div>

        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <span class="text-xl">🏃</span>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-cyan-400 font-semibold">Interactive Tutorial</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Test Traversal</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  Practice Path Selection
                </h1>
              </div>
            </div>

            <button id="btn-tutorial-exit-dash" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Dashboard</span>
            </button>
          </div>

          <!-- Tutorial Explanation & Interactive Area -->
          <div class="space-y-4">
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-2 shadow-lg">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Tutorial: Test Both Options Below</span>
              </span>
              <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                On each trial, two pathways will illuminate. Tap one of the two cards below to observe how immediate rewards collect instantly, whereas delayed rewards dispatch your runner across the track in real time.
              </p>
            </div>

            <!-- The Two Choice Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <!-- Immediate Option -->
              <div id="btn-tutorial-choice-imm" 
                   role="button" 
                   class="cursor-pointer p-4 rounded-xl border-2 border-amber-500/40 bg-stone-900/80 hover:border-amber-400 hover:bg-stone-900 transition-all flex items-center space-x-4 shadow-md group">
                <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 text-xl shrink-0 group-hover:scale-105 transition-transform">
                  ⚡
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">Immediate Path</span>
                    <span class="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800">0s wait</span>
                  </div>
                  <div class="text-lg font-mono font-bold text-stone-100 mt-0.5">
                    400 <span class="text-xs font-normal text-amber-300">Coins</span>
                  </div>
                  <p class="text-[11px] text-stone-400 mt-0.5">Instant delivery into your treasury</p>
                </div>
              </div>

              <!-- Delayed Option -->
              <div id="btn-tutorial-choice-del" 
                   role="button" 
                   class="cursor-pointer p-4 rounded-xl border-2 border-indigo-500/40 bg-stone-900/80 hover:border-indigo-400 hover:bg-stone-900 transition-all flex items-center space-x-4 shadow-md group">
                <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xl shrink-0 group-hover:scale-105 transition-transform">
                  🏃
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">Delayed Path</span>
                    <span class="text-[10px] font-mono text-amber-400 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800">7s run</span>
                  </div>
                  <div class="text-lg font-mono font-bold text-amber-200 mt-0.5">
                    1000 <span class="text-xs font-normal text-amber-300">Coins ★</span>
                  </div>
                  <p class="text-[11px] text-stone-400 mt-0.5">Traverse real-time current to grand hoard</p>
                </div>
              </div>
            </div>

            <!-- Live Traversal Simulation Track -->
            <div class="bg-[#0a0c14] border border-stone-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-inner">
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="text-stone-400">Track Preview:</span>
                <span id="tutorial-status-text" class="text-amber-300 font-semibold">Tap a pathway above to test traversal</span>
              </div>

              <!-- Track Field Viewport -->
              <div class="relative w-full h-16 sm:h-20 bg-stone-950/80 rounded-xl border border-stone-800 overflow-hidden flex items-center px-4">
                <!-- Track Line -->
                <div class="absolute left-6 right-6 h-1 bg-stone-800 rounded-full"></div>
                <!-- Progress Fill -->
                <div id="tutorial-progress-bar" class="absolute left-6 h-1 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-100" style="width: 0%;"></div>
                
                <!-- Runner Avatar -->
                <div id="tutorial-runner" class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 transition-all text-xl shadow-lg" style="transform: translate(0px, -50%);">
                  🏃
                </div>

                <!-- Vault Finish Goal -->
                <div class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-300 text-xl shadow-lg">
                  🪙
                </div>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-tutorial-back-instructions" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Instructions
            </button>

            <button id="btn-tutorial-start-main" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:bg-amber-600 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Begin Chrono-Expedition</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    const statusText = document.getElementById('tutorial-status-text');
    const runnerEl = document.getElementById('tutorial-runner');
    const progressBar = document.getElementById('tutorial-progress-bar');
    const immBtn = document.getElementById('btn-tutorial-choice-imm');
    const delBtn = document.getElementById('btn-tutorial-choice-del');

    const resetSimulation = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      if (runnerEl) runnerEl.style.left = '16px';
      if (progressBar) progressBar.style.width = '0%';
    };

    immBtn?.addEventListener('click', () => {
      resetSimulation();
      playPathSelectClick();
      playCoinCollectPulse();
      if (statusText) statusText.innerHTML = '<span class="text-emerald-400 font-bold">Immediate Path: +400 Coins collected instantly (0s wait)!</span>';
      if (runnerEl) runnerEl.style.left = 'calc(100% - 64px)';
      if (progressBar) progressBar.style.width = 'calc(100% - 48px)';
    });

    delBtn?.addEventListener('click', () => {
      resetSimulation();
      playPathSelectClick();
      let elapsed = 0;
      const totalS = 7;
      if (statusText) statusText.innerHTML = `<span class="text-cyan-300 font-bold">Runner dispatched: 7.0s remaining...</span>`;
      
      progressTimer = window.setInterval(() => {
        elapsed += 0.1;
        const remaining = Math.max(0, totalS - elapsed).toFixed(1);
        const pct = Math.min(100, (elapsed / totalS) * 100);
        
        if (progressBar) progressBar.style.width = `calc(${pct}% - 48px)`;
        if (runnerEl) runnerEl.style.left = `calc(${pct}% * 0.85 + 16px)`;
        if (statusText) statusText.innerHTML = `<span class="text-cyan-300 font-bold">Runner traversing: ${remaining}s remaining...</span>`;

        if (elapsed >= totalS) {
          if (progressTimer) clearInterval(progressTimer);
          playVaultArrivalChime();
          playCoinCollectPulse();
          if (statusText) statusText.innerHTML = '<span class="text-amber-300 font-bold">Vault reached! +1000 Coins secured into your treasury ★</span>';
          if (runnerEl) runnerEl.style.left = 'calc(100% - 64px)';
          if (progressBar) progressBar.style.width = 'calc(100% - 48px)';
        }
      }, 100);
    });

    document.getElementById('btn-tutorial-exit-dash')?.addEventListener('click', () => {
      resetSimulation();
      playTactileClick();
      this.abort();
    });

    document.getElementById('btn-tutorial-back-instructions')?.addEventListener('click', () => {
      resetSimulation();
      playTactileClick();
      this.renderOnboarding();
    });

    document.getElementById('btn-tutorial-start-main')?.addEventListener('click', () => {
      resetSimulation();
      playTactileClick();
      this.startExpeditionSession();
    });
  }

  /* =========================================================================
     SESSION START & 5-LANE ARENA SHELL ARCHITECTURE
     ========================================================================= */

  private startExpeditionSession(): void {
    this.currentTrialIndex = 0;
    this.totalAccumulatedCoins = 0;
    this.trialLogs = [];
    this.renderArenaShell();
    this.checkOrientationState();
    this.runTrial(0);
  }

  /**
   * Constructs the 5-lane visual architecture:
   * Arranged vertically from bottom (Lane 1 = 0s) to top (Lane 5 = 60s):
   * Lane 1: 0 s (Immediate Path)
   * Lane 2: 7 s (Fast Current)
   * Lane 3: 15 s (Steady Current)
   * Lane 4: 30 s (Deep Current)
   * Lane 5: 60 s (Abyssal Current)
   */
  private renderArenaShell(): void {
    const avatar = this.chosenAvatar;

    this.container.innerHTML = `
      <div id="vault-arena-root" class="fixed inset-0 z-50 bg-[#050609] flex flex-col justify-between select-none overflow-hidden touch-none text-stone-100">
        
        <!-- TOP HUD -->
        <header class="w-full bg-[#090b12]/90 border-b border-stone-800/80 px-4 py-2.5 flex items-center justify-between text-xs font-mono z-20">
          <div class="flex items-center space-x-3">
            <!-- Avatar Badge -->
            <div class="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-[#0f121d] border border-stone-800">
              <span class="${avatar.auraColor}">${avatar.svgIcon}</span>
              <span class="font-arcane font-semibold text-stone-200 text-xs hidden sm:inline">${avatar.name}</span>
            </div>
            <!-- Trial Counter -->
            <div class="px-2.5 py-1 rounded-lg bg-[#0f121d] border border-stone-800 text-stone-400">
              <span id="hud-trial-label">Trial 1 / 36</span>
            </div>
          </div>

          <!-- Center: Title -->
          <div class="hidden md:flex items-center space-x-1.5 text-stone-400">
            <span class="text-amber-400 font-bold">THE VAULT OF ARTIFACTS</span>
            <span>//</span>
            <span class="text-[10px] text-stone-500 uppercase tracking-wider">Intertemporal Valuation</span>
          </div>

          <!-- Right: Accumulated Score & Exit Button -->
          <div class="flex items-center space-x-3">
            <div class="flex items-center space-x-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <span class="text-sm">🪙</span>
              <span id="hud-score-counter" class="font-bold font-mono text-sm sm:text-base font-mono-num text-amber-300">0</span>
              <span class="text-[10px] text-amber-400/80 uppercase">Coins</span>
            </div>
            <button id="btn-vault-abort" class="px-2 py-1 text-stone-600 hover:text-stone-300 text-[10px] transition-colors cursor-pointer">
              ESC / EXIT
            </button>
          </div>
        </header>

        <!-- 5-LANE TRACK FIELD -->
        <main id="vault-tracks-field" class="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-2 flex flex-col justify-around gap-1.5 sm:gap-2 relative">
          
          <!-- Lane 5: 60 s (Abyssal Current) -->
          <div id="lane-row-60" data-delay="60" class="lane-track-row relative w-full h-[18%] rounded-xl transition-all duration-300 flex items-center"></div>

          <!-- Lane 4: 30 s (Deep Current) -->
          <div id="lane-row-30" data-delay="30" class="lane-track-row relative w-full h-[18%] rounded-xl transition-all duration-300 flex items-center"></div>

          <!-- Lane 3: 15 s (Steady Current) -->
          <div id="lane-row-15" data-delay="15" class="lane-track-row relative w-full h-[18%] rounded-xl transition-all duration-300 flex items-center"></div>

          <!-- Lane 2: 7 s (Fast Current) -->
          <div id="lane-row-7" data-delay="7" class="lane-track-row relative w-full h-[18%] rounded-xl transition-all duration-300 flex items-center"></div>

          <!-- Lane 1: 0 s (Immediate Path) -->
          <div id="lane-row-0" data-delay="0" class="lane-track-row relative w-full h-[18%] rounded-xl transition-all duration-300 flex items-center"></div>

        </main>

        <!-- HUD BOTTOM STATUS STRIP -->
        <div id="vault-hud-bottom" class="w-full bg-[#08090e] border-t border-stone-900 px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-stone-500">
          <span>ORIGIN GATE (LEFT)</span>
          <span id="vault-footer-status" class="text-stone-400">Select an illuminated pathway card to dispatch your runner</span>
          <span>CHRONO-VAULT (RIGHT)</span>
        </div>

        <!-- STRICT LANDSCAPE ENFORCEMENT OVERLAY -->
        <div id="vault-landscape-overlay" class="hidden fixed inset-0 z-50 bg-[#06070a] p-6 flex-col items-center justify-center text-center space-y-4">
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
            The Vault of Artifacts requires landscape orientation. Please rotate your phone horizontally to observe all 5 temporal currents.
          </p>
        </div>

      </div>
    `;

    const handleAbort = (e: Event) => {
      e.preventDefault();
      this.terminateToResults();
    };

    document.getElementById('btn-vault-abort')?.addEventListener('pointerdown', handleAbort);
    document.getElementById('btn-vault-abort')?.addEventListener('click', handleAbort);
  }

  /* =========================================================================
     TRIAL CONTROLLER: LANE ILLUMINATION & REAL-TIME TRAVERSAL
     ========================================================================= */

  private runTrial(index: number): void {
    if (!this.isRunning) return;

    if (index >= this.trials.length) {
      this.renderCompletionScreen();
      return;
    }

    this.activePhase = 'trial_choice';
    this.currentTrialIndex = index;
    const trial = this.trials[index];

    // Update HUD trial index
    const trialLabel = document.getElementById('hud-trial-label');
    if (trialLabel) {
      trialLabel.textContent = `Trial ${index + 1} / ${this.trials.length}`;
    }

    const statusEl = document.getElementById('vault-footer-status');
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-amber-300">Choose between immediate reward or delayed vault</span>`;
    }

    // Lane metadata
    const laneSpecs: { delay: number; title: string; currentType: string }[] = [
      { delay: 60, title: 'Abyssal Current', currentType: '60s' },
      { delay: 30, title: 'Deep Current', currentType: '30s' },
      { delay: 15, title: 'Steady Current', currentType: '15s' },
      { delay: 7,  title: 'Fast Current', currentType: '7s' },
      { delay: 0,  title: 'Immediate Path', currentType: '0s' }
    ];

    laneSpecs.forEach(spec => {
      const row = document.getElementById(`lane-row-${spec.delay}`);
      if (!row) return;

      const isImmediate = spec.delay === 0;
      const isDelayed = spec.delay === trial.delayedDurationS;
      const isActive = isImmediate || isDelayed;

      if (!isActive) {
        // Dimmed & locked lane
        row.className = 'lane-track-row relative w-full h-[18%] rounded-xl flex items-center opacity-25 border border-stone-900 bg-[#07090f]/50 pointer-events-none select-none';
        row.innerHTML = `
          <!-- Lane Badge -->
          <div class="w-24 sm:w-32 px-2 flex items-center space-x-1.5 text-[10px] font-mono text-stone-600">
            <span class="w-1.5 h-1.5 rounded-full bg-stone-700"></span>
            <span>${spec.currentType} ${spec.title}</span>
          </div>

          <!-- Track Conduit -->
          <div class="flex-1 h-1.5 bg-stone-900 rounded-full mx-2 relative overflow-hidden border border-stone-900"></div>

          <!-- Inactive Lock Badge -->
          <div class="w-36 sm:w-48 px-2 flex items-center justify-end text-[10px] font-mono text-stone-700">
            <span>🔒 Locked</span>
          </div>
        `;
      } else {
        // Active Illuminated Lane
        const rewardCoins = isImmediate ? trial.immediateRewardCoins : trial.delayedRewardCoins;
        const waitTimeLabel = isImmediate ? '0s Instant' : `${spec.delay}s Wait`;
        const choiceType: DelayChoice = isImmediate ? 'immediate' : 'delayed';

        const themeBorder = isImmediate ? 'border-cyan-500/40 hover:border-cyan-400' : 'border-amber-500/50 hover:border-amber-400';
        const themeBg = isImmediate ? 'bg-cyan-950/20' : 'bg-amber-950/25';
        const themeGlow = isImmediate ? 'shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'shadow-[0_0_20px_rgba(245,158,11,0.2)]';
        const themeBtn = isImmediate
          ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-500/20 border-cyan-400/60 text-cyan-200'
          : 'bg-gradient-to-r from-amber-600/40 to-amber-500/25 border-amber-400/70 text-amber-100';

        row.className = `lane-track-row relative w-full h-[18%] rounded-xl flex items-center border ${themeBorder} ${themeBg} ${themeGlow} transition-all duration-300 pointer-events-auto`;
        row.innerHTML = `
          <!-- Lane Badge & Origin Portal -->
          <div class="w-28 sm:w-36 px-2.5 flex items-center space-x-2 text-[10px] sm:text-xs font-mono">
            <div class="w-3 h-3 rounded-full ${isImmediate ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'} animate-pulse"></div>
            <div>
              <span class="font-bold block ${isImmediate ? 'text-cyan-300' : 'text-amber-300'}">${spec.currentType}</span>
              <span class="text-[9px] text-stone-400 block">${spec.title}</span>
            </div>
          </div>

          <!-- Track Runway (Runner Path) -->
          <div id="lane-runway-${spec.delay}" class="flex-1 h-3 sm:h-4 bg-[#0a0d16] rounded-full mx-2 relative overflow-visible border border-stone-800 shadow-inner">
            
            <!-- Runway Conduit Glow Line -->
            <div class="absolute inset-0 rounded-full opacity-40 ${isImmediate ? 'bg-cyan-500/20' : 'bg-amber-500/20'}"></div>
            
            <!-- Runner Avatar Element (Initially at origin) -->
            <div id="runner-sprite-${spec.delay}" class="hidden absolute top-1/2 -translate-y-1/2 -left-2 z-10 transition-transform flex items-center space-x-1 pointer-events-none">
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#090b12] border-2 ${this.chosenAvatar.borderColor} flex items-center justify-center ${this.chosenAvatar.auraColor} shadow-[0_0_12px_rgba(255,255,255,0.4)]">
                ${this.chosenAvatar.svgIcon}
              </div>
              <div id="runner-time-bubble-${spec.delay}" class="hidden px-1.5 py-0.5 rounded bg-black/90 border border-amber-500/50 text-[9px] font-mono text-amber-300 shadow font-bold whitespace-nowrap">
                --
              </div>
            </div>

            <!-- Vault Chest Gate at Destination (Right Edge) -->
            <div id="vault-chest-${spec.delay}" class="absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#0e121e] border ${isImmediate ? 'border-cyan-400/60' : 'border-amber-400/80'} flex items-center justify-center text-sm shadow-md transition-transform">
              ${isImmediate ? '⚡' : '🏛️'}
            </div>
          </div>

          <!-- Interactive Choice Target Card -->
          <div class="w-36 sm:w-52 pr-2.5 flex items-center justify-end">
            <button id="btn-choice-lane-${spec.delay}" 
                    role="button"
                    tabindex="0"
                    data-choice-type="${choiceType}"
                    class="choice-target-card w-full px-3 py-1.5 rounded-xl border-2 ${themeBtn} hover:scale-[1.03] active:scale-95 transition-transform flex items-center justify-between shadow-lg cursor-pointer">
              <div class="text-left">
                <span class="text-xs sm:text-sm font-bold block leading-tight font-mono-num text-amber-200">
                  🪙 ${rewardCoins}
                </span>
                <span class="text-[9px] font-mono text-stone-300 block leading-tight">
                  ${waitTimeLabel}
                </span>
              </div>
              <div class="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-stone-200">
                ${isImmediate ? 'Claim' : 'Traverse'}
              </div>
            </button>
          </div>
        `;

        // Bind pointerdown selection
        const btn = document.getElementById(`btn-choice-lane-${spec.delay}`);
        btn?.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.handleChoiceSelection(choiceType);
        });
      }
    });

    this.isAwaitingChoice = true;
    this.trialOnsetTimestamp = performance.now();
  }

  /* =========================================================================
     CHOICE EXECUTION & REAL-TIME RUNNER TRAVERSAL ANIMATION
     ========================================================================= */

  private handleChoiceSelection(choice: DelayChoice): void {
    if (!this.isAwaitingChoice) return;
    this.isAwaitingChoice = false;
    this.activePhase = 'realtime_traversal';

    const decisionRt = Math.round(performance.now() - this.trialOnsetTimestamp);
    playPathSelectClick();

    const trial = this.trials[this.currentTrialIndex];
    const isImmediate = choice === 'immediate';
    const chosenDurationS = isImmediate ? 0 : trial.delayedDurationS;
    const chosenReward = isImmediate ? trial.immediateRewardCoins : trial.delayedRewardCoins;

    // Disable all choice cards immediately
    const choiceCards = this.container.querySelectorAll('.choice-target-card');
    choiceCards.forEach(c => {
      (c as HTMLElement).style.pointerEvents = 'none';
      c.classList.add('opacity-50');
    });

    // Highlight selected card
    const selectedBtn = document.getElementById(`btn-choice-lane-${chosenDurationS}`);
    if (selectedBtn) {
      selectedBtn.classList.remove('opacity-50');
      selectedBtn.classList.add('ring-2', 'ring-white', 'scale-105');
    }

    // Prepare runner traversal
    const runnerEl = document.getElementById(`runner-sprite-${chosenDurationS}`);
    const runwayEl = document.getElementById(`lane-runway-${chosenDurationS}`);
    const timeBubble = document.getElementById(`runner-time-bubble-${chosenDurationS}`);
    const vaultChest = document.getElementById(`vault-chest-${chosenDurationS}`);

    const statusEl = document.getElementById('vault-footer-status');
    if (statusEl) {
      statusEl.innerHTML = chosenDurationS === 0
        ? `<span class="text-cyan-400 font-bold">Immediate reward unlocked! Depositing coins...</span>`
        : `<span class="text-amber-400 font-bold">Runner traversing ${chosenDurationS}s temporal current. Stand by for vault arrival...</span>`;
    }

    // Execute real-time traversal
    if (chosenDurationS === 0) {
      // Instant path (0s delay): brief 100ms flash and immediate claim
      if (runnerEl) runnerEl.classList.remove('hidden');
      if (vaultChest) {
        vaultChest.classList.add('scale-125', 'bg-cyan-500/40');
      }

      const finishTimer = window.setTimeout(() => {
        this.completeTrial(choice, chosenDurationS, chosenReward, decisionRt);
      }, 150);
      this.activeTimeouts.push(finishTimer);

    } else {
      // Delayed path (7s, 15s, 30s, or 60s):
      if (!runnerEl || !runwayEl) {
        this.completeTrial(choice, chosenDurationS, chosenReward, decisionRt);
        return;
      }

      runnerEl.classList.remove('hidden');
      if (timeBubble) timeBubble.classList.remove('hidden');

      const totalTravelPx = runwayEl.clientWidth - 20;
      const startTime = performance.now();
      const durationMs = chosenDurationS * 1000;

      // Hardware-accelerated CSS transition matching dynamic duration
      runnerEl.style.transition = `transform ${chosenDurationS}s linear`;
      runnerEl.style.transform = `translate3d(${totalTravelPx}px, -50%, 0)`;

      // Continuous RAF loop for precision countdown timer in runner bubble
      const updateCountdown = () => {
        if (!this.isRunning || this.activePhase !== 'realtime_traversal') return;
        const elapsed = performance.now() - startTime;
        const remaining = Math.max(0, (durationMs - elapsed) / 1000);

        if (timeBubble) {
          timeBubble.textContent = `${remaining.toFixed(1)}s`;
        }

        if (elapsed < durationMs) {
          this.animationFrameId = requestAnimationFrame(updateCountdown);
        } else {
          // Reached the vault
          if (timeBubble) timeBubble.textContent = `ARRIVED!`;
          if (vaultChest) {
            vaultChest.classList.add('scale-125', 'bg-amber-400/40', 'border-amber-300');
          }
        }
      };
      this.animationFrameId = requestAnimationFrame(updateCountdown);

      // Traversal completion timeout matching chosen duration exactly
      const arrivalTimer = window.setTimeout(() => {
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        this.completeTrial(choice, chosenDurationS, chosenReward, decisionRt);
      }, durationMs);
      this.activeTimeouts.push(arrivalTimer);
    }
  }

  /**
   * Completes the trial arrival, updates accumulated coins with audio chime,
   * records telemetry, and triggers ITI before next trial.
   */
  private completeTrial(choice: DelayChoice, chosenDurationS: number, chosenReward: number, decisionRt: number): void {
    if (!this.isRunning) return;

    // Uplifting pentatonic coin claim audio
    playVaultArrivalChime();

    // Log trial telemetry
    const trial = this.trials[this.currentTrialIndex];
    this.totalAccumulatedCoins += chosenReward;

    const log: VaultArtifactsTrialLog = {
      trial_number: this.currentTrialIndex + 1,
      participant_id: this.profile.id,
      room_id: 'room_5_delay_discounting',
      character_chosen: this.chosenAvatar.id,
      delayed_lane_duration_s: trial.delayedDurationS,
      immediate_reward_coins: trial.immediateRewardCoins,
      delayed_reward_coins: trial.delayedRewardCoins,
      choice_made: choice,
      chosen_delay_s: chosenDurationS,
      chosen_reward_coins: chosenReward,
      decision_rt_ms: decisionRt,
      total_accumulated_score: this.totalAccumulatedCoins,
      timestamp: new Date().toISOString()
    };

    this.trialLogs.push(log);
    recordVaultTrialLog(log);

    // Normalized Production Schema Buffering (trials_dd)
    const ddPayload: DDTrialPayload = {
      auth_user_id: this.profile.auth_user_id || this.profile.id,
      subject_id: this.profile.subject_id,
      task: 'DD',
      session: this.sessionId,
      trial_number: log.trial_number,
      delay_option: Number(log.delayed_lane_duration_s),
      immediate_reward_option: Number(log.immediate_reward_coins),
      reaction_time: Number(Math.round(decisionRt)),
      response_chosen: log.choice_made as 'immediate' | 'delayed',
      recorded_at: log.timestamp
    };
    bufferNormalizedTrialLocally('trials_dd', ddPayload, this.sessionId);

    // Animated score increment
    this.animateScoreCounter(this.totalAccumulatedCoins - chosenReward, this.totalAccumulatedCoins);

    // Show celebratory arrival toast
    const statusEl = document.getElementById('vault-footer-status');
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-400 font-bold font-mono">✓ Vault Gathered! +${chosenReward} coins added to total.</span>`;
    }

    // 1000 ms Inter-Trial Interval (ITI)
    const itiTimer = window.setTimeout(() => {
      this.runTrial(this.currentTrialIndex + 1);
    }, 1000);
    this.activeTimeouts.push(itiTimer);
  }

  private animateScoreCounter(from: number, to: number): void {
    const el = document.getElementById('hud-score-counter');
    if (!el) return;

    const diff = to - from;
    const steps = 15;
    const stepValue = diff / steps;
    let currentStep = 0;

    const interval = window.setInterval(() => {
      currentStep++;
      const val = Math.round(from + stepValue * currentStep);
      el.textContent = val.toLocaleString();
      if (currentStep % 3 === 0) playCoinCollectPulse(0.1);

      if (currentStep >= steps) {
        clearInterval(interval);
        el.textContent = to.toLocaleString();
      }
    }, 20);
  }

  /* =========================================================================
     COMPLETION SCREEN, ANALYTICS & DELAY DISCOUNTING CURVE BREAKDOWN
     ========================================================================= */

  private renderCompletionScreen(): void {
    this.activePhase = 'completed';
    playCompletionFanfare();

    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }


    const trials = this.trialLogs;
    const total = trials.length;
    const patientChoices = trials.filter(t => t.choice_made === 'delayed');
    const patientPct = total > 0 ? Math.round((patientChoices.length / total) * 100) : null;

    // Mean decision RT
    const rts = trials.map(t => t.decision_rt_ms).filter(rt => typeof rt === 'number' && !isNaN(rt) && rt > 0);
    const meanRt = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;

    // Breakdown by delay (7, 15, 30, 60)
    const delayLevels = [7, 15, 30, 60];
    const byDelay: Record<number, { trials: number; patientCount: number; patientPct: number | null }> = {};
    delayLevels.forEach(d => {
      const subset = trials.filter(t => t.delayed_lane_duration_s === d);
      const patientCount = subset.filter(t => t.choice_made === 'delayed').length;
      byDelay[d] = {
        trials: subset.length,
        patientCount,
        patientPct: subset.length > 0 ? Math.round((patientCount / subset.length) * 100) : null
      };
    });

    // Breakdown by immediate reward (100, 400, 700)
    const immediateLevels = [100, 400, 700];
    const byImmediateReward: Record<number, { trials: number; patientCount: number; patientPct: number | null }> = {};
    immediateLevels.forEach(imm => {
      const subset = trials.filter(t => t.immediate_reward_coins === imm);
      const patientCount = subset.filter(t => t.choice_made === 'delayed').length;
      byImmediateReward[imm] = {
        trials: subset.length,
        patientCount,
        patientPct: subset.length > 0 ? Math.round((patientCount / subset.length) * 100) : null
      };
    });

    // Record session mastery to profile
    recordSessionCompletion('room-5', patientPct ?? 50);

    // Flush all buffered trials from this chamber session in batch to Supabase (even 1 trial)
    flushChamberSession(this.sessionId, 'room-5').catch(() => {});

    const sessionResult: VaultArtifactsSessionResult = {
      roomId: 'room-5',
      roomName: 'The Vault of Artifacts',
      totalTrials: total,
      totalCoins: this.totalAccumulatedCoins,
      percentPatientChoices: patientPct ?? 0,
      meanDecisionRtMs: meanRt ?? 0,
      characterChosen: this.chosenAvatar.id,
      byDelay: {
        7: { trials: byDelay[7].trials, patientCount: byDelay[7].patientCount, patientPct: byDelay[7].patientPct ?? 0 },
        15: { trials: byDelay[15].trials, patientCount: byDelay[15].patientCount, patientPct: byDelay[15].patientPct ?? 0 },
        30: { trials: byDelay[30].trials, patientCount: byDelay[30].patientCount, patientPct: byDelay[30].patientPct ?? 0 },
        60: { trials: byDelay[60].trials, patientCount: byDelay[60].patientCount, patientPct: byDelay[60].patientPct ?? 0 }
      },
      byImmediateReward: {
        100: { trials: byImmediateReward[100].trials, patientCount: byImmediateReward[100].patientCount, patientPct: byImmediateReward[100].patientPct ?? 0 },
        400: { trials: byImmediateReward[400].trials, patientCount: byImmediateReward[400].patientCount, patientPct: byImmediateReward[400].patientPct ?? 0 },
        700: { trials: byImmediateReward[700].trials, patientCount: byImmediateReward[700].patientCount, patientPct: byImmediateReward[700].patientPct ?? 0 }
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
              Room 4: The Vault of Artifacts
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-white font-semibold">
              Delay Discounting
            </h1>
            <p class="text-xs sm:text-sm text-emerald-400 font-sans mt-1">
              Vault sealed. Your temporal patience has recalibrated your chronometric core. Return tomorrow for the next cycle.
            </p>
          </div>

          <!-- Summary Metric Cards (2 boxes: Total Vault Wealth & Mean Choice Speed) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <!-- Total Coins -->
            <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Total Vault Wealth</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-amber-300 font-mono-num">${this.totalAccumulatedCoins.toLocaleString()}</span>
                <span class="text-xs font-mono text-amber-400 ml-1">Coins</span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Across ${total} Paths Taken</span>
            </div>

            <!-- Decision RT -->
            <div class="bg-[#0f121d] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Mean Choice Speed</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-emerald-300 font-mono-num">
                  ${meanRt !== null ? `${meanRt}<span class="text-xs font-mono text-stone-400 ml-1">ms</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Deliberation Latency</span>
            </div>

          </div>

          <!-- Experiential Delay Discounting Curve Bar Chart -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-5 space-y-4">
            <div class="flex justify-between items-center border-b border-stone-800/80 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Experiential Delay Discounting Curve (% Patient Choices by Delay Horizon)
              </span>
              <span class="text-[11px] font-mono text-stone-500">Subjective Value Decay</span>
            </div>

            <!-- Delay Horizon Bars -->
            ${total === 0 ? `
              <div class="h-20 flex items-center justify-center text-xs font-mono text-stone-400">
                Not enough trials to display discounting curve
              </div>
            ` : `
              <div class="space-y-3 pt-2">
                ${delayLevels.map(d => {
                  const info = byDelay[d] || { trials: 0, patientCount: 0, patientPct: null };
                  return `
                    <div class="space-y-1">
                      <div class="flex justify-between items-center text-xs font-mono">
                        <span class="text-stone-300 font-bold">${d}s Delay Horizon</span>
                        <span class="text-amber-300 font-bold">
                          ${info.patientPct !== null ? `${info.patientPct}% (${info.patientCount}/${info.trials})` : '<span class="text-stone-500 font-normal">Not enough trials</span>'}
                        </span>
                      </div>
                      <div class="w-full h-3 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                        <div class="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500" style="width: ${info.patientPct ?? 0}%"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Ethereal Chamber Seals Inscribed Status -->
          <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 text-xs font-mono text-stone-300 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span><strong class="text-emerald-400">Session recorded</strong> · Session <code class="text-amber-300">${this.sessionId}</code> synchronized.</span>
            </div>
            <div class="text-stone-500 text-[11px]">
              ${total} Trials Inscribed
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="max-w-4xl mx-auto w-full pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs bg-emerald-950/20 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Task data saved</span>
          </div>

          <div class="w-full sm:w-auto flex items-center space-x-3">
            <button id="btn-vault-replay" class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              Replay
            </button>
            <button id="btn-vault-return-dashboard" class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
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

    document.getElementById('btn-vault-replay')?.addEventListener('click', () => {
      playTactileClick();
      this.start();
    });

    document.getElementById('btn-vault-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.callbacks.onComplete(sessionResult);
    });
  }
}

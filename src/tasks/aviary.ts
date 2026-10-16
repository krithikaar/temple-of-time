/**
 * TEMPLE of Time - Room 3: The Aviary
 * Paradigm: Motor Timing & Temporal Production Battery (The Familiar's Feeding Ritual)
 * Phase 1: Spontaneous Motor Tempo (SMT / Free Cadence)
 * Phase 2: 3-Second Temporal Production (Calibration Biofeedback -> 100 Silent Taps)
 */

import { ParticipantProfile, AviaryFamiliar, AviaryTapLog, AviarySessionResult, PsychophysicsTrial, SMTTrialPayload, TPTrialPayload } from '../types';
import { playGrainSeedSound, playFamiliarCall, playTactileClick, playCompletionFanfare, playRuneHum } from '../audio';
import { recordAviaryTapLog, recordSessionCompletion, startTaskSession, bufferTrialLocally, bufferNormalizedTrialLocally, flushChamberSession } from '../store';

export interface AviaryCallbacks {
  onComplete: (session: AviarySessionResult) => void;
  onExit: () => void;
}

export class AviaryTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: AviaryCallbacks;
  private sessionId = '';

  // Selected companion
  private chosenFamiliar: AviaryFamiliar = 'celestial_owl';

  // Task execution state
  private isRunning = false;
  private activePhase: 'onboarding' | 'smt_tapping' | 'smt_summary' | 'prod_briefing' | 'prod_practice' | 'prod_testing' | 'completed' = 'onboarding';

  // Phase 1: SMT state
  private smtTapCount = 0;
  private readonly smtTargetTaps = 100;
  private smtLastTapTime = 0;
  private smtLogs: AviaryTapLog[] = [];

  // Phase 2: 3-Second Production state
  private prodPracticeTapCount = 0;
  private readonly prodPracticeTargetIntervals = 10;
  private prodTestTapCount = 0;
  private readonly prodTestTargetIntervals = 100;
  private prodLastTapTime = 0;
  private prodPracticeLogs: AviaryTapLog[] = [];
  private prodTestLogs: AviaryTapLog[] = [];

  private activeTimeouts: number[] = [];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: AviaryCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
  }

  public start(): void {
    this.sessionId = startTaskSession('SMT');
    this.isRunning = true;
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.activePhase === 'smt_tapping' || this.activePhase === 'prod_practice' || this.activePhase === 'prod_testing') {
          e.preventDefault();
          this.terminateToResults();
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
    this.renderOnboarding();
  }

  public terminateToResults(): void {
    this.isRunning = false;
    this.clearAllTimers();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.renderFinalCompletionScreen();
  }

  public abort(): void {
    const allSessionLogs = [...this.smtLogs, ...this.prodPracticeLogs, ...this.prodTestLogs];
    if (this.isRunning || allSessionLogs.length > 0) {
      this.terminateToResults();
    } else {
      this.isRunning = false;
      this.clearAllTimers();
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      this.callbacks.onExit();
    }
  }

  private clearAllTimers(): void {
    this.activeTimeouts.forEach(t => clearTimeout(t));
    this.activeTimeouts = [];
  }

  /* =========================================================================
     PHASE 1: ONBOARDING & FAMILIAR SELECTION
     ========================================================================= */

  private renderOnboarding(): void {
    this.activePhase = 'onboarding';

    this.container.innerHTML = `
      <div class="relative w-full min-h-screen bg-[#08090e] text-stone-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/aviary_bg.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/aviary_bg.png'; } else { this.src = '/aviary_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-[#08090e]/85 backdrop-blur-[2px]"></div>
        </div>

        <!-- Subtle Ambient Glow -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
          <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div class="absolute bottom-0 right-10 w-[450px] h-[250px] bg-emerald-500/5 rounded-full blur-[120px]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
                  <line x1="16" y1="8" x2="2" y2="22"/>
                  <line x1="17.5" y1="15" x2="9" y2="15"/>
                </svg>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-amber-400 font-semibold">Room 3</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Feed your pet</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The Aviary
                </h1>
              </div>
            </div>

            <button id="btn-aviary-intro-exit" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
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
                  src="/assets/aviary_bg.png" 
                  alt="The Aviary - Feed your pet"
                  class="w-full h-full object-cover object-center sm:object-[center_35%] filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/aviary_bg.png'; } else { this.src = '/aviary_bg.svg'; }"
                />
                <!-- Gradient Scrim for Visual Depth & Text Legibility -->
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0b0e19] via-[#0b0e19]/35 to-transparent"></div>
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0b0e19]/50 via-transparent to-[#0b0e19]/30"></div>
                <!-- Subtle Arcane Inner Glow -->
                <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-amber-500/20 rounded-t-2xl"></div>
              </div>

              <!-- Welcome Card (Right below the image) -->
              <div class="p-5 sm:p-6 bg-[#0f121d]/95 backdrop-blur-md border-t border-amber-500/30 space-y-2.5">
                <div class="flex items-start space-x-3.5">
                  <div class="mt-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] shrink-0"></div>
                  <div class="space-y-2">
                    <h2 class="text-lg sm:text-2xl font-arcane text-amber-200 font-bold tracking-wide">
                      Welcome to the Aviary!
                    </h2>
                    <p class="text-sm sm:text-base text-stone-100 font-medium leading-relaxed">
                      You need to harvest grain to feed your pet bird. Tap the screen at your own pace to harvest grain. Keep tapping continuously in a stable rhythm, at your comfortable speed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Interactive Seed Test Card -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-lg">
              <div class="flex justify-between items-center text-xs">
                <span class="font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center space-x-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Interactive Seed Test</span>
                </span>
                <span class="text-[11px] font-mono text-stone-400">Tap below to test touch & rhythm</span>
              </div>

              <div id="demo-seed-area" 
                   class="h-24 bg-[#0a0c14] border border-stone-800/80 hover:border-amber-500/40 transition-colors rounded-xl flex items-center justify-center relative overflow-hidden cursor-pointer touch-none select-none">
                <span class="text-xs font-mono text-stone-400 pointer-events-none flex items-center space-x-2">
                  <span class="text-base">🌾</span>
                  <span>Tap anywhere inside this box to scatter a test seed</span>
                </span>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-aviary-return-dashboard" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Return to Dashboard
            </button>

            <button id="btn-begin-smt" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:bg-amber-600 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Begin Free Feeding</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    // Interactive seed demo preview
    const demoBox = document.getElementById('demo-seed-area');
    demoBox?.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      playGrainSeedSound(0.35);
      const rect = demoBox.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.spawnSeedParticle(demoBox, x, y);
    });

    const exitToDashboard = () => {
      playTactileClick();
      this.abort();
    };

    document.getElementById('btn-aviary-intro-exit')?.addEventListener('click', exitToDashboard);
    document.getElementById('btn-aviary-return-dashboard')?.addEventListener('click', exitToDashboard);

    document.getElementById('btn-begin-smt')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playTactileClick();
      this.startPhase1SMT();
    });
  }

  /* =========================================================================
     PHASE 1: SPONTANEOUS MOTOR TEMPO (FREE CADENCE TAPPING)
     ========================================================================= */

  private startPhase1SMT(): void {
    this.activePhase = 'smt_tapping';
    this.smtTapCount = 0;
    this.smtLastTapTime = 0;
    this.smtLogs = [];

    this.renderArenaShell();
    this.bindSMTTapping();
  }

  /**
   * Renders the absolute pitch-black (#000000) trial viewport
   * No numbers, navigation chrome, or distractions
   */
  private renderArenaShell(): void {
    this.container.innerHTML = `
      <div id="aviary-arena" class="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-between select-none overflow-hidden touch-none p-4">
        
        <!-- Subtle top abort in extreme corner -->
        <div class="w-full flex justify-between items-center text-[10px] font-mono text-stone-900 pointer-events-auto">
          <span>THE AVIARY</span>
          <button id="aviary-abort-btn" class="px-2 py-1 text-stone-700 hover:text-stone-300 transition-colors cursor-pointer">ESC / EXIT</button>
        </div>

        <!-- Center Stage for transient messages / particles -->
        <div id="aviary-stage" class="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto relative pointer-events-none">
          <div id="aviary-biofeedback-container" class="transition-opacity duration-300"></div>
        </div>

        <!-- Minimal subtext branding without counts -->
        <div class="w-full flex justify-center items-center pb-2 text-[10px] font-mono text-stone-950">
          <span>FEEDING RITUAL // MOTOR TIMING</span>
        </div>

      </div>
    `;

    const handleAbort = (e: Event) => {
      e.preventDefault();
      this.terminateToResults();
    };

    document.getElementById('aviary-abort-btn')?.addEventListener('pointerdown', handleAbort);
    document.getElementById('aviary-abort-btn')?.addEventListener('click', handleAbort);
  }

  /**
   * Binds pointerdown everywhere on arena for SMT free tapping
   */
  private bindSMTTapping(): void {
    const arena = document.getElementById('aviary-arena');
    if (!arena) return;

    const handleTap = (e: PointerEvent) => {
      if (this.activePhase !== 'smt_tapping') return;

      // Do not intercept the tiny abort button in corner
      if ((e.target as HTMLElement)?.id === 'aviary-abort-btn') return;

      e.preventDefault();
      const now = performance.now();
      playGrainSeedSound(0.4);

      // Spawn golden grain particle at tap coordinates
      this.spawnSeedParticle(arena, e.clientX, e.clientY);

      this.smtTapCount++;
      const iti = this.smtLastTapTime > 0 ? (now - this.smtLastTapTime) : null;
      this.smtLastTapTime = now;

      // Log SMT tap
      const tapLog: AviaryTapLog = {
        trial_index: this.smtTapCount,
        user_id: this.profile.id,
        chamber: 'Room_3_The_Aviary',
        sub_task: 'SMT',
        block_type: 'free',
        tap_index: this.smtTapCount,
        timestamp_perf_now: now,
        inter_tap_interval_ms: iti,
        target_interval_ms: null,
        chosen_familiar: this.chosenFamiliar,
        date_iso: new Date().toISOString()
      };

      this.smtLogs.push(tapLog);

      // Local store log
      recordAviaryTapLog(tapLog);

      // Normalized Production Schema Buffering (trials_smt)
      const smtPayload: SMTTrialPayload = {
        auth_user_id: this.profile.auth_user_id || this.profile.id,
        subject_id: this.profile.subject_id,
        task: 'SMT',
        session: this.sessionId,
        tap_index: this.smtTapCount,
        rt: Number(Math.round(iti || 0)),
        recorded_at: tapLog.date_iso
      };
      bufferNormalizedTrialLocally('trials_smt', smtPayload, this.sessionId);

      // Check for completion after exactly 100 taps
      if (this.smtTapCount >= this.smtTargetTaps) {
        arena.removeEventListener('pointerdown', handleTap);
        const t = window.setTimeout(() => {
          this.renderSMTSummaryScreen();
        }, 300);
        this.activeTimeouts.push(t);
      }
    };

    arena.addEventListener('pointerdown', handleTap);
  }

  /**
   * Spawns a floating golden grain sprite that dissipates over 220ms
   */
  private spawnSeedParticle(parent: HTMLElement, x: number, y: number): void {
    const seed = document.createElement('div');
    seed.className = 'absolute pointer-events-none z-30 transition-all duration-200 ease-out';
    seed.style.left = `${x - 12}px`;
    seed.style.top = `${y - 12}px`;
    seed.style.opacity = '1';
    seed.style.transform = 'scale(0.85)';

    seed.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
        <path d="M12 2C9 7 5 12 12 22C19 12 15 7 12 2Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
        <line x1="12" y1="5" x2="12" y2="19" stroke="#78350f" stroke-width="1"/>
      </svg>
    `;

    parent.appendChild(seed);

    requestAnimationFrame(() => {
      seed.style.opacity = '0';
      seed.style.transform = 'scale(1.5) translateY(-14px)';
    });

    window.setTimeout(() => {
      seed.remove();
    }, 240);
  }

  /* =========================================================================
     PHASE 1 SUMMARY & TRANSITION TO 3-SECOND RITUAL
     ========================================================================= */

  private renderSMTSummaryScreen(): void {
    this.activePhase = 'smt_summary';
    playRuneHum(240, 500);

    // Compute SMT metrics across 99 ITIs (skipping first tap which has no prior ITI)
    const itis = this.smtLogs.map(l => l.inter_tap_interval_ms).filter((v): v is number => v !== null && v > 50 && v < 5000);
    const meanIti = itis.length > 0 ? Math.round(itis.reduce((a, b) => a + b, 0) / itis.length) : 600;
    
    // Variance & Standard Deviation
    const variance = itis.length > 1 
      ? itis.reduce((acc, val) => acc + Math.pow(val - meanIti, 2), 0) / (itis.length - 1)
      : 0;
    const sd = Math.sqrt(variance);
    const cv = meanIti > 0 ? ((sd / meanIti) * 100).toFixed(1) : '0.0';

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
        <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-lg shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden animate-[fadeIn_0.3s_ease]">
          
          <!-- Header -->
          <div class="text-center space-y-2">
            <div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
              ${this.renderFamiliarGlyph(this.chosenFamiliar)}
            </div>
            <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400">
              Phase 1 Completed
            </div>
            <h2 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold">
              A Harmonious Rhythm
            </h2>
            <p class="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
              Your pet bird has been fed at your natural rhythm. Now move to phase 2 to feed your pet once in 3 seconds.
            </p>
          </div>

          <!-- Forward Button -->
          <div class="pt-2">
            <button id="btn-proceed-phase2" class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center space-x-2 cursor-pointer">
              <span>Proceed to the 3-Second Ritual</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    document.getElementById('btn-proceed-phase2')?.addEventListener('click', () => {
      playTactileClick();
      this.renderPhase2CalibrationBriefing();
    });
  }

  /* =========================================================================
     PHASE 2: 3-SECOND TEMPORAL PRODUCTION BRIEFING & PRACTICE
     ========================================================================= */

  private renderPhase2CalibrationBriefing(): void {
    this.activePhase = 'prod_briefing';

    this.container.innerHTML = `
      <div class="relative w-full min-h-screen bg-[#08090e] text-stone-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
        
        <!-- Subtle Ambient Glow -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
          <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/10 rounded-full blur-[140px]"></div>
          <div class="absolute bottom-0 right-10 w-[450px] h-[250px] bg-cyan-500/5 rounded-full blur-[120px]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span class="text-xl">⏳</span>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-amber-400 font-semibold">Phase 2</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Temporal Production</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The 3-Second Harvest
                </h1>
              </div>
            </div>

            <button id="btn-phase2-exit-dashboard" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Dashboard</span>
            </button>
          </div>

          <!-- Main Instructions Body -->
          <div class="space-y-5">

            <!-- Welcome / Lore Card Right Below Header -->
            <div class="relative rounded-2xl overflow-hidden border border-amber-500/35 shadow-2xl bg-[#0f121d]/95 backdrop-blur-md p-5 sm:p-6 space-y-2.5">
              <div class="flex items-start space-x-3.5">
                <div class="mt-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] shrink-0"></div>
                <div class="space-y-2">
                  <h2 class="text-lg sm:text-2xl font-arcane text-amber-200 font-bold tracking-wide">
                    The 3-Second Harvest
                  </h2>
                  <p class="text-sm sm:text-base text-stone-100 font-medium leading-relaxed">
                    Your pet's appetite is now increased. Maystical grain matures only once every 3 seconds. Tapping too early yields barren husk and tapping too late lets the harvest wither.
                  </p>
                </div>
              </div>
            </div>

            <!-- Practice Period Notice Card (Retained) -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-4 sm:p-5 space-y-2 shadow-lg">
              <div class="flex items-center space-x-2 text-cyan-300 text-xs sm:text-sm font-mono font-semibold">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span>Practice Period Notice</span>
              </div>
              <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                The first 10 taps are a calibration training ground: the chamber will reveal your exact timing after each tap so you can recalibrate your internal clock. Once training concludes, you will complete 100 test taps in total silence.
              </p>
            </div>

            <!-- Calibration Sandbox Widget (Retained) -->
            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-xl p-4 sm:p-5 space-y-3 shadow-lg">
              <div class="flex justify-between items-center text-xs">
                <span class="font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center space-x-2">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>Test Calibration Sandbox</span>
                </span>
                <span id="practice-status-pill" class="text-[10px] font-mono text-stone-400 bg-stone-900 border border-stone-800 px-2.5 py-0.5 rounded">
                  Tap once to start
                </span>
              </div>

              <div id="practice-touch-area" 
                   class="h-24 bg-[#0a0c14] border border-amber-500/20 hover:border-amber-500/40 transition-colors rounded-xl flex flex-col items-center justify-center cursor-pointer touch-none relative select-none">
                <span id="practice-center-readout" class="text-2xl font-mono font-bold text-amber-300 font-mono-num">
                  --.-- s
                </span>
                <span id="practice-subtext" class="text-[11px] font-mono text-stone-500 mt-1">
                  Tap here to begin timing
                </span>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-practice-back" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Back
            </button>

            <button id="btn-enter-3s-trial" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:bg-amber-600 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Enter 3-Second Trial</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    // Interactive practice sandbox logic
    const practiceArea = document.getElementById('practice-touch-area');
    const readout = document.getElementById('practice-center-readout');
    const subtext = document.getElementById('practice-subtext');
    const statusPill = document.getElementById('practice-status-pill');

    let practiceLastTap = 0;

    practiceArea?.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      const now = performance.now();
      playGrainSeedSound(0.35);

      const rect = practiceArea.getBoundingClientRect();
      this.spawnSeedParticle(practiceArea, e.clientX - rect.left, e.clientY - rect.top);

      if (practiceLastTap === 0) {
        practiceLastTap = now;
        if (readout) readout.textContent = 'Planting...';
        if (subtext) subtext.textContent = 'Wait 3 seconds, then tap again';
        if (statusPill) {
          statusPill.textContent = 'Timing active';
          statusPill.className = 'text-[10px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800 px-2 py-0.5 rounded';
        }
      } else {
        const deltaSec = ((now - practiceLastTap) / 1000).toFixed(2);
        practiceLastTap = now;
        if (readout) readout.textContent = `${deltaSec} s`;
        if (subtext) subtext.textContent = 'Target: 3.00 s · Tap again to test';
        if (statusPill) {
          statusPill.textContent = Math.abs(parseFloat(deltaSec) - 3.0) < 0.35 ? 'Splendid!' : 'Adjust tempo';
          statusPill.className = 'text-[10px] font-mono text-amber-300 bg-amber-950/40 border border-amber-800 px-2 py-0.5 rounded';
        }
      }
    });

    document.getElementById('btn-phase2-exit-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.abort();
    });

    document.getElementById('btn-practice-back')?.addEventListener('click', () => {
      playTactileClick();
      this.renderSMTSummaryScreen();
    });

    document.getElementById('btn-enter-3s-trial')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playTactileClick();
      this.startPhase2PracticeBlock();
    });
  }

  /* =========================================================================
     PHASE 2: PRACTICE BLOCK (TRIALS 1-10 WITH BIOFEEDBACK)
     ========================================================================= */

  private startPhase2PracticeBlock(): void {
    this.activePhase = 'prod_practice';
    this.prodPracticeTapCount = 0;
    this.prodLastTapTime = 0;
    this.prodPracticeLogs = [];

    this.renderArenaShell();
    this.bindProductionPracticeTapping();
  }

  private bindProductionPracticeTapping(): void {
    const arena = document.getElementById('aviary-arena');
    const bioContainer = document.getElementById('aviary-biofeedback-container');
    if (!arena) return;

    const handlePracticeTap = (e: PointerEvent) => {
      if (this.activePhase !== 'prod_practice') return;
      if ((e.target as HTMLElement)?.id === 'aviary-abort-btn') return;

      e.preventDefault();
      const now = performance.now();
      playGrainSeedSound(0.4);

      // Spawn visual grain sprite
      this.spawnSeedParticle(arena, e.clientX, e.clientY);

      this.prodPracticeTapCount++;

      if (this.prodLastTapTime === 0) {
        // First tap: anchor onset
        this.prodLastTapTime = now;
        if (bioContainer) {
          bioContainer.innerHTML = `
            <div class="text-center space-y-1 animate-[fadeIn_0.15s_ease]">
              <span class="text-xs font-mono text-stone-500 uppercase tracking-wider block">First Seed Planted</span>
              <span class="text-sm font-mono text-stone-400">Await 3 seconds, then tap again...</span>
            </div>
          `;
          window.setTimeout(() => {
            if (bioContainer) bioContainer.innerHTML = '';
          }, 1200);
        }
        return;
      }

      // Elapsed interval since previous tap
      const intervalMs = now - this.prodLastTapTime;
      const intervalSec = (intervalMs / 1000).toFixed(2);
      this.prodLastTapTime = now;

      // Log practice tap
      const tapLog: AviaryTapLog = {
        trial_index: this.prodPracticeTapCount,
        user_id: this.profile.id,
        chamber: 'Room_3_The_Aviary',
        sub_task: '3S_PROD',
        block_type: 'practice_feedback',
        tap_index: this.prodPracticeTapCount,
        timestamp_perf_now: now,
        inter_tap_interval_ms: intervalMs,
        target_interval_ms: 3000,
        chosen_familiar: this.chosenFamiliar,
        date_iso: new Date().toISOString()
      };
      this.prodPracticeLogs.push(tapLog);
      recordAviaryTapLog(tapLog);

      // Display immediate prominent biofeedback centered on screen for 600ms
      if (bioContainer) {
        const error = Math.abs(intervalMs - 3000);
        const colorClass = error <= 300 ? 'text-emerald-400' : (error <= 700 ? 'text-amber-300' : 'text-rose-400');
        
        bioContainer.innerHTML = `
          <div class="text-center space-y-1 animate-[scaleIn_0.15s_ease]">
            <span class="text-4xl font-mono font-bold ${colorClass} font-mono-num tracking-tight block">
              ${intervalSec} s
            </span>
            <span class="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Target: 3.00 s</span>
          </div>
        `;

        window.setTimeout(() => {
          if (bioContainer && this.activePhase === 'prod_practice') {
            bioContainer.innerHTML = '';
          }
        }, 600);
      }

      // Check if 10 practice intervals have completed
      if (this.prodPracticeLogs.length >= this.prodPracticeTargetIntervals) {
        arena.removeEventListener('pointerdown', handlePracticeTap);
        this.transitionToSilentTesting();
      }
    };

    arena.addEventListener('pointerdown', handlePracticeTap);
  }

  /**
   * Transient message for 1.5 seconds: "Calibration complete. Testing begins..."
   */
  private transitionToSilentTesting(): void {
    const bioContainer = document.getElementById('aviary-biofeedback-container');
    if (bioContainer) {
      bioContainer.innerHTML = `
        <div class="text-center space-y-2 animate-[fadeIn_0.2s_ease]">
          <div class="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <span class="text-xl">✨</span>
          </div>
          <h3 class="text-lg font-arcane text-stone-100 font-semibold">Calibration Complete</h3>
          <p class="text-xs font-mono text-stone-400">Testing begins in total silence...</p>
        </div>
      `;
    }

    const t = window.setTimeout(() => {
      if (bioContainer) bioContainer.innerHTML = '';
      this.startPhase2SilentTestBlock();
    }, 1500);

    this.activeTimeouts.push(t);
  }

  /* =========================================================================
     PHASE 2: TEST BLOCK (100 SILENT TAPS)
     ========================================================================= */

  private startPhase2SilentTestBlock(): void {
    this.activePhase = 'prod_testing';
    this.prodTestTapCount = 0;
    this.prodLastTapTime = 0;
    this.prodTestLogs = [];

    this.bindProductionSilentTapping();
  }

  private bindProductionSilentTapping(): void {
    const arena = document.getElementById('aviary-arena');
    if (!arena) return;

    const handleSilentTap = (e: PointerEvent) => {
      if (this.activePhase !== 'prod_testing') return;
      if ((e.target as HTMLElement)?.id === 'aviary-abort-btn') return;

      e.preventDefault();
      const now = performance.now();
      playGrainSeedSound(0.4);

      // Only display the brief grain sprite at tap coordinates + click sound
      this.spawnSeedParticle(arena, e.clientX, e.clientY);

      this.prodTestTapCount++;

      if (this.prodLastTapTime === 0) {
        this.prodLastTapTime = now;
        return;
      }

      const intervalMs = now - this.prodLastTapTime;
      this.prodLastTapTime = now;

      // Log test tap
      const tapLog: AviaryTapLog = {
        trial_index: this.prodTestTapCount,
        user_id: this.profile.id,
        chamber: 'Room_3_The_Aviary',
        sub_task: '3S_PROD',
        block_type: 'test_silent',
        tap_index: this.prodTestTapCount,
        timestamp_perf_now: now,
        inter_tap_interval_ms: intervalMs,
        target_interval_ms: 3000,
        chosen_familiar: this.chosenFamiliar,
        date_iso: new Date().toISOString()
      };

      this.prodTestLogs.push(tapLog);

      // Local store log
      recordAviaryTapLog(tapLog);

      // Normalized Production Schema Buffering (trials_tp)
      const tpPayload: TPTrialPayload = {
        auth_user_id: this.profile.auth_user_id || this.profile.id,
        subject_id: this.profile.subject_id,
        task: 'TP',
        session: this.sessionId.replace('_SMT_', '_TP_'),
        trial_number: this.prodTestLogs.length,
        rt: Number(Math.round(intervalMs)),
        recorded_at: tapLog.date_iso
      };
      bufferNormalizedTrialLocally('trials_tp', tpPayload, this.sessionId);

      // Check if 100 test intervals have been produced
      if (this.prodTestLogs.length >= this.prodTestTargetIntervals) {
        arena.removeEventListener('pointerdown', handleSilentTap);
        const t = window.setTimeout(() => {
          this.renderFinalCompletionScreen();
        }, 400);
        this.activeTimeouts.push(t);
      }
    };

    arena.addEventListener('pointerdown', handleSilentTap);
  }

  /* =========================================================================
     COMPLETION SCREEN & FINAL TELEMETRY
     ========================================================================= */

  private renderFinalCompletionScreen(): void {
    this.activePhase = 'completed';
    this.isRunning = false;
    this.clearAllTimers();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    playCompletionFanfare();

    // 1. Phase 1 metrics (SMT)
    const smtItis = this.smtLogs.map(l => l.inter_tap_interval_ms).filter((v): v is number => v !== null && v > 50 && v < 5000);
    const smtMean = smtItis.length > 0 ? Math.round(smtItis.reduce((a, b) => a + b, 0) / smtItis.length) : null;
    const smtVariance = smtMean !== null && smtItis.length > 1 
      ? smtItis.reduce((acc, val) => acc + Math.pow(val - smtMean, 2), 0) / (smtItis.length - 1)
      : 0;
    const smtSd = Math.sqrt(smtVariance);
    const smtCv = smtMean !== null && smtItis.length > 1 ? parseFloat(((smtSd / smtMean) * 100).toFixed(1)) : null;

    // 2. Phase 2 metrics (3-Second Production)
    const prodIntervals = this.prodTestLogs.map(l => l.inter_tap_interval_ms).filter((v): v is number => v !== null);
    const prodMeanMs = prodIntervals.length > 0 
      ? Math.round(prodIntervals.reduce((a, b) => a + b, 0) / prodIntervals.length)
      : null;
    const prodMeanSec = prodMeanMs !== null ? (prodMeanMs / 1000).toFixed(2) : null;
    const errorMs = prodMeanMs !== null ? Math.round(Math.abs(prodMeanMs - 3000)) : null;

    // Gamified mastery score
    const smtScore = smtCv !== null ? Math.max(40, Math.min(100, Math.round(100 - smtCv * 2))) : 50;
    const prodScore = errorMs !== null ? Math.max(30, Math.min(100, Math.round(100 - errorMs / 25))) : 50;
    const allSessionLogs = [...this.smtLogs, ...this.prodPracticeLogs, ...this.prodTestLogs];
    const finalMastery = allSessionLogs.length > 0 ? Math.round(smtScore * 0.4 + prodScore * 0.6) : 50;

    recordSessionCompletion('room-3', finalMastery);

    // Flush all buffered trials from this chamber session in batch to Supabase (even after 1 trial)
    flushChamberSession(this.sessionId, 'room-3').catch(() => {});

    const sessionResult: AviarySessionResult = {
      roomId: 'room-3',
      roomName: 'The Aviary',
      chosenFamiliar: this.chosenFamiliar,
      smtMeanItiMs: smtMean ?? 600,
      smtCv: smtCv ?? 0,
      prodMeanIntervalMs: prodMeanMs ?? 3000,
      prodAccuracyErrorMs: errorMs ?? 0,
      totalTaps: allSessionLogs.length,
      logs: allSessionLogs,
      completedAt: new Date().toISOString()
    };

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto select-none">
        
        <div class="max-w-4xl mx-auto w-full space-y-6 flex-1 animate-[fadeIn_0.3s_ease]">
          
          <!-- Header -->
          <div class="border-b border-stone-800 pb-4">
            <div class="text-xs font-mono uppercase tracking-wider text-yellow-400 mb-1 font-semibold">
              Room 3: The Aviary
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-white font-semibold">
              Motor Tempo Performance
            </h1>
            <p class="text-xs sm:text-sm text-emerald-400 font-sans mt-1">
              Ritual accomplished! Your temporal faculties have stabilized the Aviary's skies. Thank you for your devotion, Initiate. Come back tomorrow to reinforce your temporal mastery.
            </p>
          </div>

          <!-- Summary Metric Cards (2 boxes: Natural Tempo & 3-Second Production) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <!-- Natural Tempo Card -->
            <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Natural Tempo</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-amber-300 font-mono-num">
                  ${smtMean !== null ? `${smtMean}<span class="text-xs font-normal text-stone-400 ml-1">ms</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">${smtCv !== null ? `Consistency: ${smtCv}% CV` : 'Not enough trials'}</span>
            </div>

            <!-- 3-Second Production Card -->
            <div class="bg-[#0f121d] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">3-Second Production</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-cyan-300 font-mono-num">
                  ${prodMeanSec !== null ? `${prodMeanSec}<span class="text-xs font-mono text-stone-400 ml-1">s</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Target: 3.00 s (100 Test Cycles)</span>
            </div>

          </div>

          <!-- Stability Curve Visualizer -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-5 space-y-3">
            <div class="flex justify-between items-center border-b border-stone-800/80 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                3-Second Production Stability (100 Silent Taps)
              </span>
              <span class="text-[11px] font-mono text-stone-500">Deviations from 3000ms</span>
            </div>

            <!-- Segmented Mini Sparkline / Heatmap -->
            ${prodIntervals.length === 0 ? `
              <div class="h-16 flex items-center justify-center text-xs font-mono text-stone-400">
                Not enough trials produced to display stability curve
              </div>
            ` : `
              <div class="grid grid-cols-20 sm:grid-cols-50 gap-0.5 h-16 items-end pt-3">
                ${prodIntervals.slice(0, 100).map(ms => {
                  const diff = Math.abs(ms - 3000);
                  const height = Math.min(100, Math.max(15, (ms / 4000) * 100));
                  const bg = diff <= 250 ? 'bg-emerald-400' : (diff <= 600 ? 'bg-amber-400' : 'bg-rose-500');
                  return `<div class="${bg} rounded-t transition-all hover:scale-125" style="height: ${height}%;" title="${(ms/1000).toFixed(2)}s"></div>`;
                }).join('')}
              </div>
            `}

            <div class="flex justify-between text-[10px] font-mono text-stone-500 pt-1">
              <span>Trial 1</span>
              <span>100 Test Cycles</span>
              <span>Trial 100</span>
            </div>
          </div>

          <!-- Ethereal Chamber Seals Inscribed Status -->
          <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 text-xs font-mono text-stone-300 flex justify-between items-center">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span><strong class="text-emerald-400">Session recorded</strong> · Session <code class="text-amber-300">${this.sessionId}</code> synchronized.</span>
            </div>
            <div class="text-stone-500 text-[11px]">
              ${allSessionLogs.length} Events Inscribed
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
            <button id="btn-aviary-replay" class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              Replay
            </button>
            <button id="btn-aviary-return-dashboard" class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
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

    document.getElementById('btn-aviary-replay')?.addEventListener('click', () => {
      playTactileClick();
      this.start();
    });

    document.getElementById('btn-aviary-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.callbacks.onComplete(sessionResult);
    });
  }

  /**
   * Helper: Renders elegant SVG glyph for the chosen avian familiar
   */
  private renderFamiliarGlyph(familiar: AviaryFamiliar): string {
    if (familiar === 'celestial_owl') {
      return `
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="13" r="8"/>
          <path d="M12 5v3"/>
          <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
          <path d="m11 15 1 1 1-1"/>
          <path d="M7 6 5 3"/>
          <path d="M17 6l2-3"/>
        </svg>
      `;
    }
    if (familiar === 'storm_raven') {
      return `
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17l4-2 7 3 7-7-3-1-4 3-4-2z"/>
          <circle cx="18" cy="9" r="1.5" fill="currentColor"/>
          <path d="M8 12l-5 5"/>
        </svg>
      `;
    }
    // Sun Hawk
    return `
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l3 5 5 2-4 4 1 6-5-3-5 3 1-6-4-4 5-2z"/>
        <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
      </svg>
    `;
  }
}

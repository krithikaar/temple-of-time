/**
 * TEMPLE of Time - Room 1: The Weather Spire (The Storm Sanctum)
 * Audiovisual Temporal Binding Window (TBW) & Point of Subjective Simultaneity (PSS)
 * Ternary 3-AFC Simultaneity Judgment & Temporal Order Judgment with interactive Response Wheel.
 * 
 * BACKEND SOA CONVENTION:
 * Negative SOA (< 0): Visual First (Lightning arrives first)
 * 0 ms SOA (== 0): Simultaneous (Both together)
 * Positive SOA (> 0): Audio First (Sound arrives first)
 */

import { ParticipantProfile, WeatherSpireTrialLog, WeatherSpireSessionResult, GroundTruthCondition, ParticipantChoice, SJTrialPayload } from '../types';
import { playWeatherSpireTone, playTactileClick, playCompletionFanfare, playRuneHum } from '../audio';
import { recordWeatherSpireTrialLog, recordSessionCompletion, startTaskSession, bufferNormalizedTrialLocally, flushChamberSession } from '../store';

export interface WeatherSpireCallbacks {
  onComplete: (session: WeatherSpireSessionResult) => void;
  onExit: () => void;
}

export class WeatherSpireTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: WeatherSpireCallbacks;
  private sessionId = '';

  // 17 distinct SOA conditions (Negative = Visual First, Positive = Audio First)
  private readonly soaLevels: number[] = [
    -400, -300, -200, -150, -100, -75, -50, -25,
    0,
    25, 50, 75, 100, 150, 200, 300, 400
  ];
  private readonly repetitionsPerCondition = 12;
  private readonly totalTrials = 204; // 17 * 12

  private trialSequence: number[] = [];
  private currentTrialIndex = 0;
  private trialLogs: WeatherSpireTrialLog[] = [];

  // Timing & state markers
  private isRunning = false;
  private isAwaitingResponse = false;
  private hasPassedHalftime = false;
  private responsePromptTimestamp = 0;
  private activeTimeouts: number[] = [];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: WeatherSpireCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
    this.trialSequence = this.generateConstrainedSOAs();
  }

  /**
   * Generates trials with strict pseudo-randomization constraint:
   * No identical SOA magnitude may appear in two consecutive trials.
   */
  private generateConstrainedSOAs(): number[] {
    const pool: number[] = [];
    for (const soa of this.soaLevels) {
      for (let i = 0; i < this.repetitionsPerCondition; i++) {
        pool.push(soa);
      }
    }

    const maxAttempts = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = [...pool];
      const sequence: number[] = [];
      let lastMag: number | null = null;
      let failed = false;

      while (remaining.length > 0) {
        const candidates: number[] = [];
        for (let i = 0; i < remaining.length; i++) {
          if (lastMag === null || Math.abs(remaining[i]) !== lastMag) {
            candidates.push(i);
          }
        }

        if (candidates.length === 0) {
          failed = true;
          break;
        }

        const chosenCandidateIdx = candidates[Math.floor(Math.random() * candidates.length)];
        const chosen = remaining.splice(chosenCandidateIdx, 1)[0];
        sequence.push(chosen);
        lastMag = Math.abs(chosen);
      }

      if (!failed && sequence.length === this.totalTrials) {
        return sequence;
      }
    }

    return pool.sort(() => Math.random() - 0.5);
  }

  public start(): void {
    this.sessionId = startTaskSession('SJ');
    this.renderInstructionsScreen();
  }

  public terminateToResults(): void {
    this.isRunning = false;
    this.clearAllTimers();
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
     RE-DESIGNED SCREEN 1: WELCOME & INSTRUCTIONS SCREEN
     Full-screen background image with light transparency.
     Exact instructions prominently displayed.
     Button on bottom right to go see demo.
     ========================================================================= */

  private renderInstructionsScreen(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex flex-col justify-between overflow-y-auto select-none">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/wether_spire.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/assets/Wether_Spire.png'; } else if (this.dataset.tried === '1') { this.dataset.tried = '2'; this.src = '/wether_spire.png'; } else { this.src = '/weather_spire_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#08090e] via-[#08090e]/80 to-[#08090e]/60"></div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#08090e_90%)]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Top Navigation Header -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                  Room 1 · The Storm Sanctum
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The Weather Spire
                </h1>
              </div>
            </div>

            <button id="btn-spire-intro-exit" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
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
                  src="/assets/wether_spire.png" 
                  alt="The Weather Spire"
                  class="w-full h-full object-cover object-center sm:object-[center_38%] filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/assets/Wether_Spire.png'; } else if (this.dataset.tried === '1') { this.dataset.tried = '2'; this.src = '/wether_spire.png'; } else if (this.dataset.tried === '2') { this.dataset.tried = '3'; this.src = '/Wether_Spire.png'; } else { this.src = '/weather_spire_bg.svg'; }"
                />
                <!-- Gradient Scrim for Visual Depth & Text Legibility -->
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0b0e19] via-[#0b0e19]/35 to-transparent"></div>
                <div class="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0b0e19]/50 via-transparent to-[#0b0e19]/30"></div>
                <!-- Subtle Arcane Inner Glow -->
                <div class="absolute inset-0 pointer-events-none ring-1 ring-inset ring-amber-500/20 rounded-t-2xl"></div>
              </div>

              <!-- Welcome Card (Inside / Below the Banner Image) -->
              <div class="p-5 sm:p-6 bg-[#0f121d]/95 backdrop-blur-md border-t border-amber-500/30 space-y-2.5">
                <div class="flex items-start space-x-3.5">
                  <div class="mt-1 w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)] shrink-0"></div>
                  <div class="space-y-2">
                    <h2 class="text-lg sm:text-2xl font-arcane text-amber-200 font-bold tracking-wide">
                      Welcome to the Weather Spire!
                    </h2>
                    <p class="text-sm sm:text-base text-stone-100 font-medium leading-relaxed">
                      You are going to learn to control the weather by judging the alignment between lightening flashes and thunder tones.
                    </p>
                    <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                      Each time you hear a thunder tone and see a flash of lightening, judge their order of appearance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Three Side-by-Side Cards (1. Light first / 2. Simultaneous / 3. Sound First) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              <!-- 1. Light First -->
              <div class="bg-[#0f121d]/85 backdrop-blur-sm border border-amber-500/30 hover:border-amber-400/60 rounded-xl p-4 space-y-1.5 transition-colors shadow-md">
                <div class="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>
                  <span>1. Light First</span>
                </div>
                <p class="text-xs text-stone-300 leading-relaxed">
                  The visual lightning bolt flashes <strong>before</strong> the thunder tone is heard.
                </p>
              </div>

              <!-- 2. Simultaneous -->
              <div class="bg-[#0f121d]/85 backdrop-blur-sm border border-emerald-500/30 hover:border-emerald-400/60 rounded-xl p-4 space-y-1.5 transition-colors shadow-md">
                <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                  <span>2. Simultaneous</span>
                </div>
                <p class="text-xs text-stone-300 leading-relaxed">
                  Both lightning flash and thunder tone occur together at the <strong>exact same moment</strong>.
                </p>
              </div>

              <!-- 3. Sound First -->
              <div class="bg-[#0f121d]/85 backdrop-blur-sm border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl p-4 space-y-1.5 transition-colors shadow-md">
                <div class="flex items-center space-x-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"></span>
                  <span>3. Sound First</span>
                </div>
                <p class="text-xs text-stone-300 leading-relaxed">
                  The acoustic thunder tone is heard <strong>before</strong> the lightning bolt flashes.
                </p>
              </div>

            </div>

            <!-- Hardware Recommendation Card -->
            <div class="bg-amber-950/25 border border-amber-500/25 rounded-xl p-3.5 sm:p-4 flex items-center space-x-3 text-xs text-amber-200/90 shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400 shrink-0">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span class="leading-relaxed">
                <strong>Hardware Recommendation:</strong> Set device volume to 70–80%. Please use wired headphones or device speakers (avoid wireless Bluetooth delay for precise temporal calibration).
              </span>
            </div>

          </div>

          <!-- Bottom Actions Bar: Left button returns to dashboard, Right button leads to next screen -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-spire-intro-return" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Return to Dashboard
            </button>

            <button id="btn-spire-go-demo" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Go to Interactive Demo</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    document.getElementById('btn-spire-intro-exit')?.addEventListener('click', () => {
      playTactileClick();
      this.abort();
    });

    document.getElementById('btn-spire-intro-return')?.addEventListener('click', () => {
      playTactileClick();
      this.abort();
    });

    // Button on bottom right -> Next screen leads to Interactive Demo Screen
    document.getElementById('btn-spire-go-demo')?.addEventListener('click', () => {
      playTactileClick();
      this.renderInteractiveDemoScreen();
    });
  }

  /* =========================================================================
     RE-DESIGNED SCREEN 2: INTERACTIVE DEMO SCREEN
     Full-screen background image with light transparency.
     Interactive audio-visual stimuli triggers (Light First, Simultaneous, Sound First).
     Interactive response dial practice with confidence measurement.
     Try-it-out practice round.
     ========================================================================= */

  private renderInteractiveDemoScreen(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex flex-col justify-between overflow-y-auto select-none">
        
        <!-- Full-screen Background Image with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/wether_spire.png" 
            alt=""
            class="w-full h-full object-cover opacity-25 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/assets/Wether_Spire.png'; } else if (this.dataset.tried === '1') { this.dataset.tried = '2'; this.src = '/wether_spire.png'; } else { this.src = '/weather_spire_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#08090e] via-[#08090e]/75 to-[#08090e]/50"></div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#08090e_90%)]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Bar -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                  Interactive Demo & Practice
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  Experience & Practice Signals
                </h1>
              </div>
            </div>

            <button id="btn-demo-back-top" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Instructions</span>
            </button>
          </div>

          <!-- Main Interactive Demo Body -->
          <div class="space-y-6">
            
            <!-- 1. Interactive Stimuli Preview Section -->
            <div class="bg-[#0f121d]/90 backdrop-blur-md border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>1. Tap to Hear & See Each Order Condition:</span>
                </span>
                <span class="text-[11px] font-mono text-stone-400">
                  Click any button to trigger live stimuli
                </span>
              </div>

              <!-- 3 Condition Buttons -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                <button id="btn-demo-light-first" class="p-3.5 bg-[#08090e]/90 hover:bg-amber-950/20 active:scale-[0.98] border border-amber-500/40 rounded-xl text-left transition-all cursor-pointer group">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-mono text-amber-300 font-bold">Light First</span>
                    <span class="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded">-400 ms</span>
                  </div>
                  <div class="text-[11px] text-stone-400">
                    Lightning flashes <strong>first</strong>, followed by thunder.
                  </div>
                </button>

                <button id="btn-demo-simultaneous" class="p-3.5 bg-[#08090e]/90 hover:bg-emerald-950/20 active:scale-[0.98] border border-emerald-500/40 rounded-xl text-left transition-all cursor-pointer group">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-mono text-emerald-300 font-bold">Simultaneous</span>
                    <span class="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">0 ms</span>
                  </div>
                  <div class="text-[11px] text-stone-400">
                    Flash and thunder tone occur in <strong>exact sync</strong>.
                  </div>
                </button>

                <button id="btn-demo-sound-first" class="p-3.5 bg-[#08090e]/90 hover:bg-cyan-950/20 active:scale-[0.98] border border-cyan-500/40 rounded-xl text-left transition-all cursor-pointer group">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-mono text-cyan-300 font-bold">Sound First</span>
                    <span class="text-[10px] font-mono text-cyan-400/80 bg-cyan-500/10 px-1.5 py-0.5 rounded">+400 ms</span>
                  </div>
                  <div class="text-[11px] text-stone-400">
                    Thunder tone sounds <strong>first</strong>, followed by flash.
                  </div>
                </button>

              </div>

              <!-- Live Demo Visual Stage Viewport -->
              <div id="demo-preview-viewport" class="w-full h-28 bg-[#000000] border border-stone-800 rounded-xl flex flex-col items-center justify-center relative overflow-hidden transition-all shadow-inner">
                <span id="demo-preview-label" class="text-xs font-mono text-stone-500 uppercase tracking-widest text-center px-4">
                  [ Tap any condition button above to play stimuli ]
                </span>
                <div id="demo-lightning-bolt" class="hidden absolute">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="white" class="filter drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
              </div>
            </div>

            <!-- 2. Interactive Response Wheel Practice -->
            <div class="bg-[#0f121d]/90 backdrop-blur-md border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800/80 pb-3">
                <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center space-x-2">
                  <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>2. Practice on the Response Dial:</span>
                </span>
                <span class="text-[11px] font-mono text-stone-400">
                  Touch or click anywhere on the wheel
                </span>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <!-- Response Wheel Canvas -->
                <div class="flex flex-col items-center justify-center">
                  <canvas id="demo-response-canvas" width="280" height="280" class="cursor-pointer touch-none bg-[#050608] rounded-2xl border border-stone-800 shadow-lg"></canvas>
                  <span class="text-[10px] font-mono text-stone-500 mt-2">
                    Tip: Distance from center adjusts confidence rating
                  </span>
                </div>

                <!-- Dial Feedback & Legend -->
                <div class="space-y-3 font-mono text-xs">
                  <div id="demo-response-feedback" class="p-4 rounded-xl bg-[#08090e] border border-stone-800 text-stone-300 min-h-[64px] flex items-center">
                    <div>
                      <span class="text-stone-400 block text-[11px]">Last Touch Selection:</span>
                      <span class="text-amber-300 font-semibold text-sm">Touch any ray to test your response</span>
                    </div>
                  </div>

                  <div class="bg-[#08090e]/80 border border-stone-800/80 rounded-xl p-3.5 space-y-2 text-[11px]">
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <strong class="text-emerald-300">Top Ray:</strong>
                      <span class="text-stone-300">Simultaneous (Both occurred together)</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      <strong class="text-amber-300">Bottom-Right Ray:</strong>
                      <span class="text-stone-300">Light arrived first</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                      <strong class="text-cyan-300">Bottom-Left Ray:</strong>
                      <span class="text-stone-300">Sound arrived first</span>
                    </div>
                    <div class="pt-1 border-t border-stone-800 text-stone-400 text-[10px]">
                      <strong>Confidence Gauge:</strong> Center hub = 0% Guess · Outer rim = 100% Certainty
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Bottom Actions Bar: Back & Enter Spire -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-demo-back-bottom" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Back to Instructions
            </button>

            <button id="btn-enter-spire-session" class="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center justify-center space-x-3 cursor-pointer">
              <span>Enter Weather Spire</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    // Hook up preview demo condition buttons
    const previewLabel = document.getElementById('demo-preview-label');
    const boltEl = document.getElementById('demo-lightning-bolt');

    const triggerDemoCondition = (soa: number, title: string) => {
      playTactileClick();
      if (previewLabel) {
        previewLabel.textContent = `Playing: ${title} (${soa === 0 ? '0 ms' : (soa < 0 ? `${Math.abs(soa)} ms Light First` : `${soa} ms Sound First`)})`;
        previewLabel.classList.remove('text-stone-500');
        previewLabel.classList.add('text-amber-300');
      }
      if (boltEl) boltEl.classList.add('hidden');

      if (soa < 0) {
        // Visual first (Negative SOA)
        if (boltEl) {
          boltEl.classList.remove('hidden');
          setTimeout(() => boltEl?.classList.add('hidden'), 44);
        }
        setTimeout(() => {
          playWeatherSpireTone(0.6);
        }, Math.abs(soa));
      } else if (soa === 0) {
        // Simultaneous
        playWeatherSpireTone(0.6);
        if (boltEl) {
          boltEl.classList.remove('hidden');
          setTimeout(() => boltEl?.classList.add('hidden'), 44);
        }
      } else {
        // Audio first (Positive SOA)
        playWeatherSpireTone(0.6);
        setTimeout(() => {
          if (boltEl) {
            boltEl.classList.remove('hidden');
            setTimeout(() => boltEl?.classList.add('hidden'), 44);
          }
        }, soa);
      }
    };

    document.getElementById('btn-demo-light-first')?.addEventListener('click', () => {
      triggerDemoCondition(-400, 'Light First');
    });

    document.getElementById('btn-demo-simultaneous')?.addEventListener('click', () => {
      triggerDemoCondition(0, 'Simultaneous');
    });

    document.getElementById('btn-demo-sound-first')?.addEventListener('click', () => {
      triggerDemoCondition(400, 'Sound First');
    });

    // Mount Interactive Response Canvas in Demo
    const demoCanvas = document.getElementById('demo-response-canvas') as HTMLCanvasElement;
    const demoFeedback = document.getElementById('demo-response-feedback');
    if (demoCanvas) {
      this.mountResponseWheel(demoCanvas, (choice, confPct) => {
        playTactileClick();
        if (demoFeedback) {
          const names: Record<ParticipantChoice, string> = {
            simultaneous: 'Simultaneous (Both together)',
            sound_first: 'Sound First (Thunder then Light)',
            light_first: 'Light First (Lightning then Sound)',
            audio_first: 'Sound First (Thunder then Light)',
            visual_first: 'Light First (Lightning then Sound)'
          };
          const colors: Record<ParticipantChoice, string> = {
            simultaneous: 'text-emerald-400',
            sound_first: 'text-cyan-400',
            light_first: 'text-amber-400',
            audio_first: 'text-cyan-400',
            visual_first: 'text-amber-400'
          };
          demoFeedback.innerHTML = `
            <div>
              <span class="text-stone-400 block text-[11px]">Selected Judgment:</span>
              <div class="flex items-center space-x-2">
                <span class="${colors[choice]} font-bold text-sm">${names[choice]}</span>
                <span class="text-stone-500">·</span>
                <span class="text-stone-100 font-mono text-sm">${confPct}% Certainty</span>
              </div>
            </div>
          `;
        }
      });
    }

    const backToInstructions = () => {
      playTactileClick();
      this.renderInstructionsScreen();
    };

    document.getElementById('btn-demo-back-top')?.addEventListener('click', backToInstructions);
    document.getElementById('btn-demo-back-bottom')?.addEventListener('click', backToInstructions);

    // Enter Spire button starts the real session
    document.getElementById('btn-enter-spire-session')?.addEventListener('click', () => {
      playTactileClick();
      this.startSession();
    });
  }

  /* =========================================================================
     PSYCHOPHYSICS SESSION CONTROLLER
     ========================================================================= */

  private startSession(): void {
    this.isRunning = true;
    this.hasPassedHalftime = false;
    this.currentTrialIndex = 0;
    this.trialLogs = [];
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.terminateToResults();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
    this.renderArenaShell();
    this.runTrialSequence(this.currentTrialIndex);
  }

  /**
   * Renders the pitch-black (#000000) trial viewport for exact stimulus perception
   */
  private renderArenaShell(): void {
    this.container.innerHTML = `
      <div id="weather-spire-arena" class="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-between select-none overflow-hidden touch-none p-4">
        
        <!-- Subtle top abort in corner (minimalist font-mono) -->
        <div class="w-full flex justify-between items-center text-[10px] font-mono text-stone-700 pointer-events-auto">
          <span>THE WEATHER SPIRE · CALIBRATION ARENA</span>
          <button id="spire-abort-btn" class="px-2.5 py-1 text-stone-600 hover:text-stone-300 border border-transparent hover:border-stone-800 rounded transition-colors cursor-pointer">
            ESC / EXIT
          </button>
        </div>

        <!-- Central Psychophysics Stimulus & Response Stage -->
        <div id="spire-stimulus-stage" class="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto relative">
          <!-- Stimuli & Response will mount here -->
        </div>

        <!-- Minimal footer branding (no trial count spoilers) -->
        <div class="w-full flex justify-center items-center pb-2 text-[10px] font-mono text-stone-800">
          <span>TEMPLE OF TIME · WARD ALIGNMENT</span>
        </div>

      </div>
    `;

    const handleAbort = (e: Event) => {
      e.preventDefault();
      this.terminateToResults();
    };

    document.getElementById('spire-abort-btn')?.addEventListener('pointerdown', handleAbort);
    document.getElementById('spire-abort-btn')?.addEventListener('click', handleAbort);
  }

  /**
   * Orchestrates a single trial: Fixation -> Audio/Visual Presentation -> Response
   */
  private runTrialSequence(index: number): void {
    if (!this.isRunning) return;

    // Check for halftime break at trial 102
    if (index === 102 && !this.hasPassedHalftime) {
      this.hasPassedHalftime = true;
      this.renderHalftimeBreak();
      return;
    }

    if (index >= this.totalTrials) {
      this.renderCompletionScreen();
      return;
    }

    this.currentTrialIndex = index;
    const soa = this.trialSequence[index];

    const stage = document.getElementById('spire-stimulus-stage');
    if (!stage) return;

    // Phase 1: Minimalist Fixation Dot with Randomized Jitter (800ms - 1300ms)
    stage.innerHTML = `
      <div id="fixation-dot-container" class="flex items-center justify-center w-full h-full">
        <div class="w-2.5 h-2.5 rounded-full bg-stone-600 shadow-[0_0_8px_rgba(120,113,108,0.4)]"></div>
      </div>
    `;

    const itiDuration = 800 + Math.random() * 500;

    const tId = window.setTimeout(() => {
      if (!this.isRunning) return;
      this.presentBimodalStimuli(soa);
    }, itiDuration);
    this.activeTimeouts.push(tId);
  }

  /**
   * Phase 2: Presents Visual Lightning Bolt (44ms) and 1000Hz Tone (44ms) with precision SOA
   * BACKEND RECODING:
   * Negative SOA (< 0) = Visual First (Lightning first, then Tone)
   * 0 ms SOA (== 0) = Simultaneous (Lightning + Tone together)
   * Positive SOA (> 0) = Audio First (Tone first, then Lightning)
   */
  private presentBimodalStimuli(soa: number): void {
    const stage = document.getElementById('spire-stimulus-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div id="stimulus-display" class="flex items-center justify-center w-full h-full relative">
        <div id="active-lightning-bolt" class="hidden">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="white" class="filter drop-shadow-[0_0_15px_rgba(255,255,255,0.95)]">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
      </div>
    `;

    const boltEl = document.getElementById('active-lightning-bolt');

    const flashLightning = () => {
      if (boltEl) {
        boltEl.classList.remove('hidden');
        const flashTimeout = window.setTimeout(() => {
          boltEl?.classList.add('hidden');
        }, 44); // exactly 44 ms visual stimulus
        this.activeTimeouts.push(flashTimeout);
      }
    };

    const playTone = () => {
      playWeatherSpireTone(0.5); // exactly 44 ms synthesized pure sine wave
    };

    if (soa < 0) {
      // Visual First (Negative SOA: Light arrives first)
      flashLightning();
      const soundT = window.setTimeout(() => {
        playTone();
      }, Math.abs(soa));
      this.activeTimeouts.push(soundT);
    } else if (soa === 0) {
      // Simultaneous (0 ms: Both together)
      playTone();
      flashLightning();
    } else {
      // Audio First (Positive SOA: Sound arrives first)
      playTone();
      const flashT = window.setTimeout(() => {
        flashLightning();
      }, soa);
      this.activeTimeouts.push(flashT);
    }

    // Schedule presentation of response canvas once both stimuli have elapsed
    const totalPresentationWindow = Math.abs(soa) + 44 + 180;
    const canvasT = window.setTimeout(() => {
      if (!this.isRunning) return;
      this.renderResponsePhase(soa);
    }, totalPresentationWindow);
    this.activeTimeouts.push(canvasT);
  }

  /**
   * Phase 3: Response Interface
   */
  private renderResponsePhase(soa: number): void {
    const stage = document.getElementById('spire-stimulus-stage');
    if (!stage) return;

    stage.innerHTML = `
      <div class="flex flex-col items-center justify-center space-y-3 w-full animate-[fadeIn_0.2s_ease]">
        <canvas id="response-canvas" width="340" height="340" class="cursor-pointer touch-none"></canvas>
        <div id="selection-feedback-label" class="text-xs font-mono text-stone-500 uppercase tracking-wider h-5 flex items-center justify-center">
          Touch or click to record response & confidence
        </div>
      </div>
    `;

    const canvas = document.getElementById('response-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    this.isAwaitingResponse = true;
    this.responsePromptTimestamp = performance.now();

    this.mountResponseWheel(canvas, (choice, confPct) => {
      if (!this.isAwaitingResponse) return;
      this.isAwaitingResponse = false;

      const reactionTime = performance.now() - this.responsePromptTimestamp;
      playTactileClick();

      const feedbackLabel = document.getElementById('selection-feedback-label');
      if (feedbackLabel) {
        const choiceNames: Record<ParticipantChoice, string> = {
          simultaneous: 'Simultaneous',
          sound_first: 'Sound First',
          light_first: 'Light First',
          audio_first: 'Sound First',
          visual_first: 'Light First'
        };
        feedbackLabel.textContent = `${choiceNames[choice]} · ${confPct}% Confidence`;
        feedbackLabel.classList.add('text-amber-400');
      }

      // Ground truth determination (Negative SOA = Visual First, Positive SOA = Audio First)
      let groundTruth: GroundTruthCondition = 'simultaneous';
      if (soa < 0) groundTruth = 'visual_first';
      else if (soa > 0) groundTruth = 'audio_first';

      // Log trial record
      const trialRecord: WeatherSpireTrialLog = {
        trial_index: this.currentTrialIndex + 1,
        user_id: this.profile.id,
        chamber: 'Room_1_Weather_Spire',
        soa_ms: soa,
        ground_truth_condition: groundTruth,
        participant_choice: choice,
        confidence_pct: confPct,
        reaction_time_ms: Math.round(reactionTime),
        timestamp: new Date().toISOString()
      };

      this.trialLogs.push(trialRecord);

      // Local storage history
      recordWeatherSpireTrialLog(trialRecord);

      // Normalized Production Schema Buffering (trials_sj)
      const sjPayload: SJTrialPayload = {
        auth_user_id: this.profile.auth_user_id || this.profile.id,
        subject_id: this.profile.subject_id,
        task: 'SJ',
        session: this.sessionId,
        trial_number: trialRecord.trial_index,
        response: choice === 'sound_first' ? 1 : choice === 'simultaneous' ? 3 : 5,
        confidence: Math.round(confPct),
        soa: Number(soa),
        recorded_at: trialRecord.timestamp
      };
      bufferNormalizedTrialLocally('trials_sj', sjPayload, this.sessionId);

      // Advance to next trial after short 220ms feedback delay
      const nextT = window.setTimeout(() => {
        this.runTrialSequence(this.currentTrialIndex + 1);
      }, 220);
      this.activeTimeouts.push(nextT);
    });
  }

  /**
   * Reusable interactive response wheel renderer used for both demo and live trials
   */
  private mountResponseWheel(
    canvas: HTMLCanvasElement, 
    onSelect: (choice: ParticipantChoice, confPct: number) => void
  ): void {
    const dpr = window.devicePixelRatio || 1;
    const clientSize = canvas.clientWidth || 320;
    const size = Math.min(320, clientSize);

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const center = size / 2;
    const rMin = Math.round(size * 0.11); // Central hub (0% guess zone)
    const rMax = Math.round(size * 0.42); // Outer arm tips (100% confidence)

    const rayAngles = {
      simultaneous: -Math.PI / 2,     // Top: Simultaneous
      sound_first: (5 * Math.PI) / 6, // Bottom-Left: Sound First
      light_first: Math.PI / 6        // Bottom-Right: Light First
    };

    const drawWheel = (selectedPoint?: { x: number; y: number; choice: ParticipantChoice; confPct: number }) => {
      ctx.clearRect(0, 0, size, size);

      // Outer boundary circle
      ctx.beginPath();
      ctx.arc(center, center, rMax, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e2538';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw the 3 Rays
      const rays: { key: ParticipantChoice; angle: number; label: string; color: string }[] = [
        { key: 'simultaneous', angle: rayAngles.simultaneous, label: 'Simultaneous', color: '#10b981' },
        { key: 'sound_first', angle: rayAngles.sound_first, label: 'Sound First', color: '#38bdf8' },
        { key: 'light_first', angle: rayAngles.light_first, label: 'Light First', color: '#f59e0b' }
      ];

      rays.forEach(ray => {
        const xStart = center + rMin * Math.cos(ray.angle);
        const yStart = center + rMin * Math.sin(ray.angle);
        const xEnd = center + rMax * Math.cos(ray.angle);
        const yEnd = center + rMax * Math.sin(ray.angle);

        // Ray line
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.strokeStyle = selectedPoint?.choice === ray.key ? ray.color : '#334155';
        ctx.lineWidth = selectedPoint?.choice === ray.key ? 3 : 2;
        ctx.stroke();

        // Label near tip
        const labelRadius = rMax + 14;
        const xLabel = center + labelRadius * Math.cos(ray.angle);
        const yLabel = center + labelRadius * Math.sin(ray.angle);

        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = selectedPoint?.choice === ray.key ? ray.color : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ray.label, xLabel, yLabel);
      });

      // Central Hub (0% Confidence Zone)
      ctx.beginPath();
      ctx.arc(center, center, rMin, 0, Math.PI * 2);
      ctx.fillStyle = selectedPoint && selectedPoint.confPct === 0 ? '#1e293b' : '#0a0d16';
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hub Label
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('0% GUESS', center, center);

      // Selected Feedback Marker
      if (selectedPoint) {
        ctx.beginPath();
        ctx.arc(selectedPoint.x, selectedPoint.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    drawWheel();

    const handlePointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touchX = e.clientX - rect.left;
      const touchY = e.clientY - rect.top;

      const dx = touchX - center;
      const dy = touchY - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      const angleDiff = (a: number, b: number) => {
        let diff = (a - b) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return Math.abs(diff);
      };

      const diffSim = angleDiff(angle, rayAngles.simultaneous);
      const diffSound = angleDiff(angle, rayAngles.sound_first);
      const diffLight = angleDiff(angle, rayAngles.light_first);

      let choice: ParticipantChoice = 'simultaneous';
      let targetAngle = rayAngles.simultaneous;

      if (diffSound < diffSim && diffSound < diffLight) {
        choice = 'sound_first';
        targetAngle = rayAngles.sound_first;
      } else if (diffLight < diffSim && diffLight < diffSound) {
        choice = 'light_first';
        targetAngle = rayAngles.light_first;
      }

      let confPct = 0;
      let projectedRadius = rMin;

      if (dist <= rMin) {
        confPct = 0;
        projectedRadius = rMin;
      } else if (dist >= rMax) {
        confPct = 100;
        projectedRadius = rMax;
      } else {
        confPct = Math.round(((dist - rMin) / (rMax - rMin)) * 100);
        projectedRadius = dist;
      }

      const markerX = center + projectedRadius * Math.cos(targetAngle);
      const markerY = center + projectedRadius * Math.sin(targetAngle);

      drawWheel({ x: markerX, y: markerY, choice, confPct });
      onSelect(choice, confPct);
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
  }

  /* =========================================================================
     MID-SESSION REST & COMPLETION SCREENS
     ========================================================================= */

  /**
   * Screen: Halftime Break (at trial 102)
   */
  private renderHalftimeBreak(): void {
    playRuneHum(180, 400);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
        
        <!-- Full-screen Background Image with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/wether_spire.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/assets/Wether_Spire.png'; } else if (this.dataset.tried === '1') { this.dataset.tried = '2'; this.src = '/wether_spire.png'; } else { this.src = '/weather_spire_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-[#08090e]/80"></div>
        </div>

        <div class="relative z-10 bg-[#0f121d]/95 backdrop-blur-md border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-[fadeIn_0.3s_ease]">
          
          <div class="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>

          <div>
            <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1">
              Weather Ward Calibration
            </div>
            <h2 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold">
              Halftime Rest
            </h2>
          </div>

          <p class="text-xs sm:text-sm text-stone-300 leading-relaxed">
            The atmospheric pressure atop the Storm Sanctum has momentarily stabilized.
            Take a moment to relax your eyes and posture before continuing the remaining temporal alignments.
          </p>

          <div class="pt-2">
            <button id="btn-resume-calibration" class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2 cursor-pointer">
              <span>Resume Calibration</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    const resumeBtn = document.getElementById('btn-resume-calibration');
    if (resumeBtn) {
      const handleResume = (e: Event) => {
        e.preventDefault();
        playTactileClick();
        this.renderArenaShell();
        this.runTrialSequence(102);
      };
      resumeBtn.addEventListener('pointerdown', handleResume);
      resumeBtn.addEventListener('click', handleResume);
    }
  }

  /**
   * Screen: Final Completion & Gamified Psychophysics Telemetry
   */
  private renderCompletionScreen(): void {
    this.isRunning = false;
    this.clearAllTimers();
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    playCompletionFanfare();

    const trials = this.trialLogs;
    const total = trials.length;
    const simultCount = trials.filter(t => t.participant_choice === 'simultaneous').length;
    const simultRate = total > 0 ? Math.round((simultCount / total) * 100) : null;

    const rts = trials.map(t => t.reaction_time_ms).filter(r => typeof r === 'number' && !isNaN(r));
    const meanRt = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;

    const confs = trials.map(t => t.confidence_pct).filter(c => typeof c === 'number' && !isNaN(c));
    const meanConf = confs.length > 0 ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;

    const masteryScore = total > 0 
      ? Math.min(100, Math.max(50, Math.round((simultRate ?? 0) * 0.4 + (100 - (meanRt ?? 500) / 15) * 0.3 + (meanConf ?? 50) * 0.3)))
      : 50;

    recordSessionCompletion('room-1', masteryScore);

    // Flush all buffered trials from this chamber session in batch to Supabase (even 1 trial)
    flushChamberSession(this.sessionId, 'room-1').catch(() => {});

    const sessionResult: WeatherSpireSessionResult = {
      roomId: 'room-1',
      roomName: 'The Weather Spire',
      totalTrials: total,
      simultaneityRatePct: simultRate ?? 0,
      meanReactionTimeMs: meanRt ?? 0,
      meanConfidencePct: meanConf ?? 0,
      trials: this.trialLogs,
      completedAt: new Date().toISOString()
    };

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto select-none">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/wether_spire.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/assets/Wether_Spire.png'; } else if (this.dataset.tried === '1') { this.dataset.tried = '2'; this.src = '/wether_spire.png'; } else { this.src = '/weather_spire_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-[#08090e]/85"></div>
        </div>

        <div class="relative z-10 max-w-4xl mx-auto w-full space-y-6 flex-1 animate-[fadeIn_0.3s_ease]">
          
          <!-- Header -->
          <div class="border-b border-stone-800 pb-4">
            <div class="text-xs font-mono uppercase tracking-wider text-yellow-400 mb-1 font-semibold">
              Room 1: The Weather Spire
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-white font-semibold">
              Simultaneity and Temporal Order Judgement
            </h1>
            <p class="text-xs sm:text-sm text-emerald-400 font-sans mt-1">
              Great gameplay! Your temporal synchronization has reinforced the Weather Spire. Come again tomorrow!
            </p>
          </div>

          <!-- Summary Metric Cards (2 boxes: Mean RT & Mean Confidence) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Mean RT</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-cyan-300 font-mono-num">
                  ${meanRt !== null ? `${meanRt}<span class="text-xs font-mono text-stone-400 ml-1">ms</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Response Initiation Speed</span>
            </div>

            <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Mean Confidence</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-stone-100 font-mono-num">
                  ${meanConf !== null ? `${meanConf}%` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Response Dial Radial</span>
            </div>

          </div>

          <!-- Audiovisual Simultaneity Curve Preview -->
          <div class="bg-[#0f121d]/90 backdrop-blur-sm border border-stone-800 rounded-2xl p-5 space-y-3">
            <div class="flex justify-between items-center border-b border-stone-800/80 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Audiovisual Simultaneity Distribution
              </span>
              <span class="text-[11px] font-mono text-stone-500">Perceptual Alignment Curve</span>
            </div>

            <!-- Mini Bar Chart of Simultaneity Rate across SOAs -->
            ${total === 0 ? `
              <div class="h-24 flex items-center justify-center text-xs font-mono text-stone-400">
                Not enough trials to display alignment curve
              </div>
            ` : `
              <div class="grid grid-cols-17 gap-1 h-24 items-end pt-4 px-2">
                ${this.soaLevels.map(soa => {
                  const soaTrials = trials.filter(t => t.soa_ms === soa);
                  const sCount = soaTrials.filter(t => t.participant_choice === 'simultaneous').length;
                  const pct = soaTrials.length > 0 ? Math.round((sCount / soaTrials.length) * 100) : 0;
                  return `
                    <div class="flex flex-col items-center h-full justify-end group relative">
                      <div class="w-full bg-amber-500/80 hover:bg-amber-400 rounded-t transition-all" style="height: ${Math.max(4, pct)}%"></div>
                      <span class="text-[8px] font-mono text-stone-500 mt-1 truncate">${soa === 0 ? '0' : Math.abs(soa)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <div class="flex justify-between text-[10px] font-mono text-stone-500 pt-1">
              <span>← Light First (Visual First)</span>
              <span class="text-emerald-400">Simultaneous (0ms)</span>
              <span>Sound First (Audio First) →</span>
            </div>
          </div>

          <!-- Research Data Storage Confirmation with Session Recorded -->
          <div class="bg-[#08090e]/90 border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-mono">
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
        <div class="relative z-10 max-w-4xl mx-auto w-full pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs bg-emerald-950/20 border border-emerald-500/30 px-3.5 py-2.5 rounded-xl">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Task data saved</span>
          </div>

          <div class="w-full sm:w-auto flex items-center space-x-3">
            <button id="btn-spire-replay" class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              Replay
            </button>
            <button id="btn-spire-return-dashboard" class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
              <span>Return to Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Application Master Footer -->
        <footer id="app-footer" class="relative z-10 max-w-4xl mx-auto w-full pt-8 pb-3 text-center">
          TEMPLE of TIME: Timescales of Experience: Motor, Perceptual & Latency of Executive-function
        </footer>

      </div>
    `;

    document.getElementById('btn-spire-replay')?.addEventListener('click', () => {
      playTactileClick();
      this.start();
    });

    document.getElementById('btn-spire-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.callbacks.onComplete(sessionResult);
    });
  }
}

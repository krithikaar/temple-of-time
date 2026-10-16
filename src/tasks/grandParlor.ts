/**
 * TEMPLE of Time - Room 2: The Grand Parlor
 * Paradigm: Intentional Binding & Causal Attribution (Enchanted Chess)
 * Action-Outcome delay manipulation (0 - 1400 ms) assessing Sense of Agency.
 */

import { ParticipantProfile, GrandParlorTrialLog, GrandParlorSessionResult, ChessPieceAllegiance, PsychophysicsTrial, SOATrialPayload } from '../types';
import { playChessPieceSound, playTactileClick, playCompletionFanfare, playRuneHum } from '../audio';
import { recordGrandParlorTrialLog, recordSessionCompletion, startTaskSession, bufferTrialLocally, bufferNormalizedTrialLocally, flushChamberSession } from '../store';

export interface GrandParlorCallbacks {
  onComplete: (session: GrandParlorSessionResult) => void;
  onExit: () => void;
}

export class GrandParlorTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: GrandParlorCallbacks;
  private sessionId = '';

  // 11 delay levels across 10 repetitions = 110 trials
  private readonly delayLevels = [0, 140, 280, 420, 560, 700, 840, 980, 1120, 1260, 1400];
  private readonly repetitionsPerDelay = 10;
  private readonly totalTrials = 110; // 11 * 10

  private trialSequence: number[] = [];
  private currentTrialIndex = 0;
  private trialLogs: GrandParlorTrialLog[] = [];

  // Selected allegiance
  private selectedPiece: ChessPieceAllegiance = 'white_knight';

  // Trial state
  private isRunning = false;
  private isWaitingForPieceTap = false;
  private hasPassedHalftime = false;
  private currentSquare = 0;
  private targetSquare = 0;
  private actionTimestamp = 0;
  private responsePromptTimestamp = 0;
  private sliderInitialRandomPos = 50;

  private activeTimeouts: number[] = [];
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: GrandParlorCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
    this.trialSequence = this.generateRandomDelays();
  }

  /**
   * Generates 110 randomized delay trials
   */
  private generateRandomDelays(): number[] {
    const pool: number[] = [];
    for (const delay of this.delayLevels) {
      for (let i = 0; i < this.repetitionsPerDelay; i++) {
        pool.push(delay);
      }
    }
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  public start(): void {
    this.sessionId = startTaskSession('SOA');
    this.renderOnboardingStep1();
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
     ONBOARDING & INTERACTIVE INSTRUCTION FLOW
     Strict User-Facing Rule: NO lab jargon ("VAS", "SOAs", "psychophysics", trial numbers).
     ========================================================================= */

  /**
   * Step 1: Narrative Briefing & Piece Selection (Knight vs Rook)
   */
  private renderOnboardingStep1(): void {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex flex-col justify-between overflow-y-auto select-none">
        
        <!-- Full-screen Background with Light Transparency -->
        <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img 
            src="/assets/SOA_bg_game_room.png" 
            alt=""
            class="w-full h-full object-cover opacity-20 filter saturate-110"
            referrerpolicy="no-referrer"
            onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/SOA_bg_game_room.png'; } else { this.src = '/grand_parlor_bg.svg'; }"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-[#08090e] via-[#08090e]/80 to-[#08090e]/60"></div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#08090e_90%)]"></div>
        </div>

        <!-- Scrollable Content Container -->
        <div class="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col justify-between space-y-6 animate-[fadeIn_0.25s_ease]">
          
          <!-- Header Area -->
          <div class="flex items-center justify-between border-b border-stone-800/80 pb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span class="text-xl">♘</span>
              </div>
              <div>
                <div class="text-[11px] font-mono uppercase tracking-wider">
                  <span class="text-amber-400 font-semibold">Room 2</span>
                  <span class="text-stone-500 mx-1">·</span>
                  <span class="text-stone-300">Enchanted Chess</span>
                </div>
                <h1 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold tracking-wide">
                  The Grand Parlor
                </h1>
              </div>
            </div>

            <button id="btn-parlor-intro-exit" class="px-3.5 py-2 rounded-xl border border-stone-800 hover:border-stone-700 bg-stone-900/60 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1.5">
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
                  src="/assets/SOA_bg_game_room.png" 
                  alt="The Grand Parlor"
                  class="w-full h-full object-cover object-center sm:object-[center_38%] filter saturate-[1.08] contrast-[1.04] transition-transform duration-700 ease-out hover:scale-[1.02]"
                  loading="eager"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="if (!this.dataset.tried) { this.dataset.tried = '1'; this.src = '/SOA_bg_game_room.png'; } else { this.src = '/grand_parlor_bg.svg'; }"
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
                      Welcome to the Grand Parlor!
                    </h2>
                    <p class="text-sm sm:text-base text-stone-100 font-medium leading-relaxed">
                      You are going to play enchanted chess. In each game, tap the piece to make your move. Sometimes, the chess piece moves because of your tap, other times your tap may get cancelled and it moves automatically.
                    </p>
                    <p class="text-xs sm:text-sm text-stone-300 leading-relaxed font-sans">
                      In each game, report how confident you are that you caused the move.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Allegiance Selection Section -->
            <div class="space-y-3">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 block font-semibold flex items-center space-x-2">
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Select Your Allegiance:</span>
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <!-- White Knight Option -->
                <div id="select-white-knight" 
                     role="button"
                     class="cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 ${this.selectedPiece === 'white_knight' ? 'border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]' : 'border-stone-800 hover:border-stone-700'} rounded-xl p-4 flex items-center space-x-4 transition-all">
                  <div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-400/40 flex items-center justify-center shrink-0">
                    ${this.renderPieceSvg('white_knight')}
                  </div>
                  <div>
                    <strong class="text-xs font-mono uppercase tracking-wider text-amber-200 block">White Knight</strong>
                    <span class="text-[11px] text-stone-400">Swift & Instinctive</span>
                    <span class="text-[10px] font-mono text-amber-400/80 block mt-1">Light Allegiance</span>
                  </div>
                </div>

                <!-- Black Rook Option -->
                <div id="select-black-rook" 
                     role="button"
                     class="cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 ${this.selectedPiece === 'black_rook' ? 'border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]' : 'border-stone-800 hover:border-stone-700'} rounded-xl p-4 flex items-center space-x-4 transition-all">
                  <div class="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center shrink-0">
                    ${this.renderPieceSvg('black_rook')}
                  </div>
                  <div>
                    <strong class="text-xs font-mono uppercase tracking-wider text-stone-200 block">Black Rook</strong>
                    <span class="text-[11px] text-stone-400">Firm & Unyielding</span>
                    <span class="text-[10px] font-mono text-cyan-400/80 block mt-1">Shadow Allegiance</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Footer Area -->
          <div class="pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button id="btn-parlor-return-dashboard" class="w-full sm:w-auto px-5 py-3 rounded-xl border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              ← Return to Dashboard
            </button>

            <button id="btn-parlor-step1-next" class="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-semibold text-xs sm:text-sm font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center justify-center space-x-3 cursor-pointer group">
              <span>Go to Interactive Tutorial</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="transition-transform group-hover:translate-x-1">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    const whiteCard = document.getElementById('select-white-knight');
    const blackCard = document.getElementById('select-black-rook');

    whiteCard?.addEventListener('click', () => {
      playTactileClick();
      this.selectedPiece = 'white_knight';
      whiteCard.className = 'cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)] rounded-xl p-4 flex items-center space-x-4 transition-all';
      if (blackCard) blackCard.className = 'cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 border-stone-800 hover:border-stone-700 rounded-xl p-4 flex items-center space-x-4 transition-all';
    });

    blackCard?.addEventListener('click', () => {
      playTactileClick();
      this.selectedPiece = 'black_rook';
      blackCard.className = 'cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)] rounded-xl p-4 flex items-center space-x-4 transition-all';
      if (whiteCard) whiteCard.className = 'cursor-pointer bg-[#0f121d]/90 backdrop-blur-sm border-2 border-stone-800 hover:border-stone-700 rounded-xl p-4 flex items-center space-x-4 transition-all';
    });

    document.getElementById('btn-parlor-intro-exit')?.addEventListener('click', () => {
      playTactileClick();
      this.abort();
    });

    document.getElementById('btn-parlor-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.abort();
    });

    document.getElementById('btn-parlor-step1-next')?.addEventListener('click', () => {
      playTactileClick();
      this.renderOnboardingStep2();
    });
  }

  /**
   * Step 2: Interactive Simulation Sandbox & Continuous Attribution Slider Practice
   */
  private renderOnboardingStep2(): void {
    let demoSquare = 0;
    let isDemoMoving = false;

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
        <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-xl shadow-2xl p-6 sm:p-8 space-y-5 relative overflow-hidden animate-[fadeIn_0.2s_ease]">
          
          <!-- Header -->
          <div class="flex items-center space-x-3 border-b border-stone-800 pb-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <span class="text-xl">⚔</span>
            </div>
            <div>
              <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                Instruction & Practice
              </div>
              <h2 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold">How It Plays</h2>
            </div>
          </div>

          <!-- Interactive Simulation Sandbox -->
          <div class="bg-[#08090e] border border-amber-500/20 rounded-xl p-3 sm:p-4 space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center space-x-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>Interactive Simulation Sandbox</span>
              </span>
              <span id="demo-status-pill" class="text-[10px] font-mono text-stone-400 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded">
                Tap piece to test
              </span>
            </div>

            <!-- Mini Checkered Board Sandbox -->
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4 py-1">
              <div id="demo-board" class="relative w-36 h-36 rounded-xl p-1.5 bg-[#0c0e14] border border-amber-500/30 shadow-lg shrink-0">
                <div class="grid grid-cols-2 grid-rows-2 w-full h-full rounded-lg overflow-hidden border border-stone-800">
                  <div class="bg-[#1f2637] border border-amber-500/10"></div>
                  <div class="bg-[#10141d] border border-amber-500/10"></div>
                  <div class="bg-[#10141d] border border-amber-500/10"></div>
                  <div class="bg-[#1f2637] border border-amber-500/10"></div>
                </div>

                <!-- Movable Demo Piece -->
                <div id="demo-piece" 
                     role="button"
                     class="absolute w-[calc(50%-6px)] h-[calc(50%-6px)] flex items-center justify-center cursor-pointer transition-all duration-200 ease-out z-20"
                     style="left: 6px; top: 6px;">
                  <div id="demo-piece-disc" class="w-12 h-12 rounded-full flex items-center justify-center shadow transition-transform active:scale-90">
                    ${this.renderPieceSvg(this.selectedPiece)}
                  </div>
                </div>
              </div>

              <!-- 3 Micro Steps Indicator -->
              <div class="flex flex-col space-y-2 w-full text-xs">
                <div id="demo-step-1" class="flex items-center space-x-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 transition-colors">
                  <span class="w-5 h-5 rounded-full bg-amber-500/30 text-amber-300 font-mono text-[10px] flex items-center justify-center font-bold">A</span>
                  <div>
                    <strong class="block text-[11px]">1. Tap Piece</strong>
                    <span class="text-[10px] text-stone-400">Initiate your intent</span>
                  </div>
                </div>
                <div id="demo-step-2" class="flex items-center space-x-2.5 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 transition-colors">
                  <span class="w-5 h-5 rounded-full bg-stone-800 text-stone-400 font-mono text-[10px] flex items-center justify-center font-bold">B</span>
                  <div>
                    <strong class="block text-[11px]">2. Delay & Movement</strong>
                    <span class="text-[10px] text-stone-400">Piece slides to next square with sound</span>
                  </div>
                </div>
                <div id="demo-step-3" class="flex items-center space-x-2.5 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 transition-colors">
                  <span class="w-5 h-5 rounded-full bg-stone-800 text-stone-400 font-mono text-[10px] flex items-center justify-center font-bold">C</span>
                  <div>
                    <strong class="block text-[11px]">3. Response Appears</strong>
                    <span class="text-[10px] text-stone-400">Rate your perceived causal control</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Interactive Slider Practice Container -->
          <div id="practice-slider-box" class="bg-[#08090e] border border-stone-800 rounded-xl p-4 space-y-2.5 transition-all">
            <div class="flex justify-between items-baseline">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Practice: How confident are you that you made the move?
              </span>
              <span id="tutorial-rating-num" class="text-sm font-mono text-amber-300 font-bold">60%</span>
            </div>

            <!-- Dynamic Slider Text feedback -->
            <div id="tutorial-rating-narrative" class="p-2.5 bg-[#0f121d] border border-stone-800 rounded-lg text-xs font-mono text-stone-300 min-h-[40px] flex items-center">
              You feel you mostly commanded the move with slight autonomous assistance.
            </div>

            <input type="range" 
                   id="tutorial-attribution-slider" 
                   min="0" 
                   max="100" 
                   value="60" 
                   class="agency-slider w-full cursor-pointer"/>

            <div class="flex justify-between text-[11px] font-mono text-stone-400">
              <span class="text-rose-400/90">0: Chamber's Magic</span>
              <span class="text-emerald-400/90">100: My Own Command</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-1">
            <button id="btn-parlor-step2-back" class="px-4 py-2.5 rounded-xl border border-stone-800 text-stone-400 hover:text-stone-200 text-xs font-mono uppercase tracking-wider transition-colors">
              Back
            </button>
            <button id="btn-enter-parlor-session" class="px-7 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.35)] flex items-center space-x-2">
              <span>Enter the Parlor</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    // Demo Interactive Board Handler
    const demoPiece = document.getElementById('demo-piece');
    const demoPieceDisc = document.getElementById('demo-piece-disc');
    const demoStatusPill = document.getElementById('demo-status-pill');
    const step1 = document.getElementById('demo-step-1');
    const step2 = document.getElementById('demo-step-2');
    const step3 = document.getElementById('demo-step-3');
    const sliderBox = document.getElementById('practice-slider-box');

    const updateDemoStepVisuals = (activeStep: 1 | 2 | 3) => {
      if (step1) {
        step1.className = activeStep === 1 
          ? 'flex items-center space-x-2.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-200 transition-colors' 
          : 'flex items-center space-x-2.5 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-500 transition-colors';
      }
      if (step2) {
        step2.className = activeStep === 2 
          ? 'flex items-center space-x-2.5 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-200 transition-colors' 
          : 'flex items-center space-x-2.5 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-500 transition-colors';
      }
      if (step3) {
        step3.className = activeStep === 3 
          ? 'flex items-center space-x-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 transition-colors' 
          : 'flex items-center space-x-2.5 p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-500 transition-colors';
      }
    };

    demoPiece?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (isDemoMoving) return;
      isDemoMoving = true;

      playTactileClick();
      if (demoPieceDisc) {
        demoPieceDisc.style.filter = 'drop-shadow(0 0 10px #f59e0b) brightness(1.2)';
      }
      if (demoStatusPill) {
        demoStatusPill.textContent = 'Guiding move...';
        demoStatusPill.className = 'text-[10px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded';
      }
      updateDemoStepVisuals(2);

      // Simulate 350ms delay, then animate piece to opposite square
      window.setTimeout(() => {
        const nextSquare = (demoSquare + 1) % 4;
        demoSquare = nextSquare;

        const isRight = demoSquare === 1 || demoSquare === 3;
        const isBottom = demoSquare === 2 || demoSquare === 3;
        const left = isRight ? 'calc(50% + 3px)' : '6px';
        const top = isBottom ? 'calc(50% + 3px)' : '6px';

        if (demoPiece) {
          demoPiece.style.left = left;
          demoPiece.style.top = top;
        }

        playChessPieceSound(0.5);

        // Highlight response step
        window.setTimeout(() => {
          updateDemoStepVisuals(3);
          if (demoStatusPill) {
            demoStatusPill.textContent = 'Move complete! Try slider below';
            demoStatusPill.className = 'text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded';
          }
          if (sliderBox) {
            sliderBox.classList.add('border-amber-400/50', 'shadow-[0_0_15px_rgba(245,158,11,0.2)]');
          }
          if (demoPieceDisc) {
            demoPieceDisc.style.filter = 'none';
          }
          isDemoMoving = false;
        }, 220);

      }, 350);
    });

    const slider = document.getElementById('tutorial-attribution-slider') as HTMLInputElement;
    const numEl = document.getElementById('tutorial-rating-num');
    const narrEl = document.getElementById('tutorial-rating-narrative');

    const updateNarrative = (val: number) => {
      if (numEl) numEl.textContent = `${val}%`;
      if (!narrEl) return;
      if (val <= 15) {
        narrEl.innerHTML = `<span class="text-rose-400 font-semibold">Chamber's Magic:</span> You feel completely confident the enchanted room moved the piece autonomously.`;
      } else if (val <= 40) {
        narrEl.innerHTML = `<span class="text-amber-300 font-semibold">Mostly Autonomous:</span> You feel your touch was delayed or superseded by the chamber.`;
      } else if (val <= 65) {
        narrEl.innerHTML = `<span class="text-stone-200 font-semibold">Mixed Attribution:</span> A balance of your physical impulse and autonomous magic.`;
      } else if (val <= 85) {
        narrEl.innerHTML = `<span class="text-emerald-400 font-semibold">Mostly Self:</span> You feel strong authorship over commanding the piece's move.`;
      } else {
        narrEl.innerHTML = `<span class="text-emerald-300 font-semibold">My Own Command:</span> Pure causal certainty—you directly commanded the move!`;
      }
    };

    slider?.addEventListener('input', () => {
      const val = parseInt(slider.value, 10);
      updateNarrative(val);
    });

    document.getElementById('btn-parlor-step2-back')?.addEventListener('click', () => {
      playTactileClick();
      this.renderOnboardingStep1();
    });

    document.getElementById('btn-enter-parlor-session')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playTactileClick();
      this.startSession();
    });
  }

  /* =========================================================================
     SESSION CONTROLLER & TASK ARENA
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
   * Renders the absolute pitch-black (#000000) trial viewport
   * No numbers, navigation chrome, or distractions
   */
  private renderArenaShell(): void {
    this.container.innerHTML = `
      <div id="parlor-arena" class="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-between select-none overflow-hidden touch-none p-4">
        
        <!-- Subtle top abort in extreme corner -->
        <div class="w-full flex justify-between items-center text-[10px] font-mono text-stone-800 pointer-events-auto">
          <span>THE GRAND PARLOR</span>
          <button id="parlor-abort-btn" class="px-2 py-1 text-stone-600 hover:text-stone-300 transition-colors cursor-pointer">ESC / EXIT</button>
        </div>

        <!-- Central Stage -->
        <div id="parlor-stage" class="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto relative">
          <!-- Populated by board or response slider -->
        </div>

        <!-- Subtle footer branding without trial numbers -->
        <div class="w-full flex justify-center items-center pb-2 text-[10px] font-mono text-stone-900">
          <span>ENCHANTED CHESS // SENSORIMOTOR INTEGRATION</span>
        </div>

      </div>
    `;

    const handleAbort = (e: Event) => {
      e.preventDefault();
      this.terminateToResults();
    };

    document.getElementById('parlor-abort-btn')?.addEventListener('pointerdown', handleAbort);
    document.getElementById('parlor-abort-btn')?.addEventListener('click', handleAbort);
  }

  /**
   * Runs a single trial
   */
  private runTrialSequence(index: number): void {
    if (!this.isRunning) return;

    // Halftime Break after exactly 55 trials
    if (index === 55 && !this.hasPassedHalftime) {
      this.hasPassedHalftime = true;
      this.renderHalftimeBreak();
      return;
    }

    if (index >= this.totalTrials) {
      this.renderCompletionScreen();
      return;
    }

    this.currentTrialIndex = index;
    const programmedDelay = this.trialSequence[index];

    const stage = document.getElementById('parlor-stage');
    if (!stage) return;

    // Pick a random starting square (0..3)
    this.currentSquare = Math.floor(Math.random() * 4);

    // Pick a destination square from the other 3 unoccupied squares
    const remaining = [0, 1, 2, 3].filter(s => s !== this.currentSquare);
    this.targetSquare = remaining[Math.floor(Math.random() * remaining.length)];

    // Render the 2x2 checkered board
    stage.innerHTML = `
      <div class="flex flex-col items-center space-y-6 w-full animate-[fadeIn_0.2s_ease]">
        
        <!-- Elegant Instruction Banner -->
        <div id="parlor-instruction-banner" class="text-xs font-mono uppercase tracking-wider text-amber-300/80 text-center h-5">
          Tap the piece to command your move
        </div>

        <!-- 2x2 Checkered Chessboard Container -->
        <div id="chessboard-container" class="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl p-2 bg-[#0c0e14] border-2 border-amber-500/30 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <div class="grid grid-cols-2 grid-rows-2 w-full h-full rounded-xl overflow-hidden border border-stone-800">
            <!-- Square 0 (Top-Left): Light -->
            <div id="square-0" class="bg-[#1f2637] border border-amber-500/10 flex items-center justify-center"></div>
            <!-- Square 1 (Top-Right): Dark -->
            <div id="square-1" class="bg-[#10141d] border border-amber-500/10 flex items-center justify-center"></div>
            <!-- Square 2 (Bottom-Left): Dark -->
            <div id="square-2" class="bg-[#10141d] border border-amber-500/10 flex items-center justify-center"></div>
            <!-- Square 3 (Bottom-Right): Light -->
            <div id="square-3" class="bg-[#1f2637] border border-amber-500/10 flex items-center justify-center"></div>
          </div>

          <!-- Dynamic Movable Piece Container -->
          <div id="movable-piece" 
               role="button"
               tabindex="0"
               class="absolute w-[calc(50%-8px)] h-[calc(50%-8px)] flex items-center justify-center cursor-pointer transition-transform duration-180 ease-out z-20 hw-accel"
               style="${this.getSquarePositionStyle(this.currentSquare)}">
            <div id="piece-avatar-disc" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90">
              ${this.renderPieceSvg(this.selectedPiece)}
            </div>
          </div>
        </div>

      </div>
    `;

    const pieceEl = document.getElementById('movable-piece');
    const discEl = document.getElementById('piece-avatar-disc');
    const bannerEl = document.getElementById('parlor-instruction-banner');

    this.isWaitingForPieceTap = true;

    // STRICT LAB RULE: Bind to pointerdown to eliminate 300ms tap delay
    const handlePieceTap = (e: PointerEvent) => {
      if (!this.isWaitingForPieceTap) return;
      this.isWaitingForPieceTap = false;
      pieceEl?.removeEventListener('pointerdown', handlePieceTap);

      this.actionTimestamp = performance.now();
      playTactileClick();

      // Immediate visual touch feedback
      if (discEl) {
        discEl.classList.add('scale-95');
        discEl.style.filter = 'drop-shadow(0 0 15px #f59e0b) brightness(1.2)';
      }
      if (bannerEl) {
        bannerEl.textContent = 'Guiding move...';
        bannerEl.className = 'text-xs font-mono uppercase tracking-wider text-cyan-400 text-center h-5';
      }

      // Schedule outcome animation after programmed delay
      const moveTimeout = window.setTimeout(() => {
        const measuredDelay = Math.round(performance.now() - this.actionTimestamp);
        this.animatePieceMove(this.targetSquare, programmedDelay, measuredDelay);
      }, programmedDelay);

      this.activeTimeouts.push(moveTimeout);
    };

    pieceEl?.addEventListener('pointerdown', handlePieceTap);
  }

  /**
   * Helper: Calculates percentage offset for 2x2 grid placement
   */
  private getSquarePositionStyle(squareIndex: number): string {
    // 0: top-left (left: 8px; top: 8px)
    // 1: top-right (left: 50%; top: 8px)
    // 2: bottom-left (left: 8px; top: 50%)
    // 3: bottom-right (left: 50%; top: 50%)
    const isRight = squareIndex === 1 || squareIndex === 3;
    const isBottom = squareIndex === 2 || squareIndex === 3;

    const left = isRight ? 'calc(50% + 4px)' : '8px';
    const top = isBottom ? 'calc(50% + 4px)' : '8px';

    return `left: ${left}; top: ${top};`;
  }

  /**
   * Animates piece to destination square and plays wooden placement sound
   */
  private animatePieceMove(destSquare: number, programmedDelay: number, measuredDelay: number): void {
    const pieceEl = document.getElementById('movable-piece');
    if (!pieceEl) return;

    // Update style to destination position
    const isRight = destSquare === 1 || destSquare === 3;
    const isBottom = destSquare === 2 || destSquare === 3;
    const left = isRight ? 'calc(50% + 4px)' : '8px';
    const top = isBottom ? 'calc(50% + 4px)' : '8px';

    pieceEl.style.left = left;
    pieceEl.style.top = top;

    // Play synthesized wooden piece placement sound
    playChessPieceSound(0.55);

    // Transition to Response Slider after 240ms movement settle
    const settleTimeout = window.setTimeout(() => {
      this.renderResponseScreen(destSquare, programmedDelay, measuredDelay);
    }, 240);

    this.activeTimeouts.push(settleTimeout);
  }

  /**
   * Response Screen: Continuous Attribution Slider
   * Psychometric requirement: Initialize thumb at pseudo-random value between 0 and 100 on every trial!
   */
  private renderResponseScreen(destSquare: number, programmedDelay: number, measuredDelay: number): void {
    const stage = document.getElementById('parlor-stage');
    if (!stage) return;

    this.responsePromptTimestamp = performance.now();

    // Randomize initial position between 5 and 95 to prevent anchor bias
    this.sliderInitialRandomPos = Math.floor(5 + Math.random() * 90);

    stage.innerHTML = `
      <div class="w-full max-w-sm px-4 flex flex-col space-y-6 animate-[fadeIn_0.2s_ease]">
        
        <div class="text-center space-y-1">
          <span class="text-xs font-mono uppercase tracking-wider text-amber-400">Your Impression</span>
          <h3 class="text-base sm:text-lg font-arcane text-stone-100 font-semibold">
            How confident are you that you made the move?
          </h3>
        </div>

        <!-- Slider Section -->
        <div class="space-y-4 bg-[#0c0e14] border border-amber-500/20 rounded-2xl p-5 shadow-xl">
          <div class="flex justify-between items-baseline">
            <span class="text-xs font-mono uppercase text-stone-400">Attribution</span>
            <span id="response-rating-readout" class="text-xl font-mono-num font-bold text-amber-300">
              ${this.sliderInitialRandomPos}%
            </span>
          </div>

          <input type="range" 
                 id="attribution-slider" 
                 class="agency-slider w-full cursor-pointer" 
                 min="0" 
                 max="100" 
                 value="${this.sliderInitialRandomPos}" 
                 step="1"/>

          <div class="flex justify-between text-[11px] font-mono text-stone-400 pt-1">
            <span class="text-rose-400">Chamber's Magic</span>
            <span class="text-emerald-400">My Own Command</span>
          </div>
        </div>

        <!-- Confirm Button -->
        <button id="btn-confirm-response" 
                class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2">
          <span>Confirm Response</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>

      </div>
    `;

    const slider = document.getElementById('attribution-slider') as HTMLInputElement;
    const readout = document.getElementById('response-rating-readout');
    const confirmBtn = document.getElementById('btn-confirm-response');

    slider?.addEventListener('input', () => {
      if (readout) readout.textContent = `${slider.value}%`;
    });

    confirmBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playTactileClick();

      const responseTime = Math.round(performance.now() - this.responsePromptTimestamp);
      const finalRating = parseInt(slider.value, 10);

      // Log trial record
      const trialRecord: GrandParlorTrialLog = {
        trial_index: this.currentTrialIndex + 1,
        user_id: this.profile.id,
        chamber: 'Room_2_Grand_Parlor',
        assigned_piece: this.selectedPiece,
        origin_square: this.currentSquare,
        destination_square: destSquare,
        programmed_delay_ms: programmedDelay,
        measured_delay_ms: measuredDelay,
        attribution_rating: finalRating,
        slider_initial_random_pos: this.sliderInitialRandomPos,
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      };

      this.trialLogs.push(trialRecord);

      // Local storage history
      recordGrandParlorTrialLog(trialRecord);

      // Normalized Production Schema Buffering (trials_soa)
      const soaPayload: SOATrialPayload = {
        auth_user_id: this.profile.auth_user_id || this.profile.id,
        subject_id: this.profile.subject_id,
        task: 'SOA',
        session: this.sessionId,
        trial_number: trialRecord.trial_index,
        response: finalRating <= 50 ? 1 : 5,
        confidence: Math.round(Math.abs(finalRating - 50) * 2),
        delay: Number(programmedDelay),
        recorded_at: trialRecord.timestamp
      };
      bufferNormalizedTrialLocally('trials_soa', soaPayload, this.sessionId);

      // Settle and advance
      const nextTimeout = window.setTimeout(() => {
        this.runTrialSequence(this.currentTrialIndex + 1);
      }, 160);

      this.activeTimeouts.push(nextTimeout);
    });
  }

  /* =========================================================================
     MID-SESSION REST & COMPLETION
     ========================================================================= */

  /**
   * Halftime Rest after exactly 55 trials (no numbers on screen)
   */
  private renderHalftimeBreak(): void {
    playRuneHum(160, 400);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] flex items-center justify-center p-4 sm:p-6 overflow-y-auto select-none">
        <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 sm:p-8 space-y-6 text-center animate-[fadeIn_0.3s_ease]">
          
          <div class="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
            <span class="text-2xl">⏳</span>
          </div>

          <div>
            <div class="text-[11px] font-mono uppercase tracking-wider text-amber-400 mb-1">
              The Grand Parlor
            </div>
            <h2 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold">
              Parlor Half-Time
            </h2>
          </div>

          <p class="text-xs sm:text-sm text-stone-300 leading-relaxed">
            Rest your senses. Take a deep breath as the living chessboard pauses its enchantments.
          </p>

          <div class="pt-2">
            <button id="btn-resume-parlor" class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2">
              <span>Resume Play</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
          </div>

        </div>
      </div>
    `;

    const resumeBtn = document.getElementById('btn-resume-parlor');
    if (resumeBtn) {
      const handleResume = (e: Event) => {
        e.preventDefault();
        playTactileClick();
        this.renderArenaShell();
        this.runTrialSequence(55); // advances to trial 56 (0-indexed 55)
      };
      resumeBtn.addEventListener('pointerdown', handleResume);
      resumeBtn.addEventListener('click', handleResume);
    }
  }

  /**
   * Completion Screen
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

    const ratings = trials.map(t => t.attribution_rating).filter(r => typeof r === 'number' && !isNaN(r));
    const meanAttr = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    const rts = trials.map(t => t.response_time_ms).filter(r => typeof r === 'number' && !isNaN(r));
    const meanRt = rts.length > 0 ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;

    // Gamified mastery score
    const masteryScore = total > 0 
      ? Math.min(100, Math.max(50, Math.round((meanAttr ?? 50) * 0.5 + (100 - (meanRt ?? 500) / 30) * 0.5)))
      : 50;

    recordSessionCompletion('room-2', masteryScore);

    // Flush all buffered trials from this chamber session in batch to Supabase (even 1 trial)
    flushChamberSession(this.sessionId, 'room-2').catch(() => {});

    const sessionResult: GrandParlorSessionResult = {
      roomId: 'room-2',
      roomName: 'The Grand Parlor',
      totalTrials: total,
      meanAttribution: meanAttr ?? 50,
      meanResponseTimeMs: meanRt ?? 0,
      assignedPiece: this.selectedPiece,
      trials: this.trialLogs,
      completedAt: new Date().toISOString()
    };

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#08090e] p-4 sm:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto select-none">
        
        <div class="max-w-4xl mx-auto w-full space-y-6 flex-1 animate-[fadeIn_0.3s_ease]">
          
          <!-- Header -->
          <div class="border-b border-stone-800 pb-4">
            <div class="text-xs font-mono uppercase tracking-wider text-yellow-400 mb-1 font-semibold">
              Room 2: The Grand Parlor
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-white font-semibold">
              Sense of Agency Window
            </h1>
            <p class="text-xs sm:text-sm text-emerald-400 font-sans mt-1">
              Splendidly played, Initiate! Your intent has harmonized with the chamber's wards. Return tomorrow to continue your mastery.
            </p>
          </div>

          <!-- Summary Metric Cards (2 boxes: Average Self Attribution & Average Decision Speed) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

            <div class="bg-[#0f121d] border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">Average Self Attribution</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-emerald-300 font-mono-num">
                  ${meanAttr !== null ? `${meanAttr}%` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Sense of Agency</span>
            </div>

            <div class="bg-[#0f121d] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
              <span class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Average Decision Speed</span>
              <div class="my-2">
                <span class="text-3xl font-mono font-bold text-cyan-300 font-mono-num">
                  ${meanRt !== null ? `${meanRt}<span class="text-xs font-mono text-stone-400 ml-1">ms</span>` : '<span class="text-sm text-amber-300 font-sans font-normal">Not enough trials</span>'}
                </span>
              </div>
              <span class="text-[10px] font-mono text-stone-500">Response Speed</span>
            </div>

          </div>

          <!-- Attribution Decay Curve (Agency vs Action-Outcome Delay) -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-5 space-y-3">
            <div class="flex justify-between items-center border-b border-stone-800/80 pb-2">
              <span class="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Agency Across Delay Intervals (Sensorimotor Window)
              </span>
              <span class="text-[11px] font-mono text-stone-500">0ms to 1400ms Delays</span>
            </div>

            <!-- Mini Bar Chart of Average Attribution across 11 delay levels -->
            ${total === 0 ? `
              <div class="h-24 flex items-center justify-center text-xs font-mono text-stone-400">
                Not enough trials to display agency curve
              </div>
            ` : `
              <div class="grid grid-cols-11 gap-1.5 h-24 items-end pt-4 px-2">
                ${this.delayLevels.map(del => {
                  const delTrials = trials.filter(t => t.programmed_delay_ms === del);
                  const avg = delTrials.length > 0 
                    ? Math.round(delTrials.map(t => t.attribution_rating).reduce((a, b) => a + b, 0) / delTrials.length)
                    : null;
                  return `
                    <div class="flex flex-col items-center h-full justify-end group relative">
                      <div class="w-full ${avg !== null ? 'bg-amber-500/80 hover:bg-amber-400' : 'bg-stone-800'} rounded-t transition-all" style="height: ${avg !== null ? Math.max(6, avg) : 4}%"></div>
                      <span class="text-[8px] font-mono text-stone-500 mt-1 truncate">${del}ms</span>
                    </div>
                  `;
                }).join('')}
              </div>
            `}

            <div class="flex justify-between text-[10px] font-mono text-stone-500 pt-1">
              <span>Instant (0ms)</span>
              <span>Delay Interval</span>
              <span>Extended (1400ms)</span>
            </div>
          </div>

          <!-- Ethereal Chamber Seals Inscribed Status -->
          <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs font-mono">
            <div class="text-stone-300 flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span><strong class="text-emerald-400">Session recorded</strong> · Session <code class="text-amber-300">${this.sessionId}</code> synchronized.</span>
            </div>
            <div class="text-stone-500 text-[11px]">
              ${total} Encounters Inscribed
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
            <button id="btn-parlor-replay" class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
              Replay
            </button>
            <button id="btn-parlor-return-dashboard" class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
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

    document.getElementById('btn-parlor-replay')?.addEventListener('click', () => {
      playTactileClick();
      this.start();
    });

    document.getElementById('btn-parlor-return-dashboard')?.addEventListener('click', () => {
      playTactileClick();
      this.callbacks.onComplete(sessionResult);
    });
  }

  /**
   * Helper: Renders elegant SVG glyph for the chosen piece
   */
  private renderPieceSvg(piece: ChessPieceAllegiance): string {
    if (piece === 'white_knight') {
      return `
        <svg width="44" height="44" viewBox="0 0 45 45" fill="none" stroke="#fef08a" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_8px_rgba(254,240,138,0.4)]">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fffbeb"/>
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 3-6 2.1-2.6 4.38-4.47 5-7 .38-1.55 1.04-3.5 1.5-5 .5 1.5 2 3.5 3.5 5z" fill="#fef3c7"/>
          <circle cx="27" cy="14" r="1.5" fill="#1e293b"/>
        </svg>
      `;
    }

    // Black Rook
    return `
      <svg width="44" height="44" viewBox="0 0 45 45" fill="none" stroke="#e2e8f0" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="drop-shadow-[0_0_8px_rgba(56,189,248,0.3)]">
        <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" fill="#1e2230"/>
        <path d="M34 14l-3 3H14l-3-3" fill="#1e2230"/>
        <path d="M14 17v12h17V17H14z" fill="#0f121d"/>
        <circle cx="22.5" cy="23" r="3.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1"/>
      </svg>
    `;
  }
}

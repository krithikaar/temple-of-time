/**
 * TEMPLE of Time - Room 1: The Grand Parlor
 * Psychophysics Paradigm: Haggard Sense of Agency & Intentional Binding
 * Full-screen sensory deprivation arena (#000000), sub-millisecond logging, pointerdown bindings.
 */

import { PsychophysicsTrial, ParticipantProfile, SessionResult } from '../types';
import { playCrystalTone, playTactileClick, playRuneHum } from '../audio';
import { recordTrial, recordSessionCompletion, saveLatestSession } from '../store';

export interface TaskCallbacks {
  onComplete: (session: SessionResult) => void;
  onExit: () => void;
}

export class AgencyTaskRunner {
  private container: HTMLElement;
  private profile: ParticipantProfile;
  private callbacks: TaskCallbacks;

  private currentTrialIndex = 0;
  private totalTrials = 6;
  // Shuffled delay intervals in milliseconds (100ms - 850ms)
  private delays = [150, 400, 250, 850, 600, 200];
  private trialData: PsychophysicsTrial[] = [];

  // Precision timing markers
  private stimulusOnsetTime = 0;
  private responseTime = 0;
  private audioDispatchTime = 0;
  private currentDelay = 0;

  private activePhase: 'fixation' | 'primed' | 'waiting_tone' | 'rating' = 'fixation';
  private abortController: AbortController | null = null;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement, profile: ParticipantProfile, callbacks: TaskCallbacks) {
    this.container = container;
    this.profile = profile;
    this.callbacks = callbacks;
    // Shuffle delays with Fisher-Yates
    this.delays = this.shuffleArray([...this.delays]);
  }

  private shuffleArray(arr: number[]): number[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  public start(): void {
    this.currentTrialIndex = 0;
    this.trialData = [];
    this.renderArenaContainer();
    this.startTrial(this.currentTrialIndex);
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.callbacks.onExit();
  }

  /**
   * Sets up pure black sensory deprivation viewport (#000000)
   * Strictly no UI chrome, status indicators, or extraneous navigation
   */
  private renderArenaContainer(): void {
    this.container.innerHTML = `
      <div id="arena-viewport" class="fixed inset-0 z-50 bg-[#000000] flex flex-col items-center justify-between select-none overflow-hidden p-4">
        <!-- Minimal subtle abort affordance in extreme corner -->
        <div class="w-full flex justify-between items-center text-xs text-stone-800 font-mono">
          <span>CHAMBER I // SENSE OF AGENCY</span>
          <button id="arena-abort-btn" class="px-2 py-1 text-stone-700 hover:text-stone-400 transition-colors">ESC / EXIT</button>
        </div>

        <!-- Central Psychophysics Stimulus Stage -->
        <div id="stimulus-stage" class="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto">
          <!-- Dynamically populated by trial phases -->
        </div>

        <!-- Minimal subtext telemetry / trial tracker -->
        <div id="arena-footer" class="w-full flex justify-center items-center pb-4 text-xs font-mono text-stone-800">
          <span id="trial-counter-label">TRIAL ${this.currentTrialIndex + 1} / ${this.totalTrials}</span>
        </div>
      </div>
    `;

    const abortBtn = document.getElementById('arena-abort-btn');
    if (abortBtn) {
      abortBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.abort();
      });
    }
  }

  /**
   * Phase 1: Fixation Cross (Variable ITI 1200ms - 2000ms)
   */
  private startTrial(index: number): void {
    this.currentTrialIndex = index;
    this.currentDelay = this.delays[index % this.delays.length];
    this.activePhase = 'fixation';

    const stage = document.getElementById('stimulus-stage');
    const counterLabel = document.getElementById('trial-counter-label');
    if (counterLabel) {
      counterLabel.textContent = `TRIAL ${index + 1} / ${this.totalTrials}`;
    }

    if (!stage) return;

    // Minimalist fixation cross
    stage.innerHTML = `
      <div class="flex flex-col items-center justify-center hw-accel transition-opacity duration-300">
        <svg width="40" height="40" viewBox="0 0 40 40" class="text-stone-700">
          <line x1="20" y1="10" x2="20" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `;

    // Random inter-trial interval (ITI) jitter to prevent rhythmic anticipation
    const itiDuration = 1200 + Math.random() * 800;

    setTimeout(() => {
      if (this.activePhase === 'fixation') {
        this.transitionToPrimedSigil();
      }
    }, itiDuration);
  }

  /**
   * Phase 2: Primed Arcane Sigil (Awaiting spontaneous voluntary touch)
   */
  private transitionToPrimedSigil(): void {
    this.activePhase = 'primed';
    const stage = document.getElementById('stimulus-stage');
    if (!stage) return;

    // Render illuminated Arcane Sigil
    stage.innerHTML = `
      <div class="flex flex-col items-center justify-center space-y-8 w-full max-w-xs text-center">
        <div id="arcane-sigil-target" 
             role="button"
             tabindex="0"
             aria-label="Arcane Sigil"
             class="relative w-40 h-40 rounded-full flex items-center justify-center cursor-pointer hw-accel active:scale-95 transition-transform duration-100 touch-none">
          
          <!-- Outer Celestial Astrolabe Ring -->
          <svg class="absolute inset-0 w-full h-full text-amber-500/30 animate-[spin_20s_linear_infinite]" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 6"/>
            <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" stroke-width="0.75"/>
          </svg>

          <!-- Core Glowing Sigil Disc -->
          <div class="w-28 h-28 rounded-full bg-gradient-to-br from-amber-600/30 via-amber-950/40 to-black border border-amber-500/60 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.25)]">
            <!-- Ancient Chronos Rune Glyph -->
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 6v6l4 2"/>
              <circle cx="12" cy="12" r="2" fill="#f59e0b"/>
            </svg>
          </div>
        </div>

        <p class="text-stone-500 text-xs tracking-wider uppercase font-mono">
          Touch the sigil at your own impulse
        </p>
      </div>
    `;

    // Timestamp when the sigil visually became active
    this.stimulusOnsetTime = performance.now();
    playRuneHum(130, 200);

    const sigil = document.getElementById('arcane-sigil-target');
    if (sigil) {
      // STRICT LAB CONSTRAINT: Bind strictly to pointerdown to eliminate mobile 300ms tap delay
      sigil.addEventListener('pointerdown', this.handleSigilTouch, { once: true });
    }
  }

  /**
   * Pointerdown touch handler with sub-millisecond performance.now() logging
   */
  private handleSigilTouch = (e: PointerEvent): void => {
    e.preventDefault();
    this.responseTime = performance.now();
    const reactionTime = this.responseTime - this.stimulusOnsetTime;

    // Instant tactile haptic/audio click
    playTactileClick();

    // Visual feedback on the sigil
    const sigil = document.getElementById('arcane-sigil-target');
    if (sigil) {
      sigil.classList.add('scale-110');
      sigil.style.filter = 'brightness(1.8) drop-shadow(0 0 25px #f59e0b)';
    }

    this.activePhase = 'waiting_tone';

    // Precision scheduled tone dispatch
    const targetToneTime = this.responseTime + this.currentDelay;

    const checkToneLoop = () => {
      const now = performance.now();
      if (now >= targetToneTime) {
        this.audioDispatchTime = now;
        // Synthesize crystal bell tone
        playCrystalTone(520, 220, 0.4);
        
        // Transition to rating prompt after a short perceptual integration window (450ms)
        setTimeout(() => {
          this.transitionToRatingPrompt(reactionTime);
        }, 450);
      } else {
        this.animationFrameId = requestAnimationFrame(checkToneLoop);
      }
    };

    this.animationFrameId = requestAnimationFrame(checkToneLoop);
  };

  /**
   * Phase 4: Continuous Agency Rating Slider & Delay Judgment
   */
  private transitionToRatingPrompt(reactionTime: number): void {
    this.activePhase = 'rating';
    const stage = document.getElementById('stimulus-stage');
    if (!stage) return;

    const actualMeasuredDelay = Math.round(this.audioDispatchTime - this.responseTime);

    stage.innerHTML = `
      <div class="w-full max-w-sm px-4 flex flex-col space-y-6 hw-accel animate-[fadeIn_0.3s_ease]">
        
        <!-- Agency Rating Slider Section -->
        <div class="space-y-3">
          <div class="flex justify-between items-baseline">
            <label class="text-xs uppercase tracking-wider text-amber-400 font-mono">Sense of Authorship</label>
            <span id="agency-val-readout" class="text-lg font-mono-num font-bold text-amber-300">50%</span>
          </div>
          <p class="text-[11px] text-stone-400">Did your spontaneous action directly cause the tone to chime?</p>
          
          <input type="range" 
                 id="agency-slider" 
                 class="agency-slider" 
                 min="0" 
                 max="100" 
                 value="50" 
                 step="1"/>
          
          <div class="flex justify-between text-[10px] font-mono text-stone-500 uppercase">
            <span>0% (Accidental / External)</span>
            <span>100% (Direct Agency)</span>
          </div>
        </div>

        <!-- Perceived Delay Interval Estimation -->
        <div class="space-y-3 pt-2 border-t border-stone-800">
          <div class="flex justify-between items-baseline">
            <label class="text-xs uppercase tracking-wider text-cyan-400 font-mono">Estimated Delay</label>
            <span id="delay-val-readout" class="text-lg font-mono-num font-bold text-cyan-300">350 ms</span>
          </div>
          <p class="text-[11px] text-stone-400">Estimate the physical latency between touch and acoustic chime:</p>
          
          <input type="range" 
                 id="delay-slider" 
                 class="agency-slider" 
                 min="50" 
                 max="1000" 
                 value="350" 
                 step="25"/>
          
          <div class="flex justify-between text-[10px] font-mono text-stone-500 uppercase">
            <span>50 ms (Instant)</span>
            <span>1000 ms (Extended)</span>
          </div>
        </div>

        <!-- Confirm Button with strict pointerdown -->
        <div class="pt-2">
          <button id="confirm-judgment-btn" 
                  class="w-full h-12 bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 border border-amber-500/50 rounded-xl text-amber-200 font-mono text-sm tracking-wider uppercase transition-colors flex items-center justify-center">
            Log Judgment & Proceed
          </button>
        </div>
      </div>
    `;

    const agencySlider = document.getElementById('agency-slider') as HTMLInputElement;
    const agencyVal = document.getElementById('agency-val-readout');
    const delaySlider = document.getElementById('delay-slider') as HTMLInputElement;
    const delayVal = document.getElementById('delay-val-readout');
    const confirmBtn = document.getElementById('confirm-judgment-btn');

    if (agencySlider && agencyVal) {
      agencySlider.addEventListener('input', () => {
        agencyVal.textContent = `${agencySlider.value}%`;
      });
    }

    if (delaySlider && delayVal) {
      delaySlider.addEventListener('input', () => {
        delayVal.textContent = `${delaySlider.value} ms`;
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        playTactileClick();

        const finalAgency = parseInt(agencySlider?.value || '50', 10);
        const estimatedDelay = parseInt(delaySlider?.value || '350', 10);
        const bindingDelta = actualMeasuredDelay - estimatedDelay;

        // Accuracy score based on psychophysical intentional binding calibration:
        // High agency for short delay (<300ms) or accurate estimation scores points
        let score = 70;
        if (actualMeasuredDelay <= 250 && finalAgency >= 70) score = 95;
        else if (actualMeasuredDelay >= 600 && finalAgency <= 55) score = 90;
        else score = Math.max(30, 100 - Math.abs(bindingDelta) / 8);

        const trialRecord: PsychophysicsTrial = {
          id: crypto.randomUUID ? crypto.randomUUID() : `trial_${Date.now()}_${this.currentTrialIndex}`,
          user_id: this.profile.id,
          room_id: 'room-1',
          trial_index: this.currentTrialIndex + 1,
          stimulus_parameters: {
            programmed_delay_ms: this.currentDelay,
            tone_frequency_hz: 520,
            iti_duration_ms: Math.round(this.stimulusOnsetTime)
          },
          timing_data: {
            stimulus_onset_perf: this.stimulusOnsetTime,
            response_perf: this.responseTime,
            reaction_time_ms: Math.round(reactionTime),
            audio_dispatch_perf: this.audioDispatchTime,
            actual_measured_delay_ms: actualMeasuredDelay
          },
          user_response: {
            agency_rating: finalAgency,
            estimated_delay_ms: estimatedDelay,
            binding_delta_ms: bindingDelta
          },
          accuracy_or_score: Math.round(score),
          created_at: new Date().toISOString()
        };

        this.trialData.push(trialRecord);
        recordTrial(trialRecord);

        // Advance to next trial or finish session
        if (this.currentTrialIndex + 1 < this.totalTrials) {
          this.startTrial(this.currentTrialIndex + 1);
        } else {
          this.finishSession();
        }
      });
    }
  }

  /**
   * Session Complete: Aggregates metrics & transitions to Post-Task Feedback
   */
  private finishSession(): void {
    const trials = this.trialData;
    const scores = trials.map(t => t.accuracy_or_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const rts = trials.map(t => t.timing_data.reaction_time_ms);
    const meanRt = rts.reduce((a, b) => a + b, 0) / rts.length;

    // Intentional binding analysis: Agency under short (<300ms) vs long (>=400ms) delays
    const shortTrials = trials.filter(t => t.stimulus_parameters.programmed_delay_ms <= 300);
    const longTrials = trials.filter(t => t.stimulus_parameters.programmed_delay_ms > 300);

    const meanAgencyShort = shortTrials.length > 0
      ? shortTrials.map(t => t.user_response.agency_rating).reduce((a, b) => a + b, 0) / shortTrials.length
      : 50;

    const meanAgencyLong = longTrials.length > 0
      ? longTrials.map(t => t.user_response.agency_rating).reduce((a, b) => a + b, 0) / longTrials.length
      : 50;

    // Binding effect magnitude (higher agency for shorter delays indicates robust intentional binding)
    const bindingEffect = meanAgencyShort - meanAgencyLong;

    const sessionResult: SessionResult = {
      roomId: 'room-1',
      roomName: 'The Grand Parlor',
      trials: this.trialData,
      masteryScore: Math.round(avgScore),
      meanReactionTimeMs: Math.round(meanRt),
      meanAgencyShortDelay: Math.round(meanAgencyShort),
      meanAgencyLongDelay: Math.round(meanAgencyLong),
      bindingEffectMagnitude: Math.round(bindingEffect),
      completedAt: new Date().toISOString()
    };

    saveLatestSession(sessionResult);
    recordSessionCompletion('room-1', sessionResult.masteryScore);

    this.callbacks.onComplete(sessionResult);
  }
}

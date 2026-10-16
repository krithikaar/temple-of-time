/**
 * TEMPLE of Time - Pre-Task Chamber Briefing Modal
 * Reusable briefing modal with animated tutorial preview and experimental blueprint display.
 */

import { ChamberDefinition } from '../types';
import { playTactileClick } from '../audio';

export function openBriefingModal(chamber: ChamberDefinition, onEnterChamber: (chamber: ChamberDefinition) => void): void {
  const existing = document.getElementById('chamber-briefing-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'chamber-briefing-modal';
  modal.className = 'fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none';

  const isActive = chamber.status === 'active';

  modal.innerHTML = `
    <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease]">
      
      <!-- Header -->
      <div class="p-6 border-b border-stone-800 bg-[#0a0d16] flex justify-between items-start">
        <div>
          <div class="text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
            <span>CHAMBER ${chamber.number}</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-arcane text-stone-100 font-semibold uppercase tracking-wide">${chamber.name}</h2>
          <p class="text-xs text-amber-500 font-mono mt-0.5">${chamber.subtitle}</p>
        </div>
        <button id="briefing-close-btn" class="p-1.5 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Scrollable Briefing Content -->
      <div class="p-6 overflow-y-auto space-y-6 text-sm">
        
        <!-- Looping Demonstration Preview Container -->
        <div class="bg-[#06070a] border border-stone-800 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden h-44">
          ${renderDemonstrationPreview(chamber)}
        </div>

        <!-- Narrative Lore -->
        <div class="space-y-2">
          <h3 class="text-xs font-mono uppercase tracking-wider text-amber-300/90">Chamber Mandate</h3>
          <p class="text-stone-300 text-xs sm:text-sm leading-relaxed">${chamber.description}</p>
        </div>

        <!-- Instructions -->
        <div class="space-y-2">
          <h3 class="text-xs font-mono uppercase tracking-wider text-cyan-400">Interaction Guide</h3>
          <ul class="space-y-1.5">
            ${chamber.instructions.map((inst, i) => `
              <li class="flex items-start text-xs text-stone-300">
                <span class="text-amber-500 font-mono mr-2">${i + 1}.</span>
                <span>${inst}</span>
              </li>
            `).join('')}
          </ul>
        </div>

      </div>

      <!-- Action Footer -->
      <div class="p-4 sm:p-6 border-t border-stone-800 bg-[#0a0d16] flex justify-end space-x-3">
        <button id="briefing-cancel-btn" class="px-4 py-2.5 rounded-xl border border-stone-700 text-stone-300 hover:text-stone-100 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
          Return
        </button>
        <button id="briefing-enter-btn" class="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center space-x-2 cursor-pointer">
          <span>Enter Chamber</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    playTactileClick();
    modal.remove();
  };

  document.getElementById('briefing-close-btn')?.addEventListener('click', close);
  document.getElementById('briefing-cancel-btn')?.addEventListener('click', close);

  const enterBtn = document.getElementById('briefing-enter-btn');
  if (enterBtn && isActive) {
    enterBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      playTactileClick();
      modal.remove();
      onEnterChamber(chamber);
    });
  }
}

/**
 * Creates CSS/SVG looping preview animation of the trial mechanism
 */
function renderDemonstrationPreview(chamber: ChamberDefinition): string {
  if (chamber.id === 'room-1') {
    return `
      <!-- Animated Audiovisual Binding Preview -->
      <div class="relative w-full h-full flex items-center justify-around px-4">
        <!-- Visual Stimulus: Lightning -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-full border border-white/40 bg-white/10 flex items-center justify-center animate-[pulse_1.5s_infinite]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span class="text-[10px] font-mono text-stone-300">Light (44ms)</span>
        </div>

        <!-- Latency SOA Arrow -->
        <div class="flex flex-col items-center space-y-1">
          <span class="text-[9px] font-mono text-amber-400 font-mono-num">Temporal Offset</span>
          <svg width="40" height="12" viewBox="0 0 40 12" class="text-stone-600">
            <line x1="0" y1="6" x2="35" y2="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
            <polyline points="32 2 38 6 32 10" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="text-[8px] font-mono text-stone-500">Variable Delay</span>
        </div>

        <!-- Auditory Stimulus: Thunder -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-full border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center animate-[bounce_1.5s_infinite]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
          </div>
          <span class="text-[10px] font-mono text-cyan-300">1000Hz (44ms)</span>
        </div>

        <!-- Response Dial Indicator -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 36 36" class="text-emerald-400">
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
              <line x1="18" y1="18" x2="18" y2="2" stroke="currentColor" stroke-width="2"/>
              <line x1="18" y1="18" x2="4.14" y2="26" stroke="currentColor" stroke-width="2"/>
              <line x1="18" y1="18" x2="31.86" y2="26" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <span class="text-[10px] font-mono text-emerald-300">Response</span>
        </div>
      </div>
    `;
  }

  if (chamber.id === 'room-2') {
    return `
      <!-- Animated Enchanted Chess Preview -->
      <div class="relative w-full h-full flex items-center justify-around px-4">
        <!-- Step A: Tap piece -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center animate-[pulse_1.5s_infinite]">
            <span class="text-2xl">♘</span>
          </div>
          <span class="text-[10px] font-mono text-stone-300">1. Tap Piece</span>
        </div>

        <!-- Latency / Delay Arrow -->
        <div class="flex flex-col items-center space-y-1">
          <span class="text-[9px] font-mono text-cyan-400 font-mono-num">Delay (0-1400ms)</span>
          <svg width="40" height="12" viewBox="0 0 40 12" class="text-stone-600">
            <line x1="0" y1="6" x2="35" y2="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
            <polyline points="32 2 38 6 32 10" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="text-[8px] font-mono text-stone-500">Autonomous vs Self</span>
        </div>

        <!-- Step B: Move Piece -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-xl border border-stone-700 bg-stone-900 flex items-center justify-center animate-[bounce_1.5s_infinite]">
            <span class="text-xl text-stone-200">♜</span>
          </div>
          <span class="text-[10px] font-mono text-stone-300">2. Piece Moves</span>
        </div>

        <!-- Step C: Attribution Slider -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-16 h-4 bg-stone-800 rounded-full overflow-hidden p-0.5 border border-amber-500/30">
            <div class="h-full bg-gradient-to-r from-rose-500 to-emerald-400 rounded-full w-3/4"></div>
          </div>
          <span class="text-[10px] font-mono text-amber-300">3. Impression</span>
        </div>
      </div>
    `;
  }

  if (chamber.id === 'room-3') {
    return `
      <!-- Animated Aviary Feeding Ritual Preview -->
      <div class="relative w-full h-full flex items-center justify-around px-4">
        <!-- Step 1: Free Cadence -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center animate-[pulse_1.2s_infinite]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="text-amber-400">
              <path d="M12 2C9 7 5 12 12 22C19 12 15 7 12 2Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/>
            </svg>
          </div>
          <span class="text-[10px] font-mono text-stone-300">Phase 1: Natural Cadence</span>
        </div>

        <!-- Arrow -->
        <div class="flex flex-col items-center space-y-1">
          <span class="text-[9px] font-mono text-cyan-400 font-mono-num">Ritual Transition</span>
          <svg width="40" height="12" viewBox="0 0 40 12" class="text-stone-600">
            <line x1="0" y1="6" x2="35" y2="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
            <polyline points="32 2 38 6 32 10" fill="none" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="text-[8px] font-mono text-stone-500">100 Taps</span>
        </div>

        <!-- Step 2: 3-Second Production -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-xl border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center animate-[bounce_2s_infinite]">
            <span class="text-xs font-mono font-bold text-cyan-300">3.00s</span>
          </div>
          <span class="text-[10px] font-mono text-stone-300">Phase 2: 3s Cycles</span>
        </div>

        <!-- Step 3: Avian Familiar -->
        <div class="flex flex-col items-center space-y-1.5">
          <div class="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center text-emerald-300">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="13" r="8"/>
              <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span class="text-[10px] font-mono text-emerald-300">Familiar Mastery</span>
        </div>
      </div>
    `;
  }

  if (chamber.id === 'room-4') {
    return `
      <!-- Animated MSIT Altar of Triads Preview -->
      <div class="relative w-full h-full flex flex-col items-center justify-around px-4 py-2">
        <div class="flex items-center space-x-3">
          <div class="px-3 py-1.5 rounded-lg bg-black border border-stone-800 text-2xl font-mono font-bold text-white tracking-[0.3em] drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] animate-[pulse_1.5s_infinite]">
            3 3 1
          </div>
          <div class="flex flex-col text-left">
            <span class="text-[10px] font-mono text-cyan-300 font-bold">Target = 1</span>
            <span class="text-[8px] font-mono text-stone-400">Ignore position; find unique number</span>
          </div>
        </div>

        <!-- 3 Altar Stones Preview with Stone 1 highlighted -->
        <div class="flex items-center space-x-4">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center font-arcane font-bold text-lg shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-110">
            1
          </div>
          <div class="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-500 flex items-center justify-center font-arcane text-base">
            2
          </div>
          <div class="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 text-stone-500 flex items-center justify-center font-arcane text-base">
            3
          </div>
        </div>

        <span class="text-[9px] font-mono text-stone-400">Rest 3 fingers · Tap Stone 1 within 900ms</span>
      </div>
    `;
  }

  if (chamber.id === 'room-5') {
    return `
      <!-- Animated Vault of Artifacts 5-Lane Preview -->
      <div class="relative w-full h-full flex flex-col justify-center px-4 py-1.5 space-y-1.5">
        <div class="flex items-center justify-between text-[9px] font-mono text-stone-400 px-1 border-b border-stone-800 pb-0.5">
          <span>ORIGIN (ASTRAL RUNNER)</span>
          <span class="text-amber-400 font-bold">5 TEMPORAL CURRENTS</span>
          <span>ANCIENT VAULT</span>
        </div>

        <div class="space-y-1 w-full">
          <!-- Lane 5: 60s -->
          <div class="h-4 rounded bg-stone-900/60 border border-stone-800 flex items-center justify-between px-2 text-[8px] font-mono text-stone-500">
            <span>60s Abyssal</span>
            <span class="w-1.5 h-1.5 rounded-full bg-stone-700"></span>
            <span>1000 Coins 🔒</span>
          </div>
          <!-- Lane 4: 30s -->
          <div class="h-4 rounded bg-stone-900/60 border border-stone-800 flex items-center justify-between px-2 text-[8px] font-mono text-stone-500">
            <span>30s Deep</span>
            <span class="w-1.5 h-1.5 rounded-full bg-stone-700"></span>
            <span>1000 Coins 🔒</span>
          </div>
          <!-- Lane 3: 15s (Active Delayed) -->
          <div class="h-5 rounded bg-amber-500/10 border border-amber-500/40 flex items-center justify-between px-2 text-[8px] font-mono text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
            <span class="font-bold">15s Steady</span>
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span class="font-bold text-amber-200">1000 Coins ★</span>
          </div>
          <!-- Lane 2: 7s -->
          <div class="h-4 rounded bg-stone-900/60 border border-stone-800 flex items-center justify-between px-2 text-[8px] font-mono text-stone-500">
            <span>7s Fast</span>
            <span class="w-1.5 h-1.5 rounded-full bg-stone-700"></span>
            <span>1000 Coins 🔒</span>
          </div>
          <!-- Lane 1: 0s (Active Immediate) -->
          <div class="h-5 rounded bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-between px-2 text-[8px] font-mono text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            <span class="font-bold">0s Instant</span>
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span class="font-bold text-cyan-200">400 Coins ⚡</span>
          </div>
        </div>

        <div class="text-[9px] font-mono text-center text-amber-300/90 pt-0.5">
          Real-Time Pathways · Chrono-Expedition
        </div>
      </div>
    `;
  }

  // Generic preview for blueprints
  return `
    <div class="flex flex-col items-center justify-center text-center space-y-2">
      <div class="w-10 h-10 rounded-full border border-stone-700 bg-stone-900 flex items-center justify-center text-stone-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 3a9 9 0 0 0 0 18v-9h9"/>
        </svg>
      </div>
      <span class="text-xs font-mono text-stone-400 tracking-wider">CHAMBER BLUEPRINT: ${chamber.paradigm}</span>
      <span class="text-[10px] font-mono text-stone-500">${chamber.scientificObjective}</span>
    </div>
  `;
}

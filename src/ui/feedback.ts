/**
 * TEMPLE of Time - Post-Task Feedback & Score Screen
 * Displays immediate psychophysical metrics, Intentional Binding index, and trial data table.
 * STRICT SPECIFICATION: Zero CSV / JSON export buttons.
 */

import { SessionResult, ParticipantProfile } from '../types';
import { getProfile, getLatestChamberSeal } from '../store';
import { playCompletionFanfare, playTactileClick } from '../audio';

export interface FeedbackCallbacks {
  onReturnDashboard: () => void;
  onReplayChamber: () => void;
}

export function renderFeedbackScreen(container: HTMLElement, session: SessionResult, callbacks: FeedbackCallbacks): void {
  playCompletionFanfare();
  const profile: ParticipantProfile | null = getProfile();
  const latestSeal = getLatestChamberSeal();

  container.innerHTML = `
    <div class="min-h-screen bg-[#08090e] p-4 sm:p-6 lg:p-8 flex flex-col justify-between select-none">
      
      <div class="max-w-4xl mx-auto w-full space-y-6 flex-1">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-stone-800 pb-4">
          <div>
            <div class="flex items-center space-x-2 text-xs font-mono uppercase tracking-wider text-amber-400 mb-1">
              <span>TRIAL BATTERY COMPLETE</span>
              <span>·</span>
              <span class="text-stone-400">${session.roomName}</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-arcane text-stone-100 font-semibold">
              Chamber Synthesis & Mastery
            </h1>
          </div>

          <div class="flex items-center space-x-2 bg-[#0f121d] border border-amber-500/30 px-3.5 py-1.5 rounded-xl">
            <span class="text-amber-400 font-bold font-mono">🔥</span>
            <span class="text-xs font-mono text-stone-200">
              Streak: <strong class="text-amber-300 font-mono-num">${profile?.streak_count || 1}</strong> Days
            </span>
          </div>
        </div>

        <!-- Metric Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          
          <!-- Metric 1: Chamber Mastery -->
          <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between">
            <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Chamber Mastery</span>
            <div class="my-2">
              <span class="text-3xl font-mono-num font-bold text-amber-300">${session.masteryScore}%</span>
            </div>
            <span class="text-[10px] font-mono text-stone-500">Threshold: 75% for Adept</span>
          </div>

          <!-- Metric 2: Mean Reaction Time -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-4 flex flex-col justify-between">
            <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Mean RT</span>
            <div class="my-2">
              <span class="text-3xl font-mono-num font-bold text-stone-100">${session.meanReactionTimeMs}</span>
              <span class="text-xs font-mono text-stone-400 ml-1">ms</span>
            </div>
            <span class="text-[10px] font-mono text-stone-500">Motor Initiation Speed</span>
          </div>

          <!-- Metric 3: Intentional Binding Shift -->
          <div class="bg-[#0f121d] border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
            <span class="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">Binding Shift</span>
            <div class="my-2">
              <span class="text-3xl font-mono-num font-bold text-cyan-300">${session.bindingEffectMagnitude > 0 ? '+' : ''}${session.bindingEffectMagnitude}%</span>
            </div>
            <span class="text-[10px] font-mono text-stone-500">Short vs Long Delay Agency</span>
          </div>

          <!-- Metric 4: Agency Under Short Delay -->
          <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-4 flex flex-col justify-between">
            <span class="text-[11px] font-mono text-stone-400 uppercase tracking-wider">Short-Delay Agency</span>
            <div class="my-2">
              <span class="text-3xl font-mono-num font-bold text-stone-100">${session.meanAgencyShortDelay}%</span>
            </div>
            <span class="text-[10px] font-mono text-stone-500">Intervals ≤ 300 ms</span>
          </div>

        </div>

        <!-- Empirical Psychophysics Analysis Notice -->
        <div class="bg-[#0f121d] border border-stone-800 rounded-2xl p-4 sm:p-5 text-xs text-stone-300 leading-relaxed space-y-2">
          <div class="flex items-center space-x-2 text-amber-300 font-mono font-semibold uppercase tracking-wider text-[11px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Psychophysical Binding Telemetry</span>
          </div>
          <p>
            ${session.bindingEffectMagnitude >= 15
              ? `Your subjective sense of agency demonstrates classic Intentional Binding: voluntary action strongly compressed the perceived interval to the crystal chime, elevating perceived authorship by ${session.bindingEffectMagnitude}% for proximal delays.`
              : `Your delay discrimination across intervals was highly linear, showing acute temporal resolution with a modest intentional binding bias of ${session.bindingEffectMagnitude}%.`}
          </p>
        </div>

        <!-- Trial Breakdown Data Table -->
        <div class="bg-[#0f121d] border border-stone-800 rounded-2xl overflow-hidden">
          <div class="px-5 py-3 border-b border-stone-800 flex justify-between items-center bg-[#0a0d16]">
            <h3 class="text-xs font-mono uppercase tracking-wider text-stone-300">Trial Timing Log (Sub-Millisecond Records)</h3>
            <span class="text-[11px] font-mono text-stone-500">${session.trials.length} Recorded Trials</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs font-mono">
              <thead class="bg-[#0a0d16]/70 text-stone-400 border-b border-stone-800">
                <tr>
                  <th class="py-2.5 px-4">#</th>
                  <th class="py-2.5 px-3">Programmed Δt</th>
                  <th class="py-2.5 px-3">Measured Δt</th>
                  <th class="py-2.5 px-3">Reaction Time</th>
                  <th class="py-2.5 px-3">Agency</th>
                  <th class="py-2.5 px-3">Estimated Δt</th>
                  <th class="py-2.5 px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-800/60 text-stone-300">
                ${session.trials.map((t, idx) => `
                  <tr class="hover:bg-stone-800/20">
                    <td class="py-2.5 px-4 font-mono-num text-stone-400">${idx + 1}</td>
                    <td class="py-2.5 px-3 font-mono-num">${t.stimulus_parameters.programmed_delay_ms} ms</td>
                    <td class="py-2.5 px-3 font-mono-num text-cyan-400">${t.timing_data.actual_measured_delay_ms} ms</td>
                    <td class="py-2.5 px-3 font-mono-num">${t.timing_data.reaction_time_ms} ms</td>
                    <td class="py-2.5 px-3 font-mono-num text-amber-300">${t.user_response.agency_rating}%</td>
                    <td class="py-2.5 px-3 font-mono-num">${t.user_response.estimated_delay_ms || '-'} ms</td>
                    <td class="py-2.5 px-4 text-right font-mono-num font-semibold ${t.accuracy_or_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}">
                      ${t.accuracy_or_score}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Action Button Bar with Ethereal Chamber Seals Inscribed Indicator -->
      <div class="max-w-4xl mx-auto w-full pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <!-- Ethereal Chamber Seal Inscription Badge -->
        <div class="flex items-center space-x-2 text-emerald-400 font-mono text-xs bg-emerald-950/30 border border-emerald-500/40 px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-emerald-400">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span class="font-semibold tracking-wide">✦ Chamber Seals Inscribed</span>
          <span class="text-stone-400 text-[11px] hidden sm:inline">· ${latestSeal?.flushedCount || session.trials.length} trials synchronized</span>
        </div>

        <div class="w-full sm:w-auto flex items-center space-x-3">
          <button id="btn-replay-chamber" 
                  class="flex-1 sm:flex-none px-5 py-3 rounded-xl border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer">
            Replay Chamber
          </button>
          
          <button id="btn-return-dashboard" 
                  class="flex-1 sm:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl text-xs font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all flex items-center justify-center space-x-2 cursor-pointer">
            <span>Return to Academy</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Application Master Footer -->
      <footer id="app-footer" class="max-w-4xl mx-auto w-full pt-8 pb-4 text-center border-t border-stone-900/60 mt-4">
        TEMPLE of TIME: Timescales of Experience: Motor, Perceptual & Latency of Executive-function
      </footer>

    </div>
  `;

  document.getElementById('btn-replay-chamber')?.addEventListener('click', () => {
    playTactileClick();
    callbacks.onReplayChamber();
  });

  document.getElementById('btn-return-dashboard')?.addEventListener('click', () => {
    playTactileClick();
    callbacks.onReturnDashboard();
  });
}

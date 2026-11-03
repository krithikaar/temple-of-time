/**
 * TEMPLE of Time - Participant Informed Consent Modal
 * Department of Neurophysiology, NIMHANS, Bengaluru
 * 
 * Non-dismissible gating modal requiring explicit informed consent before dashboard access.
 */

import { ParticipantProfile } from '../types';
import { recordParticipantConsent } from '../supabase';
import { playTactileClick } from '../audio';
import { getProfile } from '../store';

export function renderConsentScreen(
  container: HTMLElement,
  profile: ParticipantProfile,
  onConsented: (updatedProfile: ParticipantProfile) => void
): void {
  // Prevent browser back button navigation while consent is pending
  const trapHistory = () => {
    window.history.pushState(null, '', window.location.href);
  };
  window.history.pushState(null, '', window.location.href);
  window.addEventListener('popstate', trapHistory);

  // Block ESC key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      shakeCard();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  let isSubmitting = false;

  container.innerHTML = `
    <div id="consent-modal-overlay" class="min-h-screen w-full bg-[#08090e]/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none relative z-50">
      
      <!-- Subtle arcane background glow -->
      <div class="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div class="w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]"></div>
      </div>

      <!-- Consent Card Container -->
      <div id="consent-card" class="w-full max-w-2xl bg-[#0f121d] border border-amber-500/35 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col relative overflow-hidden transition-transform duration-200">
        
        <!-- Arcane Header Emblem & Title -->
        <div class="px-5 py-5 sm:px-8 sm:py-6 border-b border-amber-500/20 bg-gradient-to-b from-[#141824] to-[#0f121d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center space-x-3.5">
            <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div>
              <h1 class="text-lg sm:text-xl font-arcane text-amber-100 font-bold tracking-wide">
                TEMPLE of Time: Participant Informed Consent
              </h1>
              <p class="text-[11px] sm:text-xs text-stone-400 font-mono tracking-wide mt-0.5">
                NIMHANS Department of Neurophysiology · Clinical & Cognitive Research
              </p>
            </div>
          </div>

          <!-- Participant Identifier Chip -->
          <div class="self-start sm:self-auto bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-lg flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <div class="text-[11px] font-mono">
              <span class="text-stone-400 uppercase text-[9px] block leading-none">Initiate ID</span>
              <span class="text-amber-300 font-bold tracking-wider">${profile.subject_id}</span>
            </div>
          </div>
        </div>

        <!-- Scrollable Narrative Body Area (Exact Copy, No Bullets) -->
        <div id="consent-body-scroll" class="p-5 sm:p-8 overflow-y-auto max-h-[56vh] space-y-4 text-stone-300 text-xs sm:text-sm leading-relaxed sm:leading-relaxed font-sans pr-4 sm:pr-6 custom-scrollbar">
          
          <!-- Notice Header Banner -->
          <div class="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-200/90 text-xs font-mono flex items-center space-x-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-400 shrink-0">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Please carefully review the informed consent details below prior to entering the Temple chambers.</span>
          </div>

          <!-- Paragraph 1 - Study Background -->
          <p class="text-stone-300">
            I am Dr. Krithika A. Ramaswamy, a PhD Scholar in the Department of Neurophysiology at the National Institute of Mental Health and Neurosciences (NIMHANS), Bengaluru, conducting this research under the guidance of Dr. Ravindra P. N., Dr. Arun and Dr. Rajendra K. M. Through the TEMPLE of Time application, our research team is conducting a scientific study to systematically evaluate the timescales of perception and investigate their distinct behavioral correlates across cognitive and motor tasks.
          </p>

          <!-- Paragraph 2 - Data Collected -->
          <p class="text-stone-300">
            If you choose to participate in our study and use this application, we will collect data regarding your app interactions, including your task performances, reaction latencies, accuracy measures, session frequency, and overall login history. In addition, to ensure psychophysical precision and experimental validity, the application may collect diagnostic device telemetry such as display refresh rate, frame pacing, touch input responsiveness, and asset loading speeds.
          </p>

          <!-- Paragraph 3 - Confidentiality & Privacy -->
          <p class="text-stone-300">
            All collected data will be thoroughly de-identified, pseudonymized, and securely stored for academic research, statistical modeling, and publication in peer-reviewed scientific journals. We strictly guarantee your data privacy: your personal identity and contact details will never be leaked, sold, or shared with any third party outside the designated NIMHANS research team, ensuring complete confidentiality throughout and following the study.
          </p>

          <!-- Paragraph 4 - Consent Declaration (Render in Italics) -->
          <div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p class="italic text-amber-200/95 font-medium leading-relaxed">
              By tapping the "I Agree" button below, you confirm that you have read and understood the study details outlined above, acknowledge that your participation is completely voluntary, and grant your informed consent for our team to collect, anonymize, and analyze your task and device data for academic research.
            </p>
          </div>

        </div>

        <!-- Error Feedback Banner -->
        <div id="consent-error-banner" class="hidden mx-5 sm:mx-8 mb-2 p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-mono"></div>

        <!-- Footer Action Area -->
        <div class="p-5 sm:p-7 border-t border-stone-800 bg-[#0a0d16] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="text-[11px] font-mono text-stone-400 text-center sm:text-left flex items-center space-x-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-400 shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <span>Participation is voluntary · Secure encrypted timestamp recorded</span>
          </div>

          <button type="button" 
                  id="btn-consent-agree" 
                  class="w-full sm:w-auto px-8 h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.3)] flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            <span id="btn-consent-label">I Agree</span>
            <svg id="btn-consent-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <div id="btn-consent-spinner" class="hidden">
              <svg class="animate-spin h-4 w-4 text-stone-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            </div>
          </button>
        </div>

      </div>

    </div>
  `;

  function shakeCard(): void {
    const card = document.getElementById('consent-card');
    if (card) {
      card.classList.add('ring-2', 'ring-amber-500/80', 'scale-[1.01]');
      setTimeout(() => {
        card.classList.remove('ring-2', 'ring-amber-500/80', 'scale-[1.01]');
      }, 300);
    }
  }

  // Prevent clicking outside the card from doing anything except gently alerting user
  const overlay = document.getElementById('consent-modal-overlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      shakeCard();
    }
  });

  const agreeBtn = document.getElementById('btn-consent-agree') as HTMLButtonElement | null;
  const agreeLabel = document.getElementById('btn-consent-label');
  const agreeArrow = document.getElementById('btn-consent-arrow');
  const agreeSpinner = document.getElementById('btn-consent-spinner');
  const errorBanner = document.getElementById('consent-error-banner');

  agreeBtn?.addEventListener('click', async () => {
    if (isSubmitting) return;

    playTactileClick();
    isSubmitting = true;

    if (agreeBtn) agreeBtn.disabled = true;
    if (agreeLabel) agreeLabel.textContent = 'Recording Informed Consent...';
    if (agreeArrow) agreeArrow.classList.add('hidden');
    if (agreeSpinner) agreeSpinner.classList.remove('hidden');
    if (errorBanner) errorBanner.classList.add('hidden');

    try {
      const result = await recordParticipantConsent(profile.subject_id);

      // Clean up event traps
      window.removeEventListener('popstate', trapHistory);
      window.removeEventListener('keydown', handleKeyDown);

      const latest = getProfile() || {
        ...profile,
        has_consented: true,
        consented_at: result.consented_at
      };

      onConsented(latest);
    } catch (err) {
      isSubmitting = false;
      if (agreeBtn) agreeBtn.disabled = false;
      if (agreeLabel) agreeLabel.textContent = 'I Agree';
      if (agreeArrow) agreeArrow.classList.remove('hidden');
      if (agreeSpinner) agreeSpinner.classList.add('hidden');

      if (errorBanner) {
        errorBanner.textContent = (err as Error).message || 'Failed to record consent. Please check your network and try again.';
        errorBanner.classList.remove('hidden');
      }
    }
  });
}

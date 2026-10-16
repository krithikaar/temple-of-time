/**
 * TEMPLE of Time - Auth & Account Recovery Screen
 * 
 * Rules:
 * 1. Automatically assigns a unique SubjectID (TEMP-0001, TEMP-0002, ...) on Sign up.
 * 2. SubjectID is strictly non-editable and immutable by the user.
 * 3. User can only input and update their Name, Age, Gender, and Email ID.
 * 4. Returning initiates sign in with their Email ID, which ties back to their unique SubjectID in Supabase.
 */

import { ParticipantProfile } from '../types';
import { getProfile, getStoredSubjectId } from '../store';
import { signUpNewInitiate, signInReturningInitiate, updateInitiateProfile, getNextSubjectId } from '../supabase';
import { playTactileClick } from '../audio';

export function renderAuthScreen(container: HTMLElement, onComplete: (profile: ParticipantProfile) => void): void {
  const existing = getProfile();
  const lockedSubjectId = getStoredSubjectId();
  const hasEnrolledProfile = !!(existing && existing.subject_id && /^TEMP-\d+$/i.test(existing.subject_id));

  // Modes: 'new' | 'returning' | 'edit'
  let activeMode: 'new' | 'returning' | 'edit' = hasEnrolledProfile ? 'edit' : 'new';
  let assignedSubjectIdCache: string = '';
  let isLoadingNextId = false;

  async function fetchAssignedId(): Promise<void> {
    if (assignedSubjectIdCache) return;
    isLoadingNextId = true;
    try {
      assignedSubjectIdCache = await getNextSubjectId();
    } catch {
      assignedSubjectIdCache = 'TEMP-0001';
    } finally {
      isLoadingNextId = false;
      const el = document.getElementById('input-new-subject-id') as HTMLInputElement | null;
      if (el) el.value = assignedSubjectIdCache;
    }
  }

  function render(): void {
    container.innerHTML = `
      <div class="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-[#08090e]">
        <div class="w-full max-w-md bg-[#0f121d] border border-amber-500/25 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          <!-- Arcane Header Emblem -->
          <div class="flex flex-col items-center text-center space-y-3 mb-6">
            <div class="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
              </svg>
            </div>
            <div>
              <h1 class="text-2xl sm:text-3xl font-arcane text-amber-100 font-semibold tracking-wide">TEMPLE OF TIME</h1>
              <p class="text-xs text-stone-400 mt-1 uppercase tracking-widest font-mono">Temporal Academy Registry</p>
            </div>
          </div>

          <!-- Mode Selector Tabs (New Initiate vs. Returning Initiate) -->
          ${activeMode !== 'edit' ? `
            <div class="grid grid-cols-2 p-1 bg-[#08090e] border border-stone-800 rounded-xl mb-6">
              <button type="button" 
                      id="tab-new-initiate" 
                      class="py-2.5 px-3 text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        activeMode === 'new'
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold shadow-sm'
                          : 'text-stone-400 hover:text-stone-200 border border-transparent'
                      }">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Initiate</span>
              </button>

              <button type="button" 
                      id="tab-returning-initiate" 
                      class="py-2.5 px-3 text-xs font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        activeMode === 'returning'
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold shadow-sm'
                          : 'text-stone-400 hover:text-stone-200 border border-transparent'
                      }">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>Returning Initiate</span>
              </button>
            </div>
          ` : `
            <div class="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span class="text-[10px] font-mono text-amber-400/90 uppercase tracking-wider block">Active Initiate Registry</span>
                <span class="text-sm font-mono font-bold text-amber-300">${existing?.subject_id}</span>
              </div>
              <button type="button" id="btn-switch-account" class="text-xs font-mono text-stone-400 hover:text-amber-300 underline cursor-pointer">
                Switch Initiate →
              </button>
            </div>
          `}

          <!-- Alert / Error Banner -->
          <div id="auth-error-banner" class="hidden mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono leading-relaxed"></div>
          <div id="auth-success-banner" class="hidden mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-mono leading-relaxed"></div>

          <!-- Forms based on active mode -->
          ${activeMode === 'new' 
            ? renderNewInitiateForm() 
            : activeMode === 'returning'
              ? renderReturningInitiateForm()
              : renderEditProfileForm(existing!)}

        </div>

        <!-- Master Application Footer -->
        <footer id="app-footer" class="mt-8 text-center text-xs font-mono text-stone-500">
          TEMPLE of TIME: Timescales of Experience: Motor, Perceptual & Latency of Executive-function
        </footer>
      </div>
    `;

    attachListeners();

    if (activeMode === 'new' && !assignedSubjectIdCache) {
      fetchAssignedId();
    }
  }

  /**
   * 1. New Initiate Sign Up Form:
   * Subject ID is auto-assigned (TEMP-0001 onwards) and strictly non-editable.
   * User can only enter Name, Age, Gender, and Email ID.
   */
  function renderNewInitiateForm(): string {
    const currentId = assignedSubjectIdCache || (isLoadingNextId ? 'Generating...' : 'TEMP-0001');

    return `
      <form id="form-new-initiate" class="space-y-4">
        
        <!-- Auto-Assigned Subject ID (Non-editable / Locked) -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="block text-xs font-mono uppercase tracking-wider text-amber-300/90 font-semibold">
              Assigned Subject ID
            </label>
            <span class="text-[10px] font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/40 flex items-center space-x-1">
              <span>🔒</span>
              <span>Auto-Assigned · Locked</span>
            </span>
          </div>

          <div class="relative">
            <input type="text" 
                   id="input-new-subject-id" 
                   value="${currentId}" 
                   readonly 
                   tabindex="-1"
                   class="w-full h-11 px-3.5 bg-[#07080f] border border-amber-500/40 text-amber-300 rounded-lg font-mono text-sm tracking-wider outline-none cursor-not-allowed select-all shadow-inner font-bold" />
          </div>
          <p class="text-[10px] text-stone-400 mt-1">
            Assigned from TEMP-0001 onwards. This research ID is permanently sealed and cannot be altered.
          </p>
        </div>

        <!-- Email ID (Required) -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="block text-xs font-mono uppercase tracking-wider text-stone-300">
              Email ID <span class="text-amber-400">*</span>
            </label>
            <span class="text-[10px] font-mono text-stone-500">For Account Recovery</span>
          </div>
          <input type="email" 
                 id="input-new-email" 
                 required 
                 autocomplete="email"
                 placeholder="e.g. initiate@temple.edu" 
                 class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-sans text-sm outline-none transition-colors" />
          <p class="text-[10px] text-stone-500 mt-1">
            When returning to the Temple, enter this email to restore your assigned Subject ID.
          </p>
        </div>

        <!-- Player Name (Editable) -->
        <div>
          <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
            Player Name (Display Alias) <span class="text-amber-400">*</span>
          </label>
          <input type="text" 
                 id="input-new-player-name" 
                 value="Adept Hermes" 
                 required 
                 placeholder="e.g. Adept Hermes" 
                 class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-sans text-sm outline-none transition-colors" />
        </div>

        <!-- Age & Gender Grid (Editable) -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
              Age <span class="text-amber-400">*</span>
            </label>
            <input type="number" 
                   id="input-new-age" 
                   min="18" 
                   max="99" 
                   value="26" 
                   required
                   class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-mono text-sm outline-none transition-colors" />
          </div>

          <div>
            <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
              Gender <span class="text-amber-400">*</span>
            </label>
            <select id="select-new-gender" 
                    required
                    class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 text-sm outline-none transition-colors">
              <option value="Male" selected>Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="pt-2">
          <button type="submit" 
                  id="btn-submit-new"
                  class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono tracking-wider uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2 cursor-pointer">
            <span id="btn-submit-new-label">Inscribe Identity & Enter</span>
            <svg id="btn-submit-new-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </form>
    `;
  }

  /**
   * 2. Returning Initiate Sign In Form:
   * Asks for Email ID and ties back to the unique Subject ID saved in Supabase.
   */
  function renderReturningInitiateForm(): string {
    return `
      <form id="form-returning-initiate" class="space-y-5">
        
        <!-- Email ID Input for Account Recovery -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="block text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">
              Registered Email ID
            </label>
            <span class="text-[10px] font-mono text-emerald-400">Account Recovery</span>
          </div>

          <input type="email" 
                 id="input-return-email" 
                 placeholder="e.g. initiate@temple.edu" 
                 required 
                 autocomplete="email"
                 autofocus
                 class="w-full h-12 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 text-stone-100 rounded-lg font-sans text-sm tracking-wide outline-none transition-colors" />
          <p class="text-[10px] text-stone-400 mt-2 leading-relaxed">
            Enter your registered email address. We will automatically look up your account in Supabase, tie back to your unique Subject ID (e.g. TEMP-0001), and restore your chamber records.
          </p>
        </div>

        <div class="pt-2">
          <button type="submit" 
                  id="btn-submit-return"
                  class="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-semibold text-xs font-mono tracking-wider uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2 cursor-pointer">
            <span id="btn-submit-return-label">Retrieve Subject ID & Enter</span>
            <svg id="btn-submit-return-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <div class="text-center pt-1">
          <button type="button" 
                  id="btn-switch-to-new" 
                  class="text-[11px] font-mono text-stone-400 hover:text-amber-300 transition-colors cursor-pointer underline underline-offset-4">
            First time here? Register as a New Initiate →
          </button>
        </div>
      </form>
    `;
  }

  /**
   * 3. Edit Profile Form (for signed-in users):
   * Subject ID is non-editable / locked. User can update Name, Age, Gender, and Email ID.
   */
  function renderEditProfileForm(profile: ParticipantProfile): string {
    return `
      <form id="form-edit-profile" class="space-y-4">
        
        <!-- Non-editable Subject ID -->
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label class="block text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold">
              Subject ID (Immutable)
            </label>
            <span class="text-[10px] font-mono text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/40">
              🔒 Locked
            </span>
          </div>
          <input type="text" 
                 value="${profile.subject_id}" 
                 readonly 
                 disabled
                 class="w-full h-11 px-3 bg-[#07080f] border border-amber-500/40 text-amber-300 rounded-lg font-mono text-sm tracking-wider outline-none cursor-not-allowed select-all font-bold shadow-inner" />
          <p class="text-[10px] text-stone-500 mt-1">Research ID is permanent and cannot be modified.</p>
        </div>

        <!-- Editable Email ID -->
        <div>
          <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
            Email ID <span class="text-amber-400">*</span>
          </label>
          <input type="email" 
                 id="input-edit-email" 
                 value="${profile.email || ''}" 
                 required 
                 placeholder="e.g. initiate@temple.edu" 
                 class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-sans text-sm outline-none transition-colors" />
        </div>

        <!-- Editable Player Name -->
        <div>
          <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
            Player Name <span class="text-amber-400">*</span>
          </label>
          <input type="text" 
                 id="input-edit-player-name" 
                 value="${profile.player_name || profile.name || ''}" 
                 required 
                 class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-sans text-sm outline-none transition-colors" />
        </div>

        <!-- Editable Age & Gender -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
              Age <span class="text-amber-400">*</span>
            </label>
            <input type="number" 
                   id="input-edit-age" 
                   min="18" 
                   max="99" 
                   value="${profile.age || 26}" 
                   required
                   class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 font-mono text-sm outline-none transition-colors" />
          </div>

          <div>
            <label class="block text-xs font-mono uppercase tracking-wider text-stone-300 mb-1.5">
              Gender <span class="text-amber-400">*</span>
            </label>
            <select id="select-edit-gender" 
                    required
                    class="w-full h-11 px-3 bg-[#08090e] border border-stone-700 focus:border-amber-400 rounded-lg text-stone-100 text-sm outline-none transition-colors">
              <option value="Male" ${profile.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${profile.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option value="Other" ${profile.gender === 'Other' ? 'selected' : ''}>Other</option>
              <option value="Prefer not to say" ${profile.gender === 'Prefer not to say' ? 'selected' : ''}>Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="pt-2 flex items-center space-x-3">
          <button type="submit" 
                  id="btn-submit-edit"
                  class="flex-1 h-12 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs font-mono tracking-wider uppercase rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center justify-center space-x-2 cursor-pointer">
            <span id="btn-submit-edit-label">Save & Return to Dashboard</span>
          </button>
        </div>

        <div class="text-center pt-2">
          <button type="button" 
                  id="btn-cancel-edit" 
                  class="text-[11px] font-mono text-stone-400 hover:text-stone-200 transition-colors cursor-pointer">
            ← Return to Dashboard without changes
          </button>
        </div>
      </form>
    `;
  }

  function showError(message: string): void {
    const errorBanner = document.getElementById('auth-error-banner');
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.classList.remove('hidden');
    }
  }

  function hideError(): void {
    const errorBanner = document.getElementById('auth-error-banner');
    if (errorBanner) {
      errorBanner.classList.add('hidden');
    }
  }

  let isSubmitting = false;

  function attachListeners(): void {
    // Tab: New Initiate
    document.getElementById('tab-new-initiate')?.addEventListener('click', () => {
      if (isSubmitting) return;
      playTactileClick();
      activeMode = 'new';
      render();
    });

    // Tab: Returning Initiate
    document.getElementById('tab-returning-initiate')?.addEventListener('click', () => {
      if (isSubmitting) return;
      playTactileClick();
      activeMode = 'returning';
      render();
    });

    // Switch to New Link
    document.getElementById('btn-switch-to-new')?.addEventListener('click', () => {
      if (isSubmitting) return;
      playTactileClick();
      activeMode = 'new';
      render();
    });

    // Switch Account button (from edit mode)
    document.getElementById('btn-switch-account')?.addEventListener('click', () => {
      if (isSubmitting) return;
      playTactileClick();
      activeMode = 'returning';
      render();
    });

    // Cancel edit
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
      playTactileClick();
      if (existing) {
        onComplete(existing);
      }
    });

    // Form: New Initiate
    const formNew = document.getElementById('form-new-initiate');
    if (formNew) {
      formNew.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        playTactileClick();
        hideError();

        const emailInput = document.getElementById('input-new-email') as HTMLInputElement;
        const playerInput = document.getElementById('input-new-player-name') as HTMLInputElement;
        const ageInput = document.getElementById('input-new-age') as HTMLInputElement;
        const genderSelect = document.getElementById('select-new-gender') as HTMLSelectElement;
        const submitBtn = document.getElementById('btn-submit-new') as HTMLButtonElement;
        const submitLabel = document.getElementById('btn-submit-new-label');

        const email = emailInput.value.trim().toLowerCase();
        const playerName = playerInput.value.trim() || 'Adept Hermes';
        const parsedAge = parseInt(ageInput.value.trim(), 10);
        const age = Number.isFinite(parsedAge) && parsedAge >= 10 && parsedAge <= 120 ? parsedAge : 26;
        const gender = genderSelect.value || 'Prefer not to say';

        if (!email || !email.includes('@')) {
          showError('Please enter a valid email address for account recovery.');
          return;
        }

        isSubmitting = true;
        if (submitBtn) submitBtn.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Assigning Subject ID & Inscribing...';

        try {
          const result = await signUpNewInitiate({
            email,
            player_name: playerName,
            age,
            gender,
            assigned_subject_id: assignedSubjectIdCache
          });

          if (result.success && result.profile) {
            onComplete(result.profile);
          } else {
            showError(result.error || 'Failed to enroll initiate credentials.');
            isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel) submitLabel.textContent = 'Inscribe Identity & Enter';
          }
        } catch (err) {
          showError((err as Error).message || 'An unexpected error occurred during signup.');
          isSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = 'Inscribe Identity & Enter';
        }
      });
    }

    // Form: Returning Initiate
    const formReturn = document.getElementById('form-returning-initiate');
    if (formReturn) {
      formReturn.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        playTactileClick();
        hideError();

        const emailInput = document.getElementById('input-return-email') as HTMLInputElement;
        const submitBtn = document.getElementById('btn-submit-return') as HTMLButtonElement;
        const submitLabel = document.getElementById('btn-submit-return-label');

        const email = emailInput.value.trim().toLowerCase();

        if (!email || !email.includes('@')) {
          showError('Please enter your registered email address.');
          return;
        }

        isSubmitting = true;
        if (submitBtn) submitBtn.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Looking up Subject ID in Supabase...';

        try {
          const result = await signInReturningInitiate(email);

          if (result.success && result.profile) {
            onComplete(result.profile);
          } else {
            showError(result.error || 'Could not find initiate profile for this email.');
            isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel) submitLabel.textContent = 'Retrieve Subject ID & Enter';
          }
        } catch (err) {
          showError((err as Error).message || 'An unexpected error occurred during account recovery.');
          isSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = 'Retrieve Subject ID & Enter';
        }
      });
    }

    // Form: Edit Profile
    const formEdit = document.getElementById('form-edit-profile');
    if (formEdit && existing) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        playTactileClick();
        hideError();

        const emailInput = document.getElementById('input-edit-email') as HTMLInputElement;
        const playerInput = document.getElementById('input-edit-player-name') as HTMLInputElement;
        const ageInput = document.getElementById('input-edit-age') as HTMLInputElement;
        const genderSelect = document.getElementById('select-edit-gender') as HTMLSelectElement;
        const submitBtn = document.getElementById('btn-submit-edit') as HTMLButtonElement;
        const submitLabel = document.getElementById('btn-submit-edit-label');

        const email = emailInput.value.trim().toLowerCase();
        const playerName = playerInput.value.trim() || existing.player_name || existing.name;
        const parsedAge = parseInt(ageInput.value.trim(), 10);
        const age = Number.isFinite(parsedAge) ? parsedAge : existing.age || 26;
        const gender = genderSelect.value || existing.gender || 'Prefer not to say';

        isSubmitting = true;
        if (submitBtn) submitBtn.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Updating Profile in Supabase...';

        try {
          const res = await updateInitiateProfile({
            subject_id: existing.subject_id,
            email,
            player_name: playerName,
            age,
            gender
          });

          if (res.success && res.profile) {
            onComplete(res.profile);
          } else if (res.success) {
            onComplete({
              ...existing,
              email,
              name: playerName,
              player_name: playerName,
              age,
              gender
            });
          } else {
            showError(res.error || 'Failed to update profile.');
            isSubmitting = false;
            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel) submitLabel.textContent = 'Save & Return to Dashboard';
          }
        } catch (err) {
          showError((err as Error).message || 'Failed to update profile.');
          isSubmitting = false;
          if (submitBtn) submitBtn.disabled = false;
          if (submitLabel) submitLabel.textContent = 'Save & Return to Dashboard';
        }
      });
    }
  }

  render();
}

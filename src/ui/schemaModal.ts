/**
 * TEMPLE of Time - Supabase Schema & Architecture Modal
 * Live Backend credentials inspection and PostgreSQL DDL schema viewer.
 */

import { SUPABASE_SQL_SCHEMA, SUPABASE_CONFIG, testSupabaseConnection } from '../supabase';
import { getLatestChamberSeal } from '../store';
import { playTactileClick } from '../audio';

export function openSchemaModal(): void {
  const existing = document.getElementById('supabase-schema-modal');
  if (existing) existing.remove();

  const latestSeal = getLatestChamberSeal();

  const modal = document.createElement('div');
  modal.id = 'supabase-schema-modal';
  modal.className = 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none';

  modal.innerHTML = `
    <div class="bg-[#0f121d] border border-amber-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-[fadeIn_0.2s_ease]">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-stone-800 flex justify-between items-center bg-[#0a0d16]">
        <div>
          <h2 class="text-base sm:text-lg font-arcane text-amber-100 font-semibold">Live Backend & Supabase Architecture</h2>
          <p class="text-xs text-stone-400 font-mono mt-0.5">Normalized Schemas (participants & trials_sj / soa / smt / tp / dd / msit) + IndexedDB</p>
        </div>
        <button id="modal-close-btn" class="p-2 text-stone-400 hover:text-stone-100 transition-colors cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="p-6 overflow-y-auto space-y-6 text-sm">
        
        <!-- Live Backend Configuration -->
        <div class="bg-[#08090e] border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Production Supabase Connection</span>
            </div>
            <button id="btn-test-connection" class="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded text-xs font-mono transition-colors cursor-pointer">
              Test Connection
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span class="text-stone-500 block text-[10px] uppercase">Base URL</span>
              <code class="text-stone-200 select-all">${SUPABASE_CONFIG.baseUrl}</code>
            </div>
            <div>
              <span class="text-stone-500 block text-[10px] uppercase">Client Ingestion</span>
              <span class="text-cyan-300">Native browser fetch() (Zero external SDKs)</span>
            </div>
          </div>

          <div id="connection-test-result" class="text-xs font-mono pt-1 hidden"></div>
        </div>

        <!-- Latest Chamber Seals Inscription Status -->
        <div class="bg-[#08090e] border border-stone-800 rounded-xl p-4 text-xs font-mono space-y-2">
          <div class="flex justify-between items-center text-stone-400 uppercase tracking-wider text-[10px]">
            <span>Chamber Seals State</span>
            <span class="text-emerald-400 font-bold">FAIL-SAFE BUFFER ACTIVE</span>
          </div>
          <div class="text-stone-300 leading-relaxed">
            ${latestSeal
              ? `Last chamber flushed: <strong class="text-amber-300">${latestSeal.sessionId}</strong> (${latestSeal.flushedCount} trials) at ${new Date(latestSeal.sealedAt).toLocaleTimeString()}. Status: <span class="text-emerald-400">Sealed & Inscribed</span>.`
              : 'Every trial is instantly buffered to localStorage and IndexedDB before fire-and-forget REST dispatching to Supabase.'}
          </div>
        </div>

        <!-- SQL DDL Preview & Copy Section -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <h3 class="text-xs font-mono uppercase tracking-wider text-amber-300">PostgreSQL DDL Schema (participants & normalized trial tables)</h3>
            <button id="btn-copy-sql" class="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-[11px] font-mono text-amber-300 transition-colors flex items-center space-x-1.5 cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span id="copy-btn-text">Copy SQL DDL</span>
            </button>
          </div>
          <div class="bg-[#08090e] border border-stone-800 rounded-lg p-3 max-h-56 overflow-y-auto">
            <pre class="text-[11px] font-mono text-stone-300 whitespace-pre-wrap leading-relaxed select-all">${SUPABASE_SQL_SCHEMA}</pre>
          </div>
        </div>

      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-3 border-t border-stone-800 bg-[#0a0d16] flex justify-end">
        <button id="modal-done-btn" class="px-5 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-xs font-mono uppercase tracking-wider text-stone-200 transition-colors cursor-pointer">
          Close
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    playTactileClick();
    modal.remove();
  };
  document.getElementById('modal-close-btn')?.addEventListener('click', close);
  document.getElementById('modal-done-btn')?.addEventListener('click', close);

  // Copy SQL
  const copyBtn = document.getElementById('btn-copy-sql');
  const copyText = document.getElementById('copy-btn-text');
  if (copyBtn && copyText) {
    copyBtn.addEventListener('click', async () => {
      playTactileClick();
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      copyText.textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        copyText.textContent = 'Copy SQL DDL';
      }, 2000);
    });
  }

  // Test connection
  const testBtn = document.getElementById('btn-test-connection');
  const testResult = document.getElementById('connection-test-result');
  if (testBtn && testResult) {
    testBtn.addEventListener('click', async () => {
      playTactileClick();
      testResult.classList.remove('hidden');
      testResult.className = 'text-xs font-mono pt-1 text-stone-400';
      testResult.textContent = 'Testing connection to Supabase endpoint...';

      const res = await testSupabaseConnection();
      if (res.connected) {
        testResult.className = 'text-xs font-mono pt-1 text-emerald-400';
        testResult.textContent = '● ' + res.message;
      } else {
        testResult.className = 'text-xs font-mono pt-1 text-amber-400';
        testResult.textContent = '▲ ' + res.message;
      }
    });
  }
}

/**
 * TEMPLE of Time - Web Audio API Synthesis Engine
 * Zero-latency procedural audio synthesis with no external file dependencies.
 */

let audioCtx: AudioContext | null = null;

/**
 * Initializes or unlocks the Web Audio Context upon first user interaction
 */
export function initAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getAudioContext(): AudioContext | null {
  return audioCtx;
}

/**
 * Procedural Crystal Tone (Harmonic Bell)
 * Used as the primary stimulus tone in Intentional Binding tasks
 */
export function playCrystalTone(frequency = 520, durationMs = 180, volume = 0.3): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    // Subtle pitch dip for arcane resonance
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.99, now + durationMs / 1000);

    // Natural ADSR curve (crisp attack, exponential ringing decay)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
  } catch (err) {
    console.warn('Audio playback suppressed or uninitialized', err);
  }
}

/**
 * Instant Tactile Feedback Click
 * Ultra-low latency (<2ms) sub-click fired on pointerdown to provide immediate haptic/audio confirmation
 */
export function playTactileClick(): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.02);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  } catch (err) {
    console.warn('Audio playback error', err);
  }
}

/**
 * Synthesizes a 1000 Hz pure sine wave tone for Room 1 (The Weather Spire)
 * Lasts exactly 44 ms with 2-3 ms cosine/linear ramps to eliminate click transients.
 */
export function playWeatherSpireTone(volume = 0.5): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    const durationSec = 0.044; // 44 ms
    const rampSec = 0.003;     // 3 ms ramp

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + rampSec);
    gain.gain.setValueAtTime(volume, now + durationSec - rampSec);
    gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.005);
  } catch (err) {
    console.warn('Weather Spire tone synthesis error', err);
  }
}

/**
 * Synthesizes an authentic wooden chess piece placement knock via Web Audio API.
 * Uses dual-resonance decay (body thud + crisp wood impact transient).
 */
export function playChessPieceSound(volume = 0.5): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    // 1. Primary resonant wood thud (triangle wave with pitch drop)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(310, now);
    osc1.frequency.exponentialRampToValueAtTime(70, now + 0.065);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(volume, now + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.085);

    // 2. High transient click (contact friction)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(740, now);
    osc2.frequency.exponentialRampToValueAtTime(190, now + 0.02);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(volume * 0.4, now + 0.001);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now);
    osc2.stop(now + 0.03);
  } catch (err) {
    console.warn('Chess piece audio synthesis error', err);
  }
}

/**
 * Resonant Alchemical Hum
 * Low ambient rumble for rune activation
 */
export function playRuneHum(freq = 110, durationMs = 350): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.05);
  } catch (err) {
    console.warn('Audio playback error', err);
  }
}

/**
 * Synthesizes a soft organic tactile chime/wood-click for the Aviary seed scatter.
 * Zero-latency: short transient click + resonant harmonic seed tone.
 */
export function playGrainSeedSound(volume = 0.35): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    // 1. Organic wooden seed drop click (soft pitch-envelope)
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();

    oscClick.type = 'triangle';
    oscClick.frequency.setValueAtTime(480, now);
    oscClick.frequency.exponentialRampToValueAtTime(140, now + 0.035);

    gainClick.gain.setValueAtTime(0.001, now);
    gainClick.gain.linearRampToValueAtTime(volume * 0.7, now + 0.002);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);

    oscClick.start(now);
    oscClick.stop(now + 0.045);

    // 2. High crystal chime resonance (celestial seed aura)
    const oscChime = ctx.createOscillator();
    const gainChime = ctx.createGain();

    oscChime.type = 'sine';
    // Gentle variation around 1320 Hz (E6) for an organic musical feel
    const randomFreq = 1280 + Math.random() * 80;
    oscChime.frequency.setValueAtTime(randomFreq, now);

    gainChime.gain.setValueAtTime(0.001, now);
    gainChime.gain.linearRampToValueAtTime(volume * 0.45, now + 0.003);
    gainChime.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    oscChime.connect(gainChime);
    gainChime.connect(ctx.destination);

    oscChime.start(now);
    oscChime.stop(now + 0.1);
  } catch (err) {
    console.warn('Grain seed sound synthesis error', err);
  }
}

/**
 * Synthesizes mystical avian companion vocalizations
 */
export function playFamiliarCall(familiar: 'celestial_owl' | 'storm_raven' | 'sun_hawk'): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    if (familiar === 'celestial_owl') {
      // Soft mystical two-tone hoot (400Hz -> 320Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.28);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (familiar === 'storm_raven') {
      // Atmospheric resonant raven pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Sun Hawk: Bright ascending celestial whistle
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    console.warn('Avian call error', err);
  }
}

/**
 * Harmonic Celestial Fanfare
 * Played on chamber mastery and trial set completion
 */
export function playCompletionFanfare(): void {
  try {
    const ctx = initAudioContext();
    const chords = [440, 554.37, 659.25, 880]; // A major arpeggio
    chords.forEach((freq, idx) => {
      const delaySec = idx * 0.08;
      const now = ctx.currentTime + delaySec;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    });
  } catch (err) {
    console.warn('Audio error', err);
  }
}

/**
 * Procedural MSIT Correct Tone (Practice Phase)
 * Crisp high chime (880 Hz sine wave, 60 ms duration, 2-3 ms micro-envelopes)
 */
export function playMSITCorrectTone(volume = 0.35): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    const durationSec = 0.06; // 60 ms
    const rampSec = 0.003;    // 3 ms ramp

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + rampSec);
    gain.gain.setValueAtTime(volume, now + durationSec - rampSec);
    gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.005);
  } catch (err) {
    console.warn('MSIT correct tone synthesis error', err);
  }
}

/**
 * Procedural MSIT Incorrect / Timeout Blip (Practice Phase)
 * Low muted blip (220 Hz triangle wave, 80 ms duration, 2-3 ms micro-envelopes)
 */
export function playMSITIncorrectTone(volume = 0.35): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);

    const durationSec = 0.08; // 80 ms
    const rampSec = 0.003;    // 3 ms ramp

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + rampSec);
    gain.gain.setValueAtTime(volume, now + durationSec - rampSec);
    gain.gain.linearRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.005);
  } catch (err) {
    console.warn('MSIT incorrect tone synthesis error', err);
  }
}

/**
 * Gemstone Stone Click
 * 10 ms neutral tactile haptic/click for active task gemstone presses
 */
export function playGemstoneStoneClick(volume = 0.25): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.012);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.015);
  } catch (err) {
    console.warn('Gemstone click synthesis error', err);
  }
}

/**
 * Path Selection Click (Room 5: The Vault of Artifacts)
 * Soft resonant click: 440 Hz pulse with 2 ms envelope
 */
export function playPathSelectClick(volume = 0.25): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch (err) {
    console.warn('Path select click error', err);
  }
}

/**
 * Vault Arrival / Coin Claim Chime (Room 5: The Vault of Artifacts)
 * Uplifting pentatonic chime: sine wave combination with smooth micro-envelope
 */
export function playVaultArrivalChime(volume = 0.3): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    // Uplifting pentatonic arpeggio chords: D5, F#5, A5, D6
    const freqs = [587.33, 739.99, 880.0, 1174.66];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.055;
      const duration = 0.38;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.01, startTime + 0.05);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(volume * (0.85 - idx * 0.08), startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  } catch (err) {
    console.warn('Vault arrival chime error', err);
  }
}

/**
 * Rapid Coin Collection Pulse (Micro tick)
 */
export function playCoinCollectPulse(volume = 0.15): void {
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch (err) {
    console.warn('Coin tick error', err);
  }
}


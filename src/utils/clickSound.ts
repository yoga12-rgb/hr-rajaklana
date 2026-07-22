"use client";

/**
 * Web Audio API synthesized subtle mobile tap/click sound effect + Haptic Feedback.
 * Fast, zero-latency, no external audio assets required.
 * 
 * Industry Standard: Menggabungkan audio feedback + getaran fisik (navigator.vibrate)
 * untuk memberikan kesan tombol yang nyata dan responsif seperti Native App.
 */
export function playClickSound() {
  if (typeof window === "undefined") return;

  // Haptic Feedback (getaran sentuhan fisik 8ms ultra-halus)
  try {
    if (navigator.vibrate) {
      navigator.vibrate(8);
    }
  } catch {
    // Haptic API tidak tersedia pada beberapa perangkat/browser
  }

  // Audio Feedback (Web Audio API synthesized click)
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    
    // Resume context if suspended
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Crisp soft click sound pitch frequency
    osc.type = "sine";
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.03);

    // Subtle volume envelope to prevent harsh pops
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  } catch {
    // Fail silently if browser audio policy restricts unprompted audio
  }
}

/**
 * Haptic feedback kuat untuk aksi penting (misalnya submit, approve, reject).
 * Getaran lebih panjang (15ms) untuk memberikan sensasi "konfirmasi" yang tegas.
 */
export function playSuccessHaptic() {
  if (typeof window === "undefined") return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate([10, 30, 15]); // Pola: getaran-jeda-getaran (double-tap native feel)
    }
  } catch {
    // Fail silently
  }
}

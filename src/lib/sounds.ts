'use client';

// Utilidades de sonido sintético usando Web Audio API para una vibra "Quantum"
let audioCtx: AudioContext | null = null;

function getContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playTechBeep() {
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

export function playSuccessChime() {
  const ctx = getContext();
  if (!ctx) return;
  
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc1.type = 'sine';
  osc2.type = 'triangle';
  
  osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
  osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
  
  osc2.frequency.setValueAtTime(523.25 * 2, ctx.currentTime); 
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.5);
  osc2.stop(ctx.currentTime + 0.5);
}

export function playAlarm() {
  const ctx = getContext();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.2);
  osc.frequency.setValueAtTime(300, ctx.currentTime + 0.2);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

export function playInvestSound() {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function playWinSound() {
  const ctx = getContext();
  if (!ctx) return;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc1.type = 'sine';
  osc2.type = 'triangle';
  
  osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
  osc1.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15); // C#5
  osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3); // E5
  osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.45); // A5

  osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.45); 

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.2, ctx.currentTime + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
  
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  
  osc1.start(ctx.currentTime);
  osc2.start(ctx.currentTime + 0.45);
  osc1.stop(ctx.currentTime + 1.0);
  osc2.stop(ctx.currentTime + 1.0);
}

export function playLossSound() {
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  
  // Slide down slowly
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6);
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.6);
}

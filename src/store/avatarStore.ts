import { create } from 'zustand';
import { Viseme } from '@/lib/lipsync';

interface AvatarState {
  audio: HTMLAudioElement | null;
  visemes: Viseme[];
  isPlaying: boolean;
  startTime: number;
  // When playing without audio element, advance a logical clock for visemes
  clockStartTime: number | null;
  isClockPlaying: boolean;
  // Live speech amplitude (0..1) derived from audio analyser
  amplitude: number;
  playAudioWithVisemes: (audioBlob: Blob, visemes: Viseme[]) => void;
  playVisemesOnly: (visemes: Viseme[]) => void;
  stopAudio: () => void;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  audio: null,
  visemes: [],
  isPlaying: false,
  startTime: 0,
  clockStartTime: null,
  isClockPlaying: false,
  amplitude: 0,
  playAudioWithVisemes: (audioBlob, visemes) => {
    const currentAudio = get().audio;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    // Setup analyser to compute live amplitude
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let rafId: number | null = null;
    const startAnalyser = () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(buffer);
          // Compute RMS amplitude 0..1
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          // Smooth and clamp
          const weight = Math.min(1, Math.max(0, rms * 2.2));
          set({ amplitude: weight });
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch (err) {
        // If analyser fails, keep amplitude at baseline
        console.warn('[Avatar] Failed to start audio analyser:', err);
        set({ amplitude: 0.0 });
      }
    };

    audio.onplay = () => {
      set({ isPlaying: true, startTime: Date.now() / 1000, isClockPlaying: false, clockStartTime: null });
      startAnalyser();
    };
    
    audio.onended = () => {
      if (rafId) cancelAnimationFrame(rafId);
      try { source?.disconnect(); analyser?.disconnect(); audioContext?.close(); } catch {}
      set({ audio: null, visemes: [], isPlaying: false, isClockPlaying: false, clockStartTime: null, amplitude: 0 });
    };

    audio.play();
    set({ audio, visemes });
  },
  playVisemesOnly: (visemes) => {
    const currentAudio = get().audio;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
    }
    const nowSeconds = Date.now() / 1000;
    set({ audio: null, visemes, isPlaying: true, startTime: nowSeconds, isClockPlaying: true, clockStartTime: nowSeconds, amplitude: 0.6 });
  },
  stopAudio: () => {
    const currentAudio = get().audio;
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch {}
      currentAudio.src = '';
    }
    // Collapse to a single state update
    set({ audio: null, visemes: [], isPlaying: false, isClockPlaying: false, clockStartTime: null, amplitude: 0 });
  }
}));
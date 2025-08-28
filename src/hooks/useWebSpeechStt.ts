'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Options = {
  languageCode?: string;
  continuous?: boolean;
  interimResults?: boolean;
  silenceMs?: number;
  silenceThreshold?: number;
  onAutoStop?: (finalTranscript: string) => void;
};

export function useWebSpeechStt(opts: Options = {}) {
  const { 
    languageCode = 'en-US', 
    continuous = true,
    interimResults = true,
    silenceMs = 10000, 
    silenceThreshold = 0.012, 
    onAutoStop 
  } = opts;
  
  const [isListening, setIsListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [finals, setFinals] = useState<string[]>([]);
  const [level, setLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const autoStopPendingRef = useRef(false);
  const partialRef = useRef(partial);
  const finalsRef = useRef<string[]>(finals);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const transcript = useMemo(() => {
    const finalText = finals.join(' ').trim();
    if (partial) return (finalText + ' ' + partial).trim();
    return finalText;
  }, [finals, partial]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  useEffect(() => { partialRef.current = partial; }, [partial]);
  useEffect(() => { finalsRef.current = finals; }, [finals]);

  const initializeSpeechRecognition = () => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[WebSpeechSTT] Speech Recognition not supported in this browser');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = languageCode;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('[WebSpeechSTT] Speech recognition started');
      setIsListening(true);
      lastVoiceAtRef.current = performance.now();
      autoStopPendingRef.current = false;
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setFinals(prev => [...prev, finalTranscript.trim()]);
        setPartial('');
        console.log('[WebSpeechSTT] Final transcript:', finalTranscript);
      }

      if (interimTranscript) {
        setPartial(interimTranscript);
        console.log('[WebSpeechSTT] Interim transcript:', interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[WebSpeechSTT] Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // This is normal, just means no speech was detected
        return;
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[WebSpeechSTT] Speech recognition ended');
      setIsListening(false);
    };

    return recognition;
  };

  async function start() {
    if (isListening) return;
    
    try {
      // Initialize speech recognition
      const recognition = initializeSpeechRecognition();
      if (!recognition) {
        throw new Error('Speech recognition not supported');
      }
      recognitionRef.current = recognition;

      // Get microphone stream for level monitoring
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      // Set up audio analysis for level detection
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      
      // Level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current || !isListening) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = average / 255;
        setLevel(normalizedLevel);
        
        if (normalizedLevel >= silenceThreshold) {
          lastVoiceAtRef.current = performance.now();
          autoStopPendingRef.current = false;
        }
        
        // Check for auto-stop
        if (silenceMs > 0 && performance.now() - lastVoiceAtRef.current >= silenceMs && !autoStopPendingRef.current) {
          autoStopPendingRef.current = true;
          const finalText = ((finalsRef.current && finalsRef.current.length ? finalsRef.current.join(' ') + ' ' : '') + (partialRef.current || '')).trim();
          Promise.resolve()
            .then(() => stop())
            .then(() => {
              if (onAutoStop) onAutoStop(finalText);
            })
            .catch(() => {});
        }
        
        if (isListening) {
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

      // Start speech recognition
      recognition.start();
      console.log('[WebSpeechSTT] Started listening');

    } catch (error) {
      console.error('[WebSpeechSTT] Failed to start:', error);
      throw error;
    }
  }

  async function stop() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.warn('[WebSpeechSTT] Error stopping recognition:', error);
      }
      recognitionRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    setIsListening(false);
    
    console.log('[WebSpeechSTT] Stopped listening');
  }

  const testAudio = async () => {
    console.log('[WebSpeechSTT] Testing audio pipeline...');
    if (!isListening) {
      await start();
    }
    console.log('[WebSpeechSTT] Audio test completed');
  };

  const clearTranscript = () => {
    setPartial('');
    setFinals([]);
  };

  return { 
    start, 
    stop, 
    isStreaming: isListening, 
    transcript, 
    partial, 
    finals, 
    level, 
    testAudio,
    clearTranscript 
  };
}

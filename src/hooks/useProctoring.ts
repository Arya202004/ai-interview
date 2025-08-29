'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SecurityViolation {
  id: string;
  type: 'camera' | 'audio';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: Date;
  details?: any;
}

export interface ProctoringState {
  isMonitoring: boolean;
  violations: SecurityViolation[];
  cameraStatus: 'idle' | 'analyzing' | 'error';
  audioStatus: 'idle' | 'analyzing' | 'error';
  lastAnalysis: Date | null;
}

export function useProctoring() {
  const [state, setState] = useState<ProctoringState>({
    isMonitoring: false,
    violations: [],
    cameraStatus: 'idle',
    audioStatus: 'idle',
    lastAnalysis: null,
  });

  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioViolation, setIsAudioViolation] = useState(false);
  
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const idCounterRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const analysisDelayMsRef = useRef<number>(5000);
  const isPageVisibleRef = useRef<boolean>(true);

  // Audio level monitoring
  const startAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      
      const monitorAudio = () => {
        if (!analyser) return;
        
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = Math.min(1, rms * 3);
        
        setAudioLevel(level);
        
        // Check for audio violations (background noise)
        const threshold = 0.8; // High noise threshold
        if (level > threshold && !isAudioViolation) {
          setIsAudioViolation(true);
          addViolation('audio', 'high', 'Excessive background noise detected');
        } else if (level <= threshold && isAudioViolation) {
          setIsAudioViolation(false);
        }
        
        animationFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();
    } catch (error) {
      console.error('Failed to start audio monitoring:', error);
      setState(prev => ({ ...prev, audioStatus: 'error' }));
    }
  }, [isAudioViolation]);

  // Camera monitoring using GCP Video Intelligence API
  const analyzeVideoFrame = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      setState(prev => ({ ...prev, cameraStatus: 'analyzing' }));
      
      // Create canvas to capture video frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      ctx.drawImage(videoElement, 0, 0);
      
      // Convert to blob for API call
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, 'image/jpeg', 0.8);
      });
      
      // Send to our API endpoint for GCP analysis
      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');
      
      const response = await fetch('/api/proctoring/analyze-frame', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        // Try to parse backend error details and surface as a violation instead of throwing
        let details: any = undefined;
        try {
          details = await response.json();
        } catch {}
        const message = (details && (details.error || details.details)) || 'Failed to analyze video frame';
        addViolation('camera', 'low', `Camera analysis error: ${message}`);
        // Backoff on errors to avoid exhausting API
        analysisDelayMsRef.current = Math.min(20000, Math.floor(analysisDelayMsRef.current * 1.5));
        setState(prev => ({ ...prev, cameraStatus: 'idle', lastAnalysis: new Date() }));
        return;
      }
      
      const result = await response.json();
      
      // Process violations
      if (result.violations && result.violations.length > 0) {
        result.violations.forEach((violation: any) => {
          addViolation('camera', violation.severity, violation.description, violation.details);
        });
      }
      
      // On success, gradually reduce delay (but keep reasonable floor)
      analysisDelayMsRef.current = Math.max(3000, Math.floor(analysisDelayMsRef.current * 0.9));
      setState(prev => ({ 
        ...prev, 
        cameraStatus: 'idle',
        lastAnalysis: new Date()
      }));
      
    } catch (error) {
      console.error('Video analysis failed:', error);
      addViolation('camera', 'low', 'Camera analysis failed');
      // Backoff
      analysisDelayMsRef.current = Math.min(20000, Math.floor(analysisDelayMsRef.current * 1.5));
      setState(prev => ({ ...prev, cameraStatus: 'error' }));
    }
  }, []);

  // Start camera monitoring
  const startCameraMonitoring = useCallback(async () => {
    try {
      // Check backend health (e.g., GCP credentials configured) before starting
      try {
        const healthRes = await fetch('/api/proctoring/health');
        if (healthRes.ok) {
          const health = await healthRes.json();
          if (!health?.gcp?.configured) {
            addViolation('camera', 'medium', 'GCP Video Intelligence not configured. Camera proctoring disabled.');
            setState(prev => ({ ...prev, cameraStatus: 'error' }));
            return;
          }
        }
      } catch {}

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      videoStreamRef.current = stream;
      
      // Set up adaptive consecutive analysis via timeout (not interval) for dynamic backoff
      const loop = () => {
        if (!videoStreamRef.current || !state.isMonitoring) return;
        if (!isPageVisibleRef.current) {
          // If tab hidden, postpone checks to reduce quota usage
          analysisTimeoutRef.current = setTimeout(loop, Math.max(10000, analysisDelayMsRef.current));
          return;
        }
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (videoElement && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          analyzeVideoFrame(videoElement).finally(() => {
            analysisTimeoutRef.current = setTimeout(loop, analysisDelayMsRef.current);
          });
        } else {
          analysisTimeoutRef.current = setTimeout(loop, Math.min(8000, analysisDelayMsRef.current));
        }
      };
      // Reset delay to a sensible starting value
      analysisDelayMsRef.current = 5000;
      loop();
      
    } catch (error) {
      console.error('Failed to start camera monitoring:', error);
      addViolation('camera', 'low', 'Failed to start camera monitoring');
      setState(prev => ({ ...prev, cameraStatus: 'error' }));
    }
  }, [analyzeVideoFrame, state.isMonitoring]);

  // Add security violation
  const addViolation = useCallback((type: 'camera' | 'audio', severity: 'low' | 'medium' | 'high', description: string, details?: any) => {
    // Generate a robust unique id to avoid duplicate keys in React lists
    const uniqueId = typeof crypto !== 'undefined' && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `${Date.now()}-${(idCounterRef.current = idCounterRef.current + 1)}-${type}`;

    const violation: SecurityViolation = {
      id: uniqueId,
      type,
      severity,
      description,
      timestamp: new Date(),
      details,
    };
    
    setState(prev => ({
      ...prev,
      violations: [...prev.violations, violation]
    }));
    
    // Log violation
    console.warn(`Security violation detected: ${description}`, violation);
    
    // You can add additional actions here like:
    // - Sending to backend for logging
    // - Triggering alerts
    // - Recording the violation
  }, []);

  // Start monitoring
  // Auto-start when permissions are granted or when getUserMedia is available
  const startMonitoring = useCallback(async () => {
    setState(prev => ({ ...prev, isMonitoring: true }));
    try {
      await startAudioMonitoring();
    } catch {}
    try {
      await startCameraMonitoring();
    } catch {}
  }, [startAudioMonitoring, startCameraMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }));
    
    // Stop audio monitoring
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Stop camera monitoring
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = null;
    }
    
    setAudioLevel(0);
    setIsAudioViolation(false);
  }, []);

  // Clear violations
  const clearViolations = useCallback(() => {
    setState(prev => ({ ...prev, violations: [] }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  // Observe page visibility to throttle checks when hidden
  useEffect(() => {
    const handleVisibility = () => {
      isPageVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Auto-start once user grants permissions (best-effort)
  useEffect(() => {
    let cancelled = false;
    const maybeStart = async () => {
      try {
        const camPerm = (navigator as any).permissions ? await (navigator as any).permissions.query({ name: 'camera' as any }) : null;
        const micPerm = (navigator as any).permissions ? await (navigator as any).permissions.query({ name: 'microphone' as any }) : null;
        const granted = (p: any) => p && (p.state === 'granted' || p.state === 'prompt');
        if (!cancelled && (granted(camPerm) || granted(micPerm))) {
          if (!state.isMonitoring) {
            startMonitoring();
          }
        }
        // Listen to future permission changes
        camPerm?.addEventListener?.('change', () => {
          if (!state.isMonitoring && camPerm.state === 'granted') startMonitoring();
        });
        micPerm?.addEventListener?.('change', () => {
          if (!state.isMonitoring && micPerm.state === 'granted') startMonitoring();
        });
      } catch {
        // Fall back: attempt to start; getUserMedia will prompt
        if (!cancelled && !state.isMonitoring) startMonitoring();
      }
    };
    maybeStart();
    return () => { cancelled = true; };
  }, [startMonitoring, state.isMonitoring]);

  return {
    ...state,
    audioLevel,
    isAudioViolation,
    startMonitoring,
    stopMonitoring,
    clearViolations,
    addViolation,
  };
}

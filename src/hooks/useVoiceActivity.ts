'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { MicVAD } from '@ricky0123/vad-web';

export function useVoiceActivity(onSpeechEnd: (audio: Blob) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const vadRef = useRef<MicVAD | null>(null);

  const start = useCallback(async () => {
    if (vadRef.current) return;
    
    try {
      // Prompt for microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the initial stream, VAD will request it again
      
      console.log("LOG: Microphone permission granted.");

      const vad = await MicVAD.new({
        onSpeechStart: () => {
          console.log("✅ LOG: Speech started.");
          setIsSpeaking(true);
        },
        onSpeechEnd: (audio) => {
          setIsSpeaking(false);
          const audioBlob = new Blob([audio], { type: 'audio/webm' });
          console.log(`✅ LOG: Speech ended. Audio captured with size: ${audioBlob.size} bytes.`);
          // This is the callback that sends the audio to the main page
          onSpeechEnd(audioBlob);
        },
        modelURL: new URL('/silero_vad.onnx', window.location.origin).toString(),
        workletURL: new URL('/vad.worklet.js', window.location.origin).toString(),
      });
      
      vad.start();
      vadRef.current = vad;
      setIsListening(true);
      console.log("LOG: VAD is now listening.");

    } catch (error) {
      console.error("❌ LOG: Failed to start voice activity detection:", error);
    }
  }, [onSpeechEnd]);
  
  const stop = useCallback(() => {
    if (vadRef.current) {
      console.log("LOG: Stopping VAD.");
      vadRef.current.destroy();
      vadRef.current = null;
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (vadRef.current) {
        vadRef.current.destroy();
      }
    };
  }, []);

  return { isListening, isSpeaking, start, stop };
}
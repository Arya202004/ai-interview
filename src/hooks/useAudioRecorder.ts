'use client';
import { useState, useRef } from 'react';
import OpusMediaRecorder from 'opus-media-recorder';

// Align paths with assets placed in /public (use OGG encoder which we ship)
const workerOptions = {
    encoderWorkerPath: '/encoderWorker.umd.js',
    OggOpusEncoderWasmPath: '/OggOpusEncoder.wasm',
};

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  // Give the ref the correct type instead of 'any'
  const mediaRecorderRef = useRef<OpusMediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer OpusMediaRecorder with OGG container (matches shipped OggOpusEncoder.wasm)
      const mediaRecorder = new OpusMediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' }, workerOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onerror = (e: unknown) => {
        console.error('[Recorder] OpusMediaRecorder error:', e);
      };
      mediaRecorder.start();
      setIsRecording(true);
      console.log('[Recorder] Recording started with OpusMediaRecorder (audio/ogg;codecs=opus).');
    } catch (error) {
      console.warn('[Recorder] Falling back to native MediaRecorder due to error:', error);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' : 'audio/webm;codecs=opus';
        const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
        // @ts-expect-error widen type for unified handling
        mediaRecorderRef.current = mediaRecorder as unknown as OpusMediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        mediaRecorder.start();
        setIsRecording(true);
        console.log('[Recorder] Recording started with native MediaRecorder (' + mime + ').');
      } catch (fallbackError) {
        console.error('[Recorder] Failed to start any recorder:', fallbackError);
      }
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
        resolve(null);
        return;
      }
      mediaRecorderRef.current.onstop = () => {
        // Determine type from first chunk if available, default to ogg
        const inferredType = audioChunksRef.current[0]?.type || 'audio/ogg';
        const audioBlob = new Blob(audioChunksRef.current, { type: inferredType });
        console.log('[Recorder] Recording stopped. Blob created with type:', inferredType, 'size (bytes):', audioBlob.size);
        mediaRecorderRef.current?.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        setIsRecording(false);
        resolve(audioBlob);
      };
      mediaRecorderRef.current.stop();
    });
  };

  return { isRecording, startRecording, stopRecording };
}
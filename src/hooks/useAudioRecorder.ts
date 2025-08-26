'use client';
import { useState, useRef } from 'react';

// Import the new recorder
import OpusMediaRecorder from 'opus-media-recorder';

// Path to the worker scripts in the /public folder
const workerOptions = {
    encoderWorkerPath: '/encoderWorker.umd.js',
    OggOpusEncoderWasmPath: '/OggOpusEncoder.wasm',
    WebMOpusEncoderWasmPath: '/WebMOpusEncoder.wasm',
};

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<any | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new OpusMediaRecorder(stream, { mimeType: 'audio/wav' }, workerOptions);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      console.log("LOG: Recording started with OpusMediaRecorder.");
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      // This check prevents the INVALID_STATE_ERR crash
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
        console.warn("LOG: Recorder was not in a recording state when stop was called.");
        resolve(null);
        return;
      }
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        console.log("LOG: Recording stopped. WAV blob created with size:", audioBlob.size);
        
        mediaRecorderRef.current?.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        
        setIsRecording(false);
        resolve(audioBlob);
      };
      
      mediaRecorderRef.current.stop();
    });
  };

  return { isRecording, startRecording, stopRecording };
}
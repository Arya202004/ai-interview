'use client';
import { useState, useRef } from 'react';
import OpusMediaRecorder from 'opus-media-recorder';

const workerOptions = {
    encoderWorkerPath: '/opus-media-recorder/encoderWorker.umd.js',
    OggOpusEncoderWasmPath: '/opus-media-recorder/OggOpusEncoder.wasm',
    WebMOpusEncoderWasmPath: '/opus-media-recorder/WebMOpusEncoder.wasm',
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
      const mediaRecorder = new OpusMediaRecorder(stream, { mimeType: 'audio/wav' }, workerOptions);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
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
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
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
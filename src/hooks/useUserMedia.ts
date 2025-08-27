'use client';

import { useState, useEffect, useRef } from 'react';

export function useUserMedia() {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const isStreamSet = useRef(false);

  useEffect(() => {
    if (isStreamSet.current) return;
    isStreamSet.current = true;

    let stream: MediaStream;
    const enableStream = async () => {
      try {
        // Only request video for the preview to avoid double mic capture.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        setMediaStream(stream);
      } catch (err) {
        console.error("[UserMedia] Error accessing media devices.", err);
      }
    };

    enableStream();

    // Cleanup function to stop the stream when the component unmounts
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream]);

  return mediaStream;
}
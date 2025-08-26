'use client';

import { useRef, useEffect } from 'react';
import { useUserMedia } from '@/hooks/useUserMedia';

export default function UserVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStream = useUserMedia();

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  return (
    <div className="w-full h-full bg-black rounded-xl">
      <video
        ref={videoRef}
        autoPlay
        muted // Mute your own video to prevent feedback
        playsInline
        className="w-full h-full object-cover rounded-xl scale-x-[-1]" // Flip video horizontally
      />
    </div>
  );
}
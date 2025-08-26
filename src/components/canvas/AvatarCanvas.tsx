'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the Experience component with SSR turned off
const Experience = dynamic(
  () => import('@/components/canvas/Experience'),
  { ssr: false }
);

export default function AvatarCanvas() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Experience />
    </Suspense>
  );
}
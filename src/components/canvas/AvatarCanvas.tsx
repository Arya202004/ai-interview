'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Experience = dynamic(
  () => import('@/components/canvas/Experience'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full w-full"><p className="text-gray-400">Loading Avatar...</p></div>
  }
);

export default function AvatarCanvas() {
  return (
    <Suspense fallback={null}>
      <Experience />
    </Suspense>
  );
}
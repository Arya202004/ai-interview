'use client'; 
import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useGLTF, Plane } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { useAvatarStore } from '@/store/avatarStore'; // Import the main store hook
// Temporary flag; keep disabled for normal viseme-driven sync
const TEST_HARDCODED = false;

// Map generic viseme blendshapes to this model's available targets
const blendshapeMap: { [key: string]: string } = {
  jawOpen: 'mouthOpen',
  mouthClose: 'mouthSmile', // fallback neutral
  mouthFunnel: 'mouthOpen',
  mouthPucker: 'mouthOpen',
  mouthSmile: 'mouthSmile',
};

function Model() {
  const { scene } = useGLTF('/avatar.glb');
  // Subscribe to individual fields to avoid creating new objects each render
  const isPlaying = useAvatarStore((state) => state.isPlaying);
  const visemes = useAvatarStore((state) => state.visemes);
  const audio = useAvatarStore((state) => state.audio);
  const isClockPlaying = useAvatarStore((state) => state.isClockPlaying);
  const clockStartTime = useAvatarStore((state) => state.clockStartTime);
  const amplitude = useAvatarStore((state) => state.amplitude);
  const headMesh = useRef<THREE.SkinnedMesh>();
  const eyeLeftRef = useRef<THREE.Object3D | null>(null);
  const eyeRightRef = useRef<THREE.Object3D | null>(null);
  const morphDictRef = useRef<{ [key: string]: number } | null>(null);
  const loggedMorphsRef = useRef(false);

  useEffect(() => {
    try {
      // Ensure morph targets are enabled on materials
      scene.traverse((obj) => {
        if ((obj as any).material) {
          const mat = (obj as any).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => { if (m && 'morphTargets' in m) m.morphTargets = true; });
          } else if ('morphTargets' in mat) {
            (mat as any).morphTargets = true;
          }
        }
      });

      const candidates: THREE.SkinnedMesh[] = [];
      scene.traverse((object) => {
        if (object instanceof THREE.SkinnedMesh && object.morphTargetDictionary) {
          candidates.push(object);
        }
        // Cache eye objects by name heuristics
        if (/EyeL|Eye_Left|LeftEye/i.test(object.name)) eyeLeftRef.current = object;
        if (/EyeR|Eye_Right|RightEye/i.test(object.name)) eyeRightRef.current = object;
      });
      const preferred = candidates.find(m => /Head/i.test(m.name)) || candidates.find(m => {
        const keys = Object.keys(m.morphTargetDictionary!);
        return keys.includes('mouthOpen') || keys.includes('mouthSmile');
      }) || candidates[0];
      if (preferred) {
        headMesh.current = preferred;
        morphDictRef.current = preferred.morphTargetDictionary as { [key: string]: number };
        if (!loggedMorphsRef.current) {
          loggedMorphsRef.current = true;
          console.info('[Avatar] Using mesh:', preferred.name || '(unnamed)');
          console.info('[Avatar] Available morph targets:', Object.keys(morphDictRef.current));
        }
      } else {
        console.warn('[Avatar] No SkinnedMesh with morph targets found.');
      }
    } catch (err) {
      console.error('[Avatar] Error during mesh setup:', err);
    }
  }, [scene]);

  useFrame((state) => {
    const mesh = headMesh.current;
    if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
        return;
    }

    // Reset all blendshapes to 0
    Object.keys(mesh.morphTargetDictionary).forEach(key => {
        const index = mesh.morphTargetDictionary![key];
        mesh.morphTargetInfluences![index] = 0;
    });
    // Some three versions require updating morph targets map explicitly
    // Use optional chaining to avoid errors in versions where it's absent
    (mesh as any).updateMorphTargets?.();

    // Eye behavior: only subtle saccades if eye nodes are present. Do not touch eyelid morphs.
    const tEye = state.clock.getElapsedTime();
    const yaw = Math.sin(tEye * 0.7) * 0.02;
    const pitch = Math.sin(tEye * 0.9 + 1.2) * 0.02;
    if (eyeLeftRef.current) {
      eyeLeftRef.current.rotation.y = yaw;
      eyeLeftRef.current.rotation.x = pitch;
    }
    if (eyeRightRef.current) {
      eyeRightRef.current.rotation.y = yaw;
      eyeRightRef.current.rotation.x = pitch;
    }

    if (TEST_HARDCODED) {
      const dict = morphDictRef.current || mesh.morphTargetDictionary;
      const openIndex = dict['mouthOpen'];
      const smileIndex = dict['mouthSmile'];
      const t = state.clock.getElapsedTime();
      const openValue = (Math.sin(t * 2.2) + 1) * 0.5; // 0..1
      if (openIndex !== undefined) {
        mesh.morphTargetInfluences[openIndex] = openValue;
      }
      if (smileIndex !== undefined) {
        mesh.morphTargetInfluences[smileIndex] = 0.0;
      }
      return;
    }

    if (!isPlaying) {
      // Subtle idle motion using mouthOpen
      const dict = morphDictRef.current || mesh.morphTargetDictionary;
      const openIndex = dict['mouthOpen'];
      if (openIndex !== undefined) {
        const t = state.clock.getElapsedTime();
        const v = (Math.sin(t * 1.6) + 1) * 0.12; // 0..0.24
        mesh.morphTargetInfluences[openIndex] = v;
      }
      const smileIndex = (morphDictRef.current || mesh.morphTargetDictionary)['mouthSmile'];
      if (smileIndex !== undefined) {
        mesh.morphTargetInfluences[smileIndex] = 0.08; // light neutral smile
      }
      return;
    }

    // Determine current playback time: prefer audio element, fallback to logical clock
    let currentTime = 0;
    if (audio) {
      currentTime = audio.currentTime;
    } else if (isClockPlaying && clockStartTime !== null) {
      currentTime = (Date.now() / 1000) - clockStartTime;
    }
    const currentViseme = visemes.find((v, i) => {
      const nextTime = visemes[i + 1]?.time ?? (v.time + (v.duration ?? 0.1));
      return currentTime >= v.time && currentTime < nextTime;
    });

    if (currentViseme) {
        // Resolve blendshape index with heuristics if exact name is missing
        const dict = morphDictRef.current || mesh.morphTargetDictionary;
        const desired = blendshapeMap[currentViseme.shape] || 'mouthOpen';
        let index = dict[desired];
        if (index === undefined) {
          const keys = Object.keys(dict);
          const pick = (r: RegExp) => keys.find(k => r.test(k));
          if (/jawOpen|open/i.test(desired)) {
            const candidate = pick(/(jaw.*open|mouth.*open|open)/i);
            if (candidate) index = dict[candidate];
          } else if (/smile/i.test(desired)) {
            const candidate = pick(/smile|grin/i);
            if (candidate) index = dict[candidate];
          } else if (/pucker/i.test(desired)) {
            const candidate = pick(/pucker|kiss|oo|round/i);
            if (candidate) index = dict[candidate];
          } else if (/funnel/i.test(desired)) {
            const candidate = pick(/funnel|round|oo/i);
            if (candidate) index = dict[candidate];
          } else {
            const candidate = pick(/close|rest/i);
            if (candidate) index = dict[candidate];
          }
        }
        if (index !== undefined) {
          // Use viseme weight * amplitude multiplier for realism
          const w = Math.min(1, Math.max(0, (currentViseme.weight ?? 1) * (0.6 + amplitude * 0.6)));
          mesh.morphTargetInfluences[index] = w;
        }
    }
  });

  return <primitive object={scene} scale={1.65} position-y={-1.05} />;
}


export default function Experience() {
  const backgroundTexture = useLoader(TextureLoader, '/office-background.jpg');
  return (
    <Canvas camera={{ position: [0, -0.2, 2.8], fov: 10 }}> 
      <ambientLight intensity={1.5} />
      <directionalLight 
        intensity={3}
        position={[3, 2, 5]}
      />
      <Plane args={[15, 10]} position={[0, 0, -3]}>
        <meshStandardMaterial map={backgroundTexture} />
      </Plane>
      {/* Micro head motion rig */}
      <Model />
      {/* OrbitControls have been removed to lock the camera */}
    </Canvas>
  );
}

useGLTF.preload('/avatar.glb');
useLoader.preload(TextureLoader, '/office-background.jpg'); 
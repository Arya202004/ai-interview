'use client'; 

import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, useGLTF, Plane } from '@react-three/drei';
import { TextureLoader } from 'three';

function Model() {
  const { scene } = useGLTF('/avatar.glb');
  // Adjusted scale and position-y to show more of the face
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
        castShadow
      />
      
      <Plane args={[15, 10]} position={[0, 0, -3]}>
        <meshStandardMaterial map={backgroundTexture} />
      </Plane>

      <Model />
      
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        minAzimuthAngle={-Math.PI / 16} 
        maxAzimuthAngle={Math.PI / 16}
        minPolarAngle={Math.PI / 2 - 0.1} 
        maxPolarAngle={Math.PI / 2 + 0.1}
      />
    </Canvas>
  );
}

useGLTF.preload('/avatar.glb');
useLoader.preload(TextureLoader, '/office-background.jpg');
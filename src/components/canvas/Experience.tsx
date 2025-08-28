'use client'; 
import { Canvas, useLoader } from '@react-three/fiber';
import { Suspense } from 'react';
import { Environment, useGLTF } from '@react-three/drei';
import { TextureLoader } from 'three';

function AvatarModel() {
	const gltf = useGLTF('/avatar.glb');
	return <primitive object={gltf.scene} position={[0, -5.3, 0]} scale={[3.2, 3.2, 3.2]} />;
}

export default function Experience() {
	const bgTexture = useLoader(TextureLoader, '/office-background.jpg');
	return (
		<Canvas camera={{ position: [0, 0.1, 3.2], fov: 28 }}>
			<ambientLight intensity={0.6} />
			<directionalLight position={[2, 3, 5]} intensity={0.8} />
			<Suspense fallback={null}>
				<Environment preset="city" />
				{/* Background image plane */}
				<mesh position={[0, 0, -1.2]}>
					<planeGeometry args={[6, 3.5]} />
					<meshBasicMaterial map={bgTexture} />
				</mesh>
				<AvatarModel />
			</Suspense>
		</Canvas>
	);
}

useGLTF.preload('/avatar.glb'); 
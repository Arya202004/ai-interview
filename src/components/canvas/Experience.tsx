'use client'; 
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Environment, useGLTF } from '@react-three/drei';
import { Group, Mesh, SkinnedMesh, TextureLoader } from 'three';
import { useAvatarStore } from '@/store/avatarStore';

type MorphTargetBinding = {
	mesh: Mesh | SkinnedMesh;
	index: number;
};

type BoneBinding = {
	bone: any;
	originalRotation: { x: number; y: number; z: number };
	originalPosition: { x: number; y: number; z: number };
};

function AvatarModel() {
	const gltf = useGLTF('/avatar.glb');
	const rootRef = useRef<Group>(null);

	// Global state driving lipsync
	const visemes = useAvatarStore((s) => s.visemes);
	const isPlaying = useAvatarStore((s) => s.isPlaying);
	const startTime = useAvatarStore((s) => s.startTime);
	const isClockPlaying = useAvatarStore((s) => s.isClockPlaying);
	const amplitude = useAvatarStore((s) => s.amplitude);

	// Debug: Log GLB structure on first load
	useEffect(() => {
		console.log('=== GLB Structure Analysis ===');
		console.log('Scene:', gltf.scene);
		
		// Analyze all objects in the scene
		const analysis = {
			meshes: [] as any[],
			morphTargets: [] as any[],
			bones: [] as any[],
			animations: [] as any[],
			sceneGraph: {} as any
		};

		gltf.scene.traverse((obj) => {
			console.log('Object:', obj.name, obj.type, obj);
			
			if (obj.type === 'Mesh' || obj.type === 'SkinnedMesh') {
				const mesh = obj as Mesh | SkinnedMesh;
				analysis.meshes.push({
					name: obj.name,
					type: obj.type,
					geometry: mesh.geometry,
					material: mesh.material,
					morphTargetDictionary: (mesh as any).morphTargetDictionary,
					morphTargetInfluences: (mesh as any).morphTargetInfluences,
					position: obj.position,
					rotation: obj.rotation,
					scale: obj.scale
				});

				// Check for morph targets
				if ((mesh as any).morphTargetDictionary) {
					console.log('Morph Targets for', obj.name, ':', (mesh as any).morphTargetDictionary);
					analysis.morphTargets.push({
						meshName: obj.name,
						dictionary: (mesh as any).morphTargetDictionary,
						influences: (mesh as any).morphTargetInfluences
					});
				}

				// Check for bones/skeleton
				if ((mesh as any).skeleton) {
					console.log('Skeleton for', obj.name, ':', (mesh as any).skeleton);
					analysis.bones.push({
						meshName: obj.name,
						skeleton: (mesh as any).skeleton
					});
				}
			}

			// Check for bone objects
			if (obj.type === 'Bone' || obj.name.toLowerCase().includes('bone')) {
				analysis.bones.push({
					name: obj.name,
					type: obj.type,
					position: obj.position,
					rotation: obj.rotation,
					scale: obj.scale
				});
			}
		});

		// Check for animations
		if (gltf.animations && gltf.animations.length > 0) {
			console.log('Animations:', gltf.animations);
			analysis.animations = gltf.animations;
		}

		console.log('=== Complete Analysis ===', analysis);
		
		// Store analysis for use in animation and make it globally accessible
		(window as any).glbAnalysis = analysis;
		
		// Also log a summary for easy reference
		console.log('=== SUMMARY ===');
		console.log('Available Morph Targets:', analysis.morphTargets.map(m => `${m.meshName}: ${Object.keys(m.dictionary || {}).join(', ')}`));
		console.log('Available Bones:', analysis.bones.map(b => b.name || b.meshName));
		console.log('Available Animations:', analysis.animations.map(a => a.name));
		console.log('=== END SUMMARY ===');
		
		// Show a brief on-screen message
		setTimeout(() => {
			const morphCount = analysis.morphTargets.reduce((sum, m) => sum + Object.keys(m.dictionary || {}).length, 0);
			const boneCount = analysis.bones.length;
			const animCount = analysis.animations.length;
			console.log(`Avatar loaded with ${morphCount} morph targets, ${boneCount} bones, ${animCount} animations`);
		}, 1000);
	}, [gltf]);

	// Enhanced names based on common GLB patterns
	const mouthOpenNames = useMemo(() => [
		'mouthOpen', 'jawOpen', 'jaw_open', 'mouth_open', 'open', 'jaw',
		'Basis', 'mouthOpen', 'mouthSmile' // From your specified shape keys
	], []);
	
	const smileNames = useMemo(() => [
		'mouthSmile', 'smile', 'mouth_smile', 'grin', 'happy'
	], []);
	
	const blinkNames = useMemo(() => [
		'blink', 'Blink', 'eyeBlink', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed',
		'eye_blink', 'blink_left', 'blink_right', 'close_eyes'
	], []);

	// Eye movement names - using the specific bones from your scene
	const eyeNames = useMemo(() => [
		'LeftEye', 'RightEye', // Your specific eye bones
		'EyeLeft', 'EyeRight', 'eye_left', 'eye_right', 'left_eye', 'right_eye',
		'Bone', 'Bone.001', 'Bone.002' // Common bone naming patterns
	], []);

	// Head and neck bones for natural movement during speech
	const _headBoneNames = useMemo(() => [
		'Head', 'Neck', 'Spine2' // Your specific head/neck bones
	], []);

	// Enhanced bone collection for more realistic movement
	const enhancedBoneMap = useMemo(() => {
		const map = new Map<string, BoneBinding>();
		gltf.scene.traverse((obj) => {
			// Look for specific bones from your scene structure
			if (obj.name === 'LeftEye' || obj.name === 'RightEye' || 
				obj.name === 'Head' || obj.name === 'Neck' || obj.name === 'Spine2' ||
				obj.name.toLowerCase().includes('eye') || 
				obj.name.toLowerCase().includes('bone') ||
				obj.type === 'Bone') {
				map.set(obj.name, {
					bone: obj,
					originalRotation: { 
						x: obj.rotation.x, 
						y: obj.rotation.y, 
						z: obj.rotation.z 
					},
					originalPosition: {
						x: obj.position.x,
						y: obj.position.y,
						z: obj.position.z
					}
				});
			}
		});
		return map;
	}, [gltf.scene]);

	// Enhanced morph target detection for better lip sync
	const enhancedMorphMap = useMemo(() => {
		const map = new Map<string, MorphTargetBinding[]>();
		gltf.scene.traverse((obj) => {
			const mesh = obj as Mesh | SkinnedMesh;
			const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
			const inf = (mesh as any).morphTargetInfluences as number[] | undefined;
			if (dict && inf) {
				Object.entries(dict).forEach(([name, idx]) => {
					const list = map.get(name) || [];
					list.push({ mesh, index: idx });
					map.set(name, list);
				});
			}
		});
		return map;
	}, [gltf.scene]);

	// Enhanced bone rotation with position support
	const rotateBone = (name: string, x: number, y: number, z: number, usePosition = false) => {
		const binding = enhancedBoneMap.get(name);
		if (!binding) return;
		const { bone, originalRotation, originalPosition } = binding;
		
		if (usePosition && originalPosition) {
			// Use position for more dramatic effects
			bone.position.x = originalPosition.x + x * 0.1;
			bone.position.y = originalPosition.y + y * 0.1;
			bone.position.z = originalPosition.z + z * 0.1;
		} else {
			// Use rotation for subtle effects
			bone.rotation.x = originalRotation.x + x;
			bone.rotation.y = originalRotation.y + y;
			bone.rotation.z = originalRotation.z + z;
		}
	};

	// Enhanced morph target application with amplification
	const setMorph = (name: string, weight: number, amplification = 1.0) => {
		const bindings = enhancedMorphMap.get(name);
		if (!bindings) return;
		for (const { mesh, index } of bindings) {
			const influences = (mesh as any).morphTargetInfluences as number[] | undefined;
			if (influences) {
				// Amplify the weight for more visible movement
				const amplifiedWeight = Math.min(1.0, weight * amplification);
				influences[index] = amplifiedWeight;
			}
		}
	};

	// Blink state
	const [blinkT, setBlinkT] = useState(0);
	const blinkTimer = useRef(0);
	const nextBlinkAt = useRef(0);

	useEffect(() => {
		// Randomize next blink in 2.5–5.5s
		const rand = () => 2.5 + Math.random() * 3.0;
		nextBlinkAt.current = rand();
		blinkTimer.current = 0;
	}, []);

	// Per-frame update
	useFrame((_, delta) => {
		// Procedural blinking
		blinkTimer.current += delta;
		if (blinkTimer.current >= nextBlinkAt.current) {
			// Blink curve ~120ms close-open
			const duration = 0.12;
			const t = (blinkTimer.current - nextBlinkAt.current) / duration;
			const w = t < 0.5 ? (t / 0.5) : Math.max(0, 1 - (t - 0.5) / 0.5);
			setBlinkT(Math.max(0, Math.min(1, w)));
			if (t >= 1) {
				// schedule next blink and reset
				blinkTimer.current = 0;
				nextBlinkAt.current = 2.5 + Math.random() * 3.0;
				setBlinkT(0);
			}
		} else {
			setBlinkT(0);
		}

		// Enhanced blinking using specific eye bones from your scene
		let blinkApplied = false;
		
		// Try morph targets first
		for (const name of blinkNames) {
			if (enhancedMorphMap.has(name)) {
				setMorph(name, blinkT, 1.2); // Amplify blink effect
				blinkApplied = true;
			}
		}

		// Enhanced bone-based blinking using your specific eye bones
		if (!blinkApplied) {
			// Use the specific eye bones from your scene structure
			const leftEye = enhancedBoneMap.get('LeftEye');
			const rightEye = enhancedBoneMap.get('RightEye');
			
			if (leftEye && rightEye) {
				// More pronounced blink rotation for visibility
				const blinkRotation = blinkT * 0.8; // Much more visible blink
				const eyeClose = blinkT * 0.6;      // Eye closing effect
				
				// Rotate both eyes down for blink effect
				rotateBone('LeftEye', blinkRotation, 0, 0);
				rotateBone('RightEye', blinkRotation, 0, 0);
				
				// Add subtle eye squinting for more realistic blink
				rotateBone('LeftEye', 0, eyeClose * 0.3, 0);
				rotateBone('RightEye', 0, eyeClose * 0.3, 0);
			} else {
				// Fallback to generic eye bones
				for (const name of eyeNames) {
					if (enhancedBoneMap.has(name)) {
						const blinkRotation = blinkT * 0.5;
						rotateBone(name, blinkRotation, 0, 0);
					}
				}
			}
		}

		// Enhanced Lipsync weights with amplification for more visible movement
		let targetMouthOpen = 0;
		let targetSmile = 0;
		let targetJawOpen = 0;

		if (isPlaying) {
			if (isClockPlaying && visemes.length > 0) {
				const now = Date.now() / 1000;
				const t = now - startTime;
				// Find active viseme
				let current = visemes[0];
				for (let i = 0; i < visemes.length; i++) {
					const v = visemes[i] as any;
					const end = (v.time ?? 0) + (v.duration ?? 0.08);
					if (t >= (v.time ?? 0) && t < end) { current = v; break; }
				}
				const shape = (current?.shape || 'mouthClose').toLowerCase();
				const w = Math.min(1, Math.max(0, current?.weight ?? 0.6));
				
				// Enhanced shape detection with amplification
				if (shape.includes('jawopen') || shape.includes('open')) {
					targetMouthOpen = w * 1.5; // Amplify mouth opening
					targetJawOpen = w * 1.3;   // Amplify jaw movement
				} else if (shape.includes('smile')) {
					targetSmile = w * 1.4;     // Amplify smile
				} else if (shape.includes('close')) { 
					targetMouthOpen = 0; 
					targetSmile = 0; 
					targetJawOpen = 0;
				} else if (shape.includes('funnel') || shape.includes('pucker')) { 
					targetMouthOpen = w * 0.8; 
					targetJawOpen = w * 0.6;
				}
			} else {
				// Drive with audio amplitude if available - amplified for visibility
				const amp = Math.pow(Math.min(1, Math.max(0, amplitude)), 0.6);
				targetMouthOpen = amp * 1.8;  // Much more visible mouth opening
				targetJawOpen = amp * 1.5;    // Pronounced jaw movement
				targetSmile = Math.max(0, amplitude - 0.3) * 0.8; // Enhanced smile
			}
		} else {
			targetMouthOpen = 0;
			targetSmile = 0;
			targetJawOpen = 0;
		}

		// Smoothly approach target values with faster response
		const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

		// Read current value from first available binding
		const readMorph = (name: string): number | null => {
			const bindings = enhancedMorphMap.get(name);
			if (!bindings || bindings.length === 0) return null;
			const inf = (bindings[0].mesh as any).morphTargetInfluences as number[];
			return inf ? inf[bindings[0].index] : null;
		};

		// Apply to any known names present with amplification
		const applyForNames = (names: string[], value: number, amplification = 1.0) => {
			for (const n of names) if (enhancedMorphMap.has(n)) setMorph(n, value, amplification);
		};

		const currentOpen = mouthOpenNames.map(readMorph).find((v) => v != null) ?? 0;
		const currentSmile = smileNames.map(readMorph).find((v) => v != null) ?? 0;

		// Faster response for more dynamic movement
		const newOpen = lerp(currentOpen as number, targetMouthOpen, 0.4);
		const newSmile = lerp(currentSmile as number, targetSmile, 0.35);
		const newJawOpen = lerp(currentOpen as number, targetJawOpen, 0.4);

		// Apply with different amplifications for different effects
		applyForNames(mouthOpenNames, newOpen, 1.2);      // Mouth opening
		applyForNames(smileNames, newSmile, 1.1);         // Smile
		applyForNames(['jawOpen', 'jaw_open'], newJawOpen, 1.3); // Jaw movement

		// Add natural head movement during speech for realism
		if (isPlaying && (targetMouthOpen > 0.1 || targetSmile > 0.1)) {
			const time = Date.now() * 0.001;
			const headBob = Math.sin(time * 3) * 0.02; // Subtle head bobbing
			const neckTilt = Math.sin(time * 2) * 0.015; // Gentle neck movement
			
			// Apply to head and neck bones
			rotateBone('Head', headBob, neckTilt, 0);
			rotateBone('Neck', headBob * 0.5, neckTilt * 0.7, 0);
		}

		// Enhanced eye movement using specific eye bones for more realistic movement
		const time = Date.now() * 0.001;
		
		// Use specific eye bones from your scene for more realistic movement
		const leftEye = enhancedBoneMap.get('LeftEye');
		const rightEye = enhancedBoneMap.get('RightEye');
		
		if (leftEye && rightEye) {
			// More pronounced eye movement for visibility
			const eyeWanderX = Math.sin(time * 0.3) * 0.04;  // Horizontal eye movement
			const eyeWanderY = Math.sin(time * 0.4) * 0.03;  // Vertical eye movement
			const eyeBlink = Math.sin(time * 0.15) * 0.02;   // Subtle eye twitch
			
			// Apply to left eye
			rotateBone('LeftEye', eyeWanderX * 0.8, eyeWanderY * 0.8, eyeBlink);
			
			// Apply to right eye with slight variation for natural look
			rotateBone('RightEye', eyeWanderX * 0.9, eyeWanderY * 0.9, eyeBlink * 0.7);
			
			// Add subtle head movement that follows eye movement
			const headFollowX = eyeWanderX * 0.3;
			const headFollowY = eyeWanderY * 0.2;
			rotateBone('Head', headFollowX, headFollowY, 0);
		} else {
			// Fallback to generic eye bones
			for (const name of eyeNames) {
				if (enhancedBoneMap.has(name)) {
					const eyeWander = Math.sin(time * 0.5) * 0.03;
					const eyeBlink = Math.sin(time * 0.1) * 0.015;
					rotateBone(name, eyeWander, eyeBlink, 0);
				}
			}
		}
	});

	return (
		<primitive ref={rootRef} object={gltf.scene} position={[0, -5.3, 0]} scale={[3.2, 3.2, 3.2]} />
	);
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

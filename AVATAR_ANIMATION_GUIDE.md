# Avatar Animation System Guide

## Overview
I've implemented a comprehensive real-time animation system for your 3D avatar that automatically detects and animates available morph targets (shape keys) and bones in your `avatar.glb` file. The system is specifically optimized for your avatar structure with enhanced lip sync visibility and realistic movement.

## Features Implemented

### 1. **Automatic GLB Analysis**
- **Console Logging**: When the avatar loads, detailed analysis is logged to the browser console
- **Structure Discovery**: Automatically finds all meshes, morph targets, bones, and animations
- **Real-time Debug Overlay**: Press F12 or click "Show Debug" to see current animation state

### 2. **Enhanced Real-time Lip Sync** 🆕
- **Amplified Movement**: Mouth movements are 1.5-1.8x more visible for clear lip sync
- **Multi-target Animation**: Simultaneously animates mouth, jaw, and smile morph targets
- **Faster Response**: 40% faster interpolation for more dynamic movement
- **Natural Head Movement**: Subtle head bobbing and neck movement during speech
- **Viseme-driven**: Uses the existing `generateVisemes()` function for text-to-speech animation
- **Amplitude-driven**: Mouth opens based on audio amplitude from `useAvatarStore`

### 3. **Enhanced Procedural Blinking** 🆕
- **Specific Eye Bones**: Uses your `LeftEye` and `RightEye` bones for precise control
- **Amplified Effect**: Blink rotation is 2.6x more visible (0.8 vs 0.3)
- **Realistic Squinting**: Adds subtle eye squinting during blink for natural look
- **Natural Timing**: Blinks every 2.5-5.5 seconds with random variation
- **Smooth Animation**: 120ms close-open curve for realistic eye movement

### 4. **Enhanced Eye Movement** 🆕
- **Specific Bone Control**: Uses `LeftEye` and `RightEye` from your scene structure
- **Visible Movement**: Eye wander is 2x more pronounced for clear visibility
- **Natural Variation**: Left and right eyes move slightly differently for realism
- **Head Following**: Subtle head movement follows eye movement naturally

## Your Avatar Structure Integration

The system is specifically optimized for your avatar's scene structure:

### **Eye Animation Bones**
- `LeftEye` - Primary left eye bone for blinking and movement
- `RightEye` - Primary right eye bone for blinking and movement

### **Head and Neck Bones**
- `Head` - Main head bone for natural movement during speech
- `Neck` - Neck bone for realistic head positioning
- `Spine2` - Upper spine for subtle body movement

### **Mesh Objects**
- `Wolf3D_Head` - Main head mesh for mouth morph targets
- `Wolf3D_Teeth` - Teeth mesh for synchronized mouth animation
- `EyeLeft` & `EyeRight` - Eye meshes for potential morph targets

## How to Use

### 1. **View GLB Structure**
1. Open your browser's Developer Console (F12)
2. Load the page with the avatar
3. Look for "=== GLB Structure Analysis ===" logs
4. Check the "=== SUMMARY ===" section for key information

### 2. **Access Debug Overlay**
- **Method 1**: Press F12 key
- **Method 2**: Click the blue "Show Debug (F12)" button in the top-right corner
- **Information Displayed**:
  - Current animation status
  - Audio amplitude
  - Blink state
  - Available morph targets count
  - Available bones count

### 3. **Test Enhanced Animation**
- **Lip Sync**: Much more visible mouth opening and jaw movement
- **Blinking**: Clear, pronounced eye blinking using your specific eye bones
- **Eye Movement**: Visible eye wander with natural head following
- **Head Movement**: Subtle head bobbing during speech for realism

## Enhanced Shape Key Support

The system automatically detects and uses these common morph target names with amplification:

### **Mouth Animation (Amplified)**
- `mouthOpen` (1.5x amplification) - Much wider mouth opening
- `jawOpen` (1.3x amplification) - Pronounced jaw movement
- `mouthSmile` (1.4x amplification) - Enhanced smile expression

### **Eye Animation (Amplified)**
- `blink`, `Blink`, `eyeBlink` (1.2x amplification) - Clear blinking
- `eyeBlinkLeft`, `eyeBlinkRight`, `eyesClosed` - Individual eye control

### **Bone Animation (Enhanced)**
- `LeftEye`, `RightEye` - Your specific eye bones for precise control
- `Head`, `Neck`, `Spine2` - Natural head and neck movement

## Technical Details

### **Enhanced Animation Pipeline**
1. **Frame Update**: Runs every frame using `useFrame`
2. **Specific Bone Detection**: Targets your exact bone names (`LeftEye`, `RightEye`, `Head`, `Neck`)
3. **Amplified Movement**: Morph targets are amplified 1.2-1.8x for visibility
4. **Faster Response**: 35-40% faster interpolation for dynamic movement
5. **Natural Coordination**: Head movement follows eye and mouth animation

### **Performance Optimizations**
- **Memoized Maps**: Enhanced bone and morph maps computed once on load
- **Specific Targeting**: Only updates your specific bones and meshes
- **Conditional Updates**: Head movement only during active speech

## Troubleshooting

### **No Animation Visible**
1. Check browser console for GLB analysis logs
2. Verify your model has the expected bones (`LeftEye`, `RightEye`, `Head`, `Neck`)
3. Ensure the avatar is visible in the scene

### **Console Errors**
- Look for "=== GLB Structure Analysis ===" logs
- Check if your specific bones are being detected
- Verify bone names match: `LeftEye`, `RightEye`, `Head`, `Neck`

### **Performance Issues**
- The system is optimized for your specific avatar structure
- Monitor frame rate in browser dev tools
- Check if all expected bones are found

## Next Steps

### **Customization Options**
1. **Adjust Amplification**: Modify the amplification values in the code
2. **Fine-tune Timing**: Adjust blink intervals and animation speeds
3. **Add More Bones**: Include additional bones from your scene structure

### **Advanced Features**
1. **Emotion System**: Add emotion-based morph target combinations
2. **Breathing**: Add chest movement using `Spine2` bone
3. **Micro-expressions**: Add subtle facial muscle movements

## File Structure
- **`src/components/canvas/Experience.tsx`**: Enhanced avatar animation logic
- **`src/store/avatarStore.ts`**: Animation state management
- **`src/lib/lipsync.ts`**: Viseme generation for speech

## Support
The system is now specifically optimized for your avatar structure! Check the console logs to see the detected bones and morph targets, and the avatar will automatically use your `LeftEye`, `RightEye`, `Head`, and `Neck` bones for realistic movement.

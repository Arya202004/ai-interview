
# AI Interview Assistant

A professional AI-powered interview application featuring real-time 3D avatar interactions, speech-to-text transcription, and intelligent question management.

## 🚀 Features

- **3D Avatar Interviewer**: Lifelike 3D avatar with lip-sync and facial animations
- **Real-time Speech Recognition**: Web Speech API for instant transcription
- **Intelligent Question Flow**: Dynamic interview progression with role-based questions
- **Professional UI**: Clean, responsive interface with transcript history
- **Export Capabilities**: Download interview transcripts in TXT/JSON formats
- **Device Testing**: Built-in microphone and camera validation

## 🏗️ Architecture

### Frontend
- **Framework**: Next.js 15 with TypeScript
- **3D Graphics**: React Three Fiber + Drei
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Audio Processing**: Web Audio API

### Backend
- **API Routes**: Next.js API routes for TTS and question generation
- **TTS Service**: Google Cloud Text-to-Speech (Indian male voice)
- **AI Integration**: Google Gemini for question generation and feedback
- **STT Backend**: Web Speech API (primary), with unified session management

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API endpoints
│   │   ├── chat/          # Gemini chat integration
│   │   ├── gemini-audio/  # Audio transcription
│   │   ├── gemini-text/   # Text-based AI responses
│   │   ├── health/        # Service health checks
│   │   ├── stt/           # Speech-to-text endpoints
│   │   └── tts/           # Text-to-speech endpoints
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main interview interface
├── components/             # React components
│   ├── canvas/            # 3D rendering components
│   │   ├── AvatarCanvas.tsx    # Avatar wrapper
│   │   └── Experience.tsx      # 3D scene setup
│   └── UserVideo.tsx      # Camera feed component
├── hooks/                  # Custom React hooks
│   └── useWebSpeechStt.ts      # Web Speech API hook
├── lib/                    # Utility libraries
│   ├── lipsync.ts              # Viseme generation
│   └── unifiedSttSession.ts    # STT session management
├── store/                  # State management
│   └── avatarStore.ts          # Avatar state and audio
└── types/                  # TypeScript definitions
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google Cloud Platform account (for TTS)
- Google AI Studio account (for Gemini)

### 1. Clone & Install
```bash
git clone <repository-url>
cd my-avatar-assistant
npm install
```

### 2. Environment Configuration
Create `.env.local` in the root directory:

```env
# Google Cloud TTS
GOOGLE_TTS_API_KEY=your_google_tts_api_key
GOOGLE_TTS_PROJECT_ID=your_project_id

# Google AI Studio (Gemini)
GOOGLE_AI_API_KEY=your_gemini_api_key

# STT Configuration
STT_BACKEND=webspeech  # Options: webspeech, opus, whisper, google
```

### 3. Google Cloud Setup

#### Text-to-Speech API
1. Enable Cloud Text-to-Speech API
2. Create service account and download JSON key
3. Set `GOOGLE_TTS_API_KEY` in environment

#### Gemini AI
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create API key
3. Set `GOOGLE_AI_API_KEY` in environment

### 4. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to start the interview.

## 🔧 Configuration

### STT Backend Selection
Set `STT_BACKEND` in `.env.local`:

- **`webspeech`** (Default): Browser-native Web Speech API
- **`opus`**: Opus Media Recorder with local processing
- **`whisper`**: OpenAI Whisper API integration
- **`google`**: Google Cloud Speech-to-Text

### Avatar Customization
Edit `src/components/canvas/Experience.tsx`:

```typescript
// Avatar positioning and scaling
return <primitive 
  object={gltf.scene} 
  position={[0, -5.3, 0]}     // [x, y, z]
  scale={[3.2, 3.2, 3.2]}    // [width, height, depth]
/>;

// Camera settings
<Canvas camera={{ 
  position: [0, 0.1, 3.2],   // [x, y, z]
  fov: 28                     // Field of view
}}>
```

### Background Image
Replace `public/office-background.jpg` with your preferred background.

## 🎯 Usage

### Interview Flow
1. **Welcome**: Enter your name
2. **Role Selection**: Choose interview role (Python Dev, Data Scientist, etc.)
3. **Device Check**: Test microphone and camera
4. **Interview**: Answer questions with real-time transcription
5. **Feedback**: Receive AI-generated interview feedback

### Controls
- **Start/Stop**: Control speech recognition
- **Expand/Collapse**: View full question/answer text
- **Export**: Download transcript history
- **Re-record**: Retry answers if needed

### Keyboard Shortcuts
- `Space`: Toggle recording (when available)
- `Enter`: Submit answers

## 🔍 Troubleshooting

### Common Issues

#### Avatar Not Visible
- Check browser WebGL support
- Verify `avatar.glb` file exists in `public/`
- Adjust camera position in `Experience.tsx`

#### TTS Not Working
- Verify Google Cloud TTS API is enabled
- Check `GOOGLE_TTS_API_KEY` in environment
- Ensure service account has proper permissions

#### STT Issues
- Check microphone permissions
- Verify browser supports Web Speech API
- Try switching STT backend in environment

#### Performance Issues
- Close other audio/video applications
- Check browser console for errors
- Reduce avatar complexity if needed

### Debug Mode
Enable detailed logging by setting:
```env
NODE_ENV=development
```

## 📊 Performance

### Optimizations
- **3D Rendering**: Efficient Three.js scene management
- **Audio Processing**: Web Audio API with minimal latency
- **State Updates**: Optimized React rendering with Zustand
- **Asset Loading**: Lazy-loaded 3D models and textures

### Browser Support
- **Chrome/Edge**: Full feature support
- **Firefox**: Most features supported
- **Safari**: Limited Web Speech API support

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Three.js**: 3D graphics library
- **React Three Fiber**: React integration for Three.js
- **Google Cloud**: TTS and AI services
- **Web Speech API**: Browser-native speech recognition

---

**Note**: This application requires modern browser support for WebGL, Web Audio API, and Web Speech API. Ensure your browser is up-to-date for optimal performance.


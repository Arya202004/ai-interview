# 🚀 Quick Start Guide

Get the AI Interview Assistant up and running in minutes!

## ⚡ Quick Setup (5 minutes)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/ai-interview.git
cd ai-interview
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp env.example .env.local

# Edit .env.local with your API keys
# You only need these for basic functionality:
GOOGLE_AI_API_KEY=your_gemini_api_key_here
```

### 3. Start Development Server
```bash
npm run dev
```

🎉 **That's it!** Your app is running at `http://localhost:3000`

## 🔑 Get API Keys (2 minutes)

### Google AI Studio (Gemini)
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign in with Google account
3. Click "Get API key" → Create new key
4. Copy the key to `.env.local`

### Google Cloud TTS (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable "Cloud Text-to-Speech API"
4. Create service account and download JSON key
5. Add to `.env.local`:
   ```env
   GOOGLE_TTS_API_KEY=path/to/service-account.json
   GOOGLE_TTS_PROJECT_ID=your-project-id
   ```

## 🎮 Test the Application

### 1. Open Browser
Navigate to `http://localhost:3000`

### 2. Allow Permissions
- **Microphone**: For speech recognition
- **Camera**: For user video feed

### 3. Start Interview
- Enter your name
- Select interview role (Python Dev, Data Scientist, etc.)
- Click "Start Interview"
- Speak your answers!

## 🐛 Common Issues & Solutions

### Avatar Not Loading?
- Check browser console for errors
- Ensure `public/avatar.glb` exists
- Try refreshing the page

### No Audio?
- Check microphone permissions
- Verify audio device selection
- Try a different browser (Chrome recommended)

### API Errors?
- Verify your API keys in `.env.local`
- Check internet connection
- Ensure API quotas aren't exceeded

## 📱 What You'll See

- **3D Avatar**: Lifelike interviewer with lip-sync
- **Real-time Transcription**: Your speech appears as text
- **AI Questions**: Dynamic, role-based interview questions
- **Professional UI**: Clean, responsive interface
- **Export Options**: Download interview transcripts

## 🚀 Next Steps

### Development
- Customize avatar appearance
- Add new interview roles
- Implement additional AI features

### Production
- Deploy to Vercel, AWS, or your server
- Set up monitoring and logging
- Configure SSL certificates

### Customization
- Modify interview questions
- Adjust avatar animations
- Add custom branding

## 📚 Need Help?

- **Documentation**: Check the main [README.md](README.md)
- **Deployment**: See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **Issues**: Open a GitHub issue
- **Discussions**: Join our community

---

**Happy Interviewing! 🎯**

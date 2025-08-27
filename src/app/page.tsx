'use client'; 

import React, { useState, useEffect, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AvatarCanvas from "@/components/canvas/AvatarCanvas";
import UserVideo from "@/components/UserVideo";
import { useAudioRecorder } from "@/hooks/useAudioRecorder"; 
import { useAvatarStore } from '@/store/avatarStore'; // Correctly import the main store hook
import { generateVisemes } from '@/lib/lipsync'; // Correctly import the viseme generator

// --- INTERFACES AND TYPES ---
interface InterviewTurn { question: string; expectedAnswer: string; userAnswer?: string; }
type AppScreen = "welcome" | "role_selection" | "device_check" | "pre_notes" | "generating_questions" | "interviewing" | "generating_feedback" | "feedback_display";
type InterviewState = "idle" | "asking_question" | "listening_to_answer" | "processing_answer";

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [screen, setScreen] = useState<AppScreen>("welcome");
  const [interviewState, setInterviewState] = useState<InterviewState>("idle");
  const [userName, setUserName] = useState("");
  const [interviewRole, setInterviewRole] = useState("");
  const [interviewData, setInterviewData] = useState<InterviewTurn[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiResponse, setAiResponse] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const feedbackReportRef = useRef<HTMLDivElement>(null);
  const [agreed, setAgreed] = useState(false);
  // Device check (audio meter)
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyzerCleanupRef = useRef<() => void>(() => {});
  const [cameraReady, setCameraReady] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // --- CORRECTED STORE USAGE ---
  const playAudioWithVisemes = useAvatarStore((state) => state.playAudioWithVisemes);
  const playVisemesOnly = useAvatarStore((state) => state.playVisemesOnly);
  const stopAudio = useAvatarStore((state) => state.stopAudio);

  // --- CORE FUNCTIONS ---
  const speak = useCallback(async (text: string, onEndCallback: () => void = () => {}) => {
    setAiResponse(text);
    stopAudio(); // This will now work correctly
    const visemes = generateVisemes(text);

    // TTS provider switch via env
    const provider = process.env.NEXT_PUBLIC_TTS_PROVIDER || 'browser';
    try {
      if (provider === 'google' || provider === 'opentts') {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const contentType = res.headers.get('Content-Type') || 'audio/mpeg';
          const audioBlob = new Blob([arrayBuf], { type: contentType });
          playAudioWithVisemes(audioBlob, visemes);
          onEndCallback();
          return;
        }
      }
    } catch (err) {
      console.warn('[TTS] Google TTS failed, falling back to browser TTS.', err);
    }

    // Fallback: browser SpeechSynthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      playVisemesOnly(visemes);
      const utterance = new SpeechSynthesisUtterance(text);
      // Prefer Indian English male if available, else closest English
      const pickVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const byLang = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en-in'));
        const byMale = byLang.find(v => /male/i.test(v.name)) || byLang[0];
        if (byMale) return byMale;
        const en = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
        return en.find(v => /male|google uk english male|english india/i.test(v.name)) || en[0] || voices[0];
      };
      const assignVoice = () => {
        const v = pickVoice();
        if (v) utterance.voice = v;
        utterance.rate = 0.95; // slightly slower, clearer
        utterance.pitch = 0.95; // slightly lower for male tone
        window.speechSynthesis.speak(utterance);
      };
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => assignVoice();
      } else {
        assignVoice();
      }
      utterance.onend = onEndCallback;
    } else {
      onEndCallback();
    }
  }, [playAudioWithVisemes, playVisemesOnly, stopAudio]);
  
  const handleNameSubmit = useCallback((e: React.FormEvent) => { e.preventDefault(); if (userName.trim()) setScreen("role_selection"); }, [userName]);
  
  const handleRoleSelection = useCallback((role: string) => {
    setInterviewRole(role);
    setAgreed(false);
    setScreen("device_check");
  }, []);

  const beginInterview = useCallback(async () => {
    setScreen("generating_questions");
    try {
      const response = await fetch('/api/gemini-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: interviewRole, task: 'generate_questions' }),
      });
      if(!response.ok) {
        const err = await response.json().catch(() => ({} as any));
        throw new Error(err?.error || "Failed to generate questions.");
      }
      const data = await response.json();
      if (Array.isArray(data.interviewData)) {
        const firstQuestionText = `Thank you, ${userName}. I have prepared ${data.interviewData.length} questions for your ${interviewRole} interview. Let's begin. ${data.interviewData[0].question}`;
        data.interviewData[0].question = firstQuestionText;
        setInterviewData(data.interviewData);
        setScreen("interviewing");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Error in beginInterview:", msg);
      alert(msg);
      setScreen("role_selection"); 
    }
  }, [userName, interviewRole]);

  const processAnswer = useCallback(async (audioBlob: Blob) => {
    setInterviewState("processing_answer");
    setUserTranscript("Processing your answer...");
    const formData = new FormData();
    // Preserve actual blob type (ogg/webm) for server-side handling
    const filename = audioBlob.type.includes('ogg') ? 'audio.ogg' : 'audio.webm';
    formData.append("file", audioBlob, filename);
    formData.append("task", "transcribe_answer");

    try {
        const response = await fetch('/api/gemini-audio', { method: 'POST', body: formData });
        if(!response.ok) throw new Error("Failed to transcribe answer.");
        const data = await response.json();
        const userAnswer = data.transcript;

        setInterviewData(prevData => {
            const updatedData = [...prevData];
            updatedData[currentQuestionIndex].userAnswer = userAnswer;
            return updatedData;
        });
        setUserTranscript(userAnswer);
        setCurrentQuestionIndex(prev => prev + 1);
    } catch (error) {
        console.error("Error processing answer:", error);
        setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [currentQuestionIndex]);
  
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (audioBlob && audioBlob.size > 2000) {
        await processAnswer(audioBlob);
      } else {
        console.log("LOG: Recording too short or silent.");
      }
    } else {
      setUserTranscript(""); 
      startRecording();
    }
  }, [isRecording, processAnswer, startRecording, stopRecording]);

  const generateFeedback = useCallback(async () => {
    try {
        const response = await fetch('/api/gemini-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: interviewRole, interviewData, task: 'generate_feedback' }),
        });
        if(!response.ok || !response.body) throw new Error("Failed to generate feedback.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let feedbackText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            feedbackText += chunk;
            setFeedback(feedbackText);
        }
        setScreen("feedback_display");
    } catch (error) {
        console.error("Error generating feedback:", error);
    }
  }, [interviewData, interviewRole]);

  const handleDownloadPdf = useCallback(() => {
    const input = feedbackReportRef.current;
    if (input) {
      html2canvas(input, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // First page
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position -= pageHeight;

        // Additional pages
        while (heightLeft > 0) {
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
          position -= pageHeight;
        }

        pdf.save(`${userName}_Interview_Feedback.pdf`);
      });
    }
  }, [userName]);

  useEffect(() => {
    if (screen === 'interviewing' && interviewData.length > 0) {
      if (currentQuestionIndex >= interviewData.length) {
        setScreen("generating_feedback");
        speak("Thank you. The interview is now complete. Please wait while I generate your feedback.", () => {
          generateFeedback();
        });
      } else {
        setInterviewState("asking_question");
        const currentQuestion = interviewData[currentQuestionIndex].question;
        speak(currentQuestion, () => setInterviewState("listening_to_answer"));
      }
    }
  }, [screen, interviewData, currentQuestionIndex, speak, generateFeedback]);

  // Device check: start mic analyzer
  useEffect(() => {
    if (screen !== 'device_check') return;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId: number | null = null;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buffer.length);
          setMicLevel(Math.min(1, rms * 3));
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        micAnalyzerCleanupRef.current = () => {
          if (rafId) cancelAnimationFrame(rafId);
          try { source?.disconnect(); analyser?.disconnect(); } catch {}
          try { audioCtx?.close(); } catch {}
        };
      } catch (e) {
        console.error('[DeviceCheck] Failed to init mic analyzer', e);
      }

      // Camera check
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        cameraStreamRef.current = cam;
        setCameraReady(true);
      } catch (e) {
        console.error('[DeviceCheck] Failed to access camera', e);
        setCameraReady(false);
      }
    };
    start();
    return () => {
      micAnalyzerCleanupRef.current?.();
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [screen]);

  // --- RENDER LOGIC ---
  if (screen === 'device_check') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-xl text-center w-full max-w-2xl">
          <h1 className="text-2xl font-bold mb-2">Device Check</h1>
          <p className="mb-6 text-gray-600">Verify your camera and microphone before starting.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <UserVideo />
            </div>
            <div className="flex flex-col items-center justify-center p-4">
              <p className="text-gray-700 mb-2">Microphone Level</p>
              <div className="w-full h-4 bg-gray-200 rounded">
                <div className="h-4 bg-green-500 rounded" style={{ width: `${Math.round(micLevel * 100)}%` }} />
              </div>
              <p className="text-sm text-gray-500 mt-2">Speak to see the meter move</p>
              <div className="mt-4 text-sm">
                <p className={cameraReady ? 'text-green-700' : 'text-red-700'}>
                  Camera: {cameraReady ? 'Ready' : 'Not detected'}
                </p>
                <p className={(micLevel > 0.05) ? 'text-green-700' : 'text-red-700'}>
                  Microphone: {(micLevel > 0.05) ? 'Receiving audio' : 'No input detected'}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => setScreen('pre_notes')} disabled={!cameraReady || micLevel <= 0.05} className={`font-semibold px-6 py-2 rounded-lg ${(!cameraReady || micLevel <= 0.05) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'pre_notes') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-xl text-left w-full max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">Before You Begin</h1>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Choose a quiet, well‑lit space. Sit centered and look into the camera.</li>
            <li>Speak clearly at a moderate pace. Avoid background noise or echo.</li>
            <li>Use Start/Stop to control recording. Wait for prompts before answering.</li>
            <li>Keep your face visible; avoid covering your mouth while speaking.</li>
            <li>Ensure a stable internet connection and close bandwidth‑heavy apps.</li>
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <input id="agree" type="checkbox" className="w-4 h-4" onChange={(e) => setAgreed(e.target.checked)} />
            <label htmlFor="agree" className="text-gray-700">I have read and I'm ready to start.</label>
          </div>
          <div className="mt-6">
            <button onClick={() => beginInterview()} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400" disabled={!agreed}>Start Interview</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'welcome') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <form onSubmit={handleNameSubmit} className="p-8 bg-white rounded-lg shadow-xl text-center w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">AI Interview Assistant</h1>
          <p className="mb-6 text-gray-600">Please enter your name to begin.</p>
          <input 
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full px-4 py-2 border rounded-md mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Your Name"
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Start
          </button>
        </form>
      </div>
    );
  }
  
  if (screen === 'feedback_display') {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8 m-4 overflow-y-auto">
                <div ref={feedbackReportRef} className="p-4 text-gray-800">
                    <h1 className="text-3xl font-bold text-center mb-2">Interview Feedback for {userName}</h1>
                    <h2 className="text-xl text-center text-gray-600 mb-8">Role: {interviewRole}</h2>
                    <div className="whitespace-pre-wrap font-sans" dangerouslySetInnerHTML={{ __html: feedback.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n\*/g, '<br/>&bull;') }}>
                    </div>
                </div>
                <div className="text-center mt-8">
                    <button onClick={handleDownloadPdf} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Download as PDF
                    </button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="w-full max-w-7xl bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg p-6 md:p-8 m-4">
      <header className="flex justify-between items-center pb-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-md"></div>
          <h1 className="text-xl font-bold text-gray-800">AI Interview for {userName}</h1>
        </div>
      </header>
      
      {screen === 'role_selection' && (
        <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-2">Hello, {userName}!</h2>
            <p className="text-gray-600 mb-6">Please select the role for your interview.</p>
            <div className="flex flex-wrap justify-center gap-4">
                <button onClick={() => handleRoleSelection('Python Developer')} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Python Developer</button>
                <button onClick={() => handleRoleSelection('Data Scientist')} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Data Scientist</button>
                <button onClick={() => handleRoleSelection('AI/ML Engineer')} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">AI/ML Engineer</button>
                <button onClick={() => handleRoleSelection('Full Stack Developer')} className="bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">Full Stack Developer</button>
            </div>
        </div>
      )}

      {(screen === 'generating_questions' || screen === 'generating_feedback') && (
        <div className="text-center py-16">
            <h2 className="text-2xl font-semibold animate-pulse">{screen === 'generating_questions' ? `Generating questions...` : 'Analyzing your answers...'}</h2>
            <p className="text-gray-600">Please wait a moment.</p>
        </div>
      )}

      {screen === 'interviewing' && (
        <>
            <div className="py-4">
                <p className="text-sm text-gray-500 font-medium">
                Question {currentQuestionIndex + 1} / {interviewData.length}
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative aspect-video rounded-xl overflow-hidden shadow-md">
                    <div className="bg-black w-full h-full"><AvatarCanvas /></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-lg font-medium">{aiResponse}</p>
                    </div>
                </div>
                <div className="relative aspect-video rounded-xl bg-gray-200 shadow-md flex items-center justify-center overflow-hidden">
                    <UserVideo /> 
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-lg font-medium">{userTranscript}</p>
                    </div>
                </div>
            </div>
            <footer className="mt-6 flex justify-between items-center bg-gray-100 rounded-lg p-4 min-h-[80px]">
                <p className="text-gray-600 font-medium">
                    {interviewState === 'asking_question' && 'Interviewer is speaking...'}
                    {interviewState === 'listening_to_answer' && (isRecording ? 'Recording your answer...' : 'Ready for your answer.')}
                    {interviewState === 'processing_answer' && 'Processing your answer...'}
                </p>
                <button 
                    onClick={handleToggleRecording}
                    disabled={interviewState !== 'listening_to_answer'}
                    className={`font-semibold px-6 py-2 rounded-lg transition-colors ${
                        isRecording 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
                >
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                </button>
            </footer>
        </>
      )}
    </div>
  );
}
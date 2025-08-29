'use client'; 

import React, { useState, useEffect, useCallback, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AvatarCanvas from "@/components/canvas/AvatarCanvas";
import UserVideo from "@/components/UserVideo";
import ProctoringPanel from "@/components/ProctoringPanel";
import { useWebSpeechStt } from "@/hooks/useWebSpeechStt";
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
  const [listeningSeconds, setListeningSeconds] = useState(0);
  const listeningTimerRef = useRef<number | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  // Legacy recorder kept for fallback; primary path uses streaming STT
  // Use Web Speech API for real-time transcription
  const { start: startStt, stop: stopStt, isStreaming: isSttStreaming, transcript: sttTranscript, finals: sttFinals, level: sttLevel, clearTranscript } = useWebSpeechStt({ 
    languageCode: 'en-US', 
    continuous: true,
    interimResults: true,
    silenceMs: 10000, 
    onAutoStop: (finalText) => {
      const userAnswer = (finalText || '').trim();
      setPendingAnswer(userAnswer || '');
      stopListeningTimer();
    }
  });
  const feedbackReportRef = useRef<HTMLDivElement>(null);
  const [agreed, setAgreed] = useState(false);
  // Device check (audio meter)
  const [micLevel, setMicLevel] = useState(0);
  const [micPass, setMicPass] = useState(false);
  const micConsecutiveRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyzerCleanupRef = useRef<() => void>(() => {});
  const [cameraReady, setCameraReady] = useState(false);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});
  const toggleCard = useCallback((idx: number) => {
    setExpandedCards(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);
  const exportHistory = useCallback((as: 'txt'|'json') => {
    const answered = interviewData.slice(0, currentQuestionIndex).map((t, i) => ({ index: i+1, question: t.question, answer: t.userAnswer || '' }));
    if (as === 'json') {
      const blob = new Blob([JSON.stringify(answered, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'transcript.json'; a.click(); URL.revokeObjectURL(url);
    } else {
      const lines = answered.map(a => `Q${a.index}: ${a.question}\nA: ${a.answer}\n`).join('\n');
      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'transcript.txt'; a.click(); URL.revokeObjectURL(url);
    }
  }, [interviewData, currentQuestionIndex]);
  const [showCountdown, setShowCountdown] = useState<number | null>(null);
  const questionSpokenRef = useRef<number | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // --- CORRECTED STORE USAGE ---
  const playAudioWithVisemes = useAvatarStore((state) => state.playAudioWithVisemes);
  const playVisemesOnly = useAvatarStore((state) => state.playVisemesOnly);
  const stopAudio = useAvatarStore((state) => state.stopAudio);

  // --- CORE FUNCTIONS ---
  const startListeningWithCountdown = useCallback(async () => {
    setShowCountdown(3);
    const tick = (n: number) => {
      if (n <= 1) {
        setShowCountdown(null);
        setListeningSeconds(0);
        if (listeningTimerRef.current) window.clearInterval(listeningTimerRef.current);
        listeningTimerRef.current = window.setInterval(() => setListeningSeconds((s) => s + 1), 1000) as any as number;
        startStt();
      } else {
        setTimeout(() => tick(n - 1), 1000);
      }
    };
    setTimeout(() => tick(3), 1000);
  }, [startStt]);

  const speak = useCallback(async (text: string, onEndCallback: () => void = () => {}) => {
    if (isSpeakingRef.current) return;
    isSpeakingRef.current = true;
    setAiResponse(text);
    stopAudio();
    const visemes = generateVisemes(text);
    
    let currentText = '';
    const showProgress = () => {
      if (currentText.length < text.length) {
        currentText = text.substring(0, currentText.length + 1);
        setAiResponse(currentText);
        if (currentText.length < text.length) {
          setTimeout(showProgress, 50);
        }
      }
    };
    showProgress();

    const finishSpeaking = () => {
      isSpeakingRef.current = false;
      try { onEndCallback(); } catch {}
    };

    try {
      const ttsCall = async (attempt = 1): Promise<Response> => {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 300));
          return ttsCall(attempt + 1);
        }
        return res;
      };
      try { await stopStt(); } catch {}
      const res = await ttsCall();
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const contentType = res.headers.get('Content-Type') || 'audio/mpeg';
        const audioBlob = new Blob([arrayBuf], { type: contentType });
        playAudioWithVisemes(audioBlob, visemes, () => {
          startListeningWithCountdown();
          finishSpeaking();
        });
        return;
      } else {
        console.error('[TTS] Google TTS failed with status:', res.status);
        const errorText = await res.text().catch(() => 'Unknown error');
        console.error('[TTS] Error details:', errorText);
      }
    } catch (err) {
      console.error('[TTS] Google TTS request failed:', err);
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      playVisemesOnly(visemes);
      const utterance = new SpeechSynthesisUtterance(text);
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
        utterance.rate = 0.9; 
        utterance.pitch = 0.8; 
        utterance.onend = () => { startListeningWithCountdown(); finishSpeaking(); };
        window.speechSynthesis.speak(utterance);
      };
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => assignVoice();
      } else {
        assignVoice();
      }
      return;
    }

    startListeningWithCountdown();
    finishSpeaking();
  }, [generateVisemes, stopAudio, stopStt, playAudioWithVisemes, playVisemesOnly, startListeningWithCountdown]);
  
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
  
  // Primary answer flow using streaming STT; falls back to recorder if STT fails
  const handleToggleRecording = useCallback(async () => {
    try {
      if (isSttStreaming) {
        await stopStt();
        const finalText = (sttFinals && sttFinals.length > 0) ? sttFinals.join(' ').trim() : sttTranscript;
        const userAnswer = finalText.trim();
        if (userAnswer) {
          setInterviewData(prevData => {
            const updatedData = [...prevData];
            updatedData[currentQuestionIndex].userAnswer = userAnswer;
            return updatedData;
          });
          setUserTranscript(userAnswer);
        }
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        setUserTranscript("");
        await startStt();
      }
    } catch (e) {
      console.warn('[AnswerFlow] STT failed, falling back to recorder', e);
      // No recorder fallback logic as we are using Web Speech API
    }
  }, [isSttStreaming, stopStt, sttFinals, sttTranscript, currentQuestionIndex, startStt, processAnswer]);

  // Auto-start/stop STT based on interview state - only start after interviewer finishes
  useEffect(() => {
    const run = async () => {
      try {
        if (interviewState === 'listening_to_answer' && !isSttStreaming) {
          // STT will be started by speak() on TTS end via onEndCallback.
          // No eager start here.
        }
        if (interviewState !== 'listening_to_answer' && isSttStreaming) {
          console.log('[Interview] Stopping STT - no longer listening for answer');
          await stopStt();
          stopListeningTimer();
        }
      } catch (e) {
        console.warn('[STT] auto toggle error', e);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewState]);

  const stopListeningTimer = () => {
    if (listeningTimerRef.current) {
      window.clearInterval(listeningTimerRef.current);
      listeningTimerRef.current = null;
    }
  };

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
        if (questionSpokenRef.current !== currentQuestionIndex) {
          questionSpokenRef.current = currentQuestionIndex;
          setScreen("generating_feedback");
          speak("Thank you. The interview is now complete. Please wait while I generate your feedback.", () => {
            generateFeedback();
          });
        }
      } else {
        if (questionSpokenRef.current !== currentQuestionIndex) {
          questionSpokenRef.current = currentQuestionIndex;
          setInterviewState("asking_question");
          // Clear per-question transcripts to avoid appending across questions
          try { clearTranscript(); } catch {}
          setUserTranscript('');
          const currentQuestion = interviewData[currentQuestionIndex].question;
          speak(currentQuestion, () => setInterviewState("listening_to_answer"));
        }
      }
    }
  }, [screen, interviewData, currentQuestionIndex, speak, generateFeedback, clearTranscript]);

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
          const level = Math.min(1, rms * 3);
          setMicLevel(level);
          const threshold = 0.12; // speak "hello" to exceed this
          if (level > threshold) {
            micConsecutiveRef.current += 1;
          } else {
            micConsecutiveRef.current = Math.max(0, micConsecutiveRef.current - 1);
          }
          // require ~20 consecutive animation frames (~330ms) above threshold
          if (micConsecutiveRef.current >= 20) setMicPass(true);
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
              <p className="text-sm text-gray-500 mt-2">Say "hello" loudly — the bar should jump</p>
              <div className="mt-4 text-sm">
                <p className={cameraReady ? 'text-green-700' : 'text-red-700'}>
                  Camera: {cameraReady ? 'Ready' : 'Not detected'}
                </p>
                <p className={(micPass) ? 'text-green-700' : 'text-red-700'}>
                  Microphone: {micPass ? 'Test passed' : 'Say "hello" to test'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Proctoring Status */}
          <div className="mt-6">
            <ProctoringPanel />
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => setScreen('pre_notes')} disabled={!cameraReady || !micPass} className={`font-semibold px-6 py-2 rounded-lg ${(!cameraReady || !micPass) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="relative aspect-video rounded-xl overflow-hidden shadow-md lg:col-span-2">
                    <div className="bg-black w-full h-full"><AvatarCanvas /></div>
                    {showCountdown !== null && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="px-4 py-2 rounded-full bg-white text-gray-900 font-semibold shadow">
                          Listening in {showCountdown}…
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-xs uppercase tracking-wide opacity-75">Interviewer</p>
                        <p className="text-white text-lg font-medium mt-1">{aiResponse}</p>
                    </div>
                </div>
                <div className="lg:col-span-1 flex flex-col gap-4">
                  <div className="relative aspect-video rounded-xl bg-gray-200 shadow-md overflow-hidden">
                    <UserVideo /> 
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-white text-xs uppercase tracking-wide opacity-75">Interviewee</p>
                        <p className="text-white text-lg font-medium mt-1">{isSttStreaming ? sttTranscript : userTranscript}</p>
                    </div>
                  </div>
                  
                  {/* Proctoring Panel */}
                  <ProctoringPanel />
                  
                  <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-gray-100 bg-white z-10 flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Transcript History</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => exportHistory('txt')} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Export TXT</button>
                        <button onClick={() => exportHistory('json')} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">Export JSON</button>
                      </div>
                    </div>
                    <div className="p-3 overflow-y-auto" style={{ maxHeight: '260px' }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {interviewData.slice(0, currentQuestionIndex).map((turn, idx) => (
                          <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-semibold text-gray-600">Q{idx + 1}</div>
                              <button onClick={() => toggleCard(idx)} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100">
                                {expandedCards[idx] ? 'Collapse' : 'Expand'}
                              </button>
                            </div>
                            <div className={`${expandedCards[idx] ? '' : 'line-clamp-2'} text-sm text-gray-800`}>{turn.question}</div>
                            <div className="mt-2 text-xs uppercase tracking-wide text-gray-500">Answer</div>
                            <div className={`${expandedCards[idx] ? '' : 'line-clamp-2'} text-sm text-gray-700`}>
                              {turn.userAnswer && turn.userAnswer.trim().length > 0 ? turn.userAnswer : <span className="opacity-60">(no answer)</span>}
                            </div>
                          </div>
                        ))}
                        {currentQuestionIndex === 0 && (
                          <div className="text-xs text-gray-500">Answers will appear here after each question.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
            </div>
            <footer className="mt-6 flex justify-between items-center bg-gray-100 rounded-lg p-4 min-h-[80px]">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    interviewState === 'asking_question' ? 'bg-blue-100 text-blue-700' :
                    interviewState === 'listening_to_answer' ? 'bg-green-100 text-green-700' :
                    interviewState === 'processing_answer' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      interviewState === 'asking_question' ? 'bg-blue-500' :
                      interviewState === 'listening_to_answer' ? 'bg-green-500' :
                      interviewState === 'processing_answer' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    {interviewState === 'asking_question' && 'Ready'}
                    {interviewState === 'listening_to_answer' && 'Listening'}
                    {interviewState === 'processing_answer' && 'Processing'}
                    {interviewState === 'idle' && 'Ready'}
                  </span>
                  <p className="text-gray-600 font-medium">
                    {interviewState === 'asking_question' && 'Interviewer is speaking...'}
                    {interviewState === 'listening_to_answer' && (isSttStreaming ? `Listening… ${listeningSeconds}s (auto-stops after 10s silence)` : 'Waiting for interviewer to finish...')}
                    {interviewState === 'processing_answer' && 'Processing your answer...'}
                  </p>
                </div>
                {interviewState === 'listening_to_answer' && (
                  <div className="flex items-center gap-2 mr-4">
                    <div className="w-24 h-2 bg-gray-300 rounded">
                      <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.round((sttLevel || 0) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-600">Mic</span>
                  </div>
                )}
                {pendingAnswer === null ? (
                  <div className="flex items-center gap-2">
                    <button 
                        onClick={handleToggleRecording}
                        disabled={interviewState !== 'listening_to_answer'}
                        className={`font-semibold px-6 py-2 rounded-lg transition-colors ${
                            isSttStreaming 
                            ? 'bg-red-500 hover:bg-red-600' 
                            : 'bg-green-500 hover:bg-green-600'
                        } text-white disabled:bg-gray-400 disabled:cursor-not-allowed`}
                    >
                        {isSttStreaming ? 'Stop' : 'Start'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const ans = (pendingAnswer || '').trim();
                        if (ans) {
                          setInterviewData(prev => {
                            const updated = [...prev];
                            updated[currentQuestionIndex].userAnswer = ans;
                            return updated;
                          });
                          setUserTranscript(ans);
                        }
                        setPendingAnswer(null);
                        setCurrentQuestionIndex(prev => prev + 1);
                      }}
                      className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold"
                    >Use answer</button>
                    <button
                      onClick={async () => {
                        setPendingAnswer(null);
                        setUserTranscript('');
                        setListeningSeconds(0);
                        await startStt();
                        if (listeningTimerRef.current) window.clearInterval(listeningTimerRef.current);
                        listeningTimerRef.current = window.setInterval(() => setListeningSeconds((s) => s + 1), 1000) as any as number;
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                    >Re-record</button>
                  </div>
                )}
            </footer>
        </>
      )}
    </div>
  );
}
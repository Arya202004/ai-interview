'use client'; 

import React, { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import AvatarCanvas from "@/components/canvas/AvatarCanvas";
import UserVideo from "@/components/UserVideo";
import { useAudioRecorder } from "@/hooks/useAudioRecorder"; 

// Define the structure for each turn of the interview
interface InterviewTurn {
  question: string;
  expectedAnswer: string;
  userAnswer?: string;
}

// Define the different screens/states of the application
type AppScreen = "welcome" | "role_selection" | "generating_questions" | "interviewing" | "generating_feedback" | "feedback_display";

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("welcome");
  const [userName, setUserName] = useState("");
  const [interviewRole, setInterviewRole] = useState("");
  const [interviewData, setInterviewData] = useState<InterviewTurn[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [aiResponse, setAiResponse] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const feedbackReportRef = useRef<HTMLDivElement>(null);

  const speak = (text: string, onEndCallback: () => void = () => {}) => {
    setAiResponse(text);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = onEndCallback;
      window.speechSynthesis.speak(utterance);
    }
  };
  
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) setScreen("role_selection");
  };
  
  const handleRoleSelection = async (role: string) => {
    setInterviewRole(role);
    setScreen("generating_questions");
    try {
      const response = await fetch('/api/gemini-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, task: 'generate_questions' }),
      });
      if(!response.ok) throw new Error("Failed to generate questions.");
      const data = await response.json();
      if (Array.isArray(data.interviewData)) {
        const firstQuestionText = `Thank you, ${userName}. I have prepared ${data.interviewData.length} questions for your ${role} interview. Let's begin. ${data.interviewData[0].question}`;
        data.interviewData[0].question = firstQuestionText;
        setInterviewData(data.interviewData);
        setScreen("interviewing");
      }
    } catch (error) {
      console.error("Error in handleRoleSelection:", error);
      setScreen("role_selection"); 
    }
  };

  const processAnswer = async (audioBlob: Blob) => {
    setUserTranscript("Processing your answer...");
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("task", "transcribe_answer");

    try {
        const response = await fetch('/api/gemini-audio', { method: 'POST', body: formData });
        if(!response.ok) throw new Error("Failed to transcribe answer.");
        const data = await response.json();
        const userAnswer = data.transcript;

        const updatedData = [...interviewData];
        updatedData[currentQuestionIndex].userAnswer = userAnswer;
        setInterviewData(updatedData);
        setUserTranscript(userAnswer);

        setCurrentQuestionIndex(prev => prev + 1);
    } catch (error) {
        console.error("Error processing answer:", error);
        setCurrentQuestionIndex(prev => prev + 1);
    }
  };
  
  const handleToggleRecording = async () => {
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
  };
  // Fetches the final feedback from the backend
  const generateFeedback = async () => {
    try {
        const response = await fetch('/api/gemini-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: interviewRole,
                interviewData,
                task: 'generate_feedback'
            }),
        });
        if(!response.ok) throw new Error("Failed to generate feedback.");
        const data = await response.json();
        setFeedback(data.feedback);
        setScreen("feedback_display");
    } catch (error) {
        console.error("Error generating feedback:", error);
    }
  };

  // Handles the PDF download functionality
  const handleDownloadPdf = () => {
    const input = feedbackReportRef.current;
    if (input) {
      html2canvas(input, { scale: 2 }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${userName}_Interview_Feedback.pdf`);
      });
    }
  };

  // Main effect to control the flow of the interview
  useEffect(() => {
    if (screen === 'interviewing' && interviewData.length > 0) {
      if (currentQuestionIndex >= interviewData.length) {
        // Interview is over
        setScreen("generating_feedback");
        speak("Thank you. The interview is now complete. Please wait while I generate your feedback.", () => {
          generateFeedback();
        });
      } else {
        // Ask the next question
        const currentQuestion = interviewData[currentQuestionIndex].question;
        speak(currentQuestion);
      }
    }
  }, [screen, interviewData, currentQuestionIndex]);

  // --- RENDER LOGIC ---

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
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl p-8 m-4">
                <div ref={feedbackReportRef} className="p-4 text-gray-800">
                    <h1 className="text-3xl font-bold text-center mb-2">Interview Feedback for {userName}</h1>
                    <h2 className="text-xl text-center text-gray-600 mb-8">Role: {interviewRole}</h2>
                    <div className="whitespace-pre-wrap font-sans">
                        {feedback}
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

  // --- Render Main Interview Screen (Role Selection, Generating, and Interviewing) ---
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
            <h2 className="text-2xl font-semibold animate-pulse">{screen === 'generating_questions' ? `Generating questions for you, ${userName}...` : 'Analyzing your answers and generating feedback...'}</h2>
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
                    {isRecording ? "Recording your answer..." : "Ready for your answer."}
                </p>
                <button 
                    onClick={handleToggleRecording}
                    disabled={userTranscript === "Processing your answer..."} 
                    className={`font-semibold px-6 py-2 rounded-lg transition-colors ${
                        isRecording 
                        ? 'bg-red-500 hover:bg-red-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } text-white disabled:bg-gray-400`}
                >
                    {isRecording ? 'Recording...' : 'Start Recording'}
                </button>
            </footer>
        </>
      )}
    </div>
  );
}
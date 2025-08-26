import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return buffer.toString("base64");
}

export async function POST(req: Request) {
  try {
    // Correctly parse the incoming data as FormData
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;
    const task = formData.get("task") as "transcribe_answer" | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    if (!task) {
      return NextResponse.json({ error: "No task specified." }, { status: 400 });
    }

    const base64Audio = await blobToBase64(file);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const audioPart: Part = {
      inlineData: { mimeType: file.type, data: base64Audio },
    };
    
    // The prompt for transcribing an answer
    const prompt: Part = {
      text: "Transcribe the user's audio response clearly and accurately. Return ONLY the transcribed text, with no extra commentary or labels.",
    };
    
    const result = await model.generateContent([prompt, audioPart]);
    const responseText = result.response.text();
    
    console.log("SERVER LOG: Transcription successful:", responseText);
    
    return NextResponse.json({ transcript: responseText });

  } catch (error: any) {
    // Corrected the log message to be accurate
    console.error("SERVER LOG: Error in gemini-audio route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
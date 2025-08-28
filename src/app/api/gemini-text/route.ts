import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

if (!process.env.GEMINI_API_KEY) {
  console.error("[gemini-text] Missing GEMINI_API_KEY environment variable.");
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null as any;

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash';

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY || !genAI) {
      return NextResponse.json({ error: "Server not configured. Missing GEMINI_API_KEY." }, { status: 500 });
    }
    const { role, interviewData, task } = await req.json();

    if (!task) {
      return NextResponse.json({ error: "Task is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: TEXT_MODEL });

    let prompt = "";

    if (task === 'generate_questions' && role) {
      prompt = `You are an expert AI hiring manager for the role of a "${role}". Generate 10 diverse interview questions with brief expected answers. Return ONLY a valid JSON object: {"interviewData":[{"question":"...", "expectedAnswer":"..."}, ...]}. Do not include markdown or any other text.`;
    } else if (task === 'generate_feedback' && interviewData) {
      prompt = `You are an expert AI hiring manager. The user has completed an interview for the role of a "${role}".
      Analyze the provided interview data: ${JSON.stringify(interviewData)}.
      Provide constructive feedback in a clean, readable format with Markdown for headings and lists:
      1.  **Overall Score:** A score out of 100.
      2.  **Overall Summary:** A brief, 2-3 sentence summary of the user's performance.
      3.  **Per-Question Analysis:** A bulleted list analyzing the user's answer for each question.`;
    } else {
      return NextResponse.json({ error: "Invalid task or missing data." }, { status: 400 });
    }
    
    if (task === 'generate_questions') {
      // Retry up to 3 times for transient network errors
      const attempt = async () => await model.generateContent(prompt);
      let result;
      let lastErr: any = null;
      for (let i = 0; i < 3; i++) {
        try {
          result = await attempt();
          break;
        } catch (e: any) {
          lastErr = e;
          // Backoff: 300ms, 800ms
          await new Promise(r => setTimeout(r, i === 0 ? 300 : 800));
        }
      }
      if (!result && lastErr) throw lastErr;
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No valid JSON object in Gemini's response.");
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    } else { // Streaming for feedback
      // Retry streaming once on network error
      let streamResult;
      try {
        streamResult = await model.generateContentStream(prompt);
      } catch (e) {
        streamResult = await model.generateContentStream(prompt);
      }
      const stream = new ReadableStream({
          async start(controller) {
              for await (const chunk of streamResult.stream) {
                  const chunkText = chunk.text();
                  controller.enqueue(chunkText);
              }
              controller.close();
          },
      });
      return new Response(stream);
    }
  } catch (error: any) {
    const errMsg = error?.message || "Unknown error";
    const details = error?.errorDetails || undefined;
    console.error("SERVER LOG: Error in gemini-text route:", errMsg, details || "");
    const clientMessage = /API key not valid|API_KEY_INVALID/i.test(errMsg)
      ? "Gemini API key is invalid. Please set a valid GEMINI_API_KEY in .env.local and restart."
      : errMsg;
    return NextResponse.json({ error: clientMessage }, { status: 500 });
  }
}
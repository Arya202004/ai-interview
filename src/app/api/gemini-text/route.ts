import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { role, interviewData, task } = await req.json();

    if (!task) {
      return NextResponse.json({ error: "Task is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    let prompt = "";

    if (task === 'generate_questions' && role) {
      prompt = `You are an expert AI hiring manager for the role of a "${role}". Generate 10 diverse interview questions with brief expected answers. Return ONLY a valid JSON object: {"interviewData":[{"question":"...", "expectedAnswer":"..."}, ...]}. Do not include markdown or any other text.`;
    } else if (task === 'generate_feedback' && interviewData) {
      prompt = `You are an expert AI hiring manager. The user has completed an interview for the role of a "${role}".
      Analyze the provided interview data, which includes the question, the user's answer, and the ideal answer.
      Provide constructive feedback in the following format:
      1.  **Overall Score:** A score out of 100.
      2.  **Overall Summary:** A brief, 2-3 sentence summary of the user's performance, highlighting strengths and areas for improvement.
      3.  **Per-Question Analysis:** A bulleted list where you briefly analyze the user's answer for each question compared to the ideal answer.

      Return ONLY the feedback as a clean string. Do not use JSON or Markdown.`;
    } else {
      return NextResponse.json({ error: "Invalid task or missing data." }, { status: 400 });
    }
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // For question generation, we expect JSON. For feedback, we expect text.
    if (task === 'generate_questions') {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No valid JSON object in Gemini's response.");
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    } else {
      return NextResponse.json({ feedback: responseText });
    }

  } catch (error: any) {
    console.error("SERVER LOG: Error in gemini-text route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
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
      Analyze the provided interview data: ${JSON.stringify(interviewData)}.
      Provide constructive feedback in a clean, readable format with Markdown for headings and lists:
      1.  **Overall Score:** A score out of 100.
      2.  **Overall Summary:** A brief, 2-3 sentence summary of the user's performance.
      3.  **Per-Question Analysis:** A bulleted list analyzing the user's answer for each question.`;
    } else {
      return NextResponse.json({ error: "Invalid task or missing data." }, { status: 400 });
    }
    
    if (task === 'generate_questions') {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No valid JSON object in Gemini's response.");
      return NextResponse.json(JSON.parse(jsonMatch[0]));
    } else { // Streaming for feedback
      const result = await model.generateContentStream(prompt);
      const stream = new ReadableStream({
          async start(controller) {
              for await (const chunk of result.stream) {
                  const chunkText = chunk.text();
                  controller.enqueue(chunkText);
              }
              controller.close();
          },
      });
      return new Response(stream);
    }
  } catch (error) {
    console.error("SERVER LOG: Error in gemini-text route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
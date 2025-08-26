import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const streamingResponse = await model.generateContentStream(prompt);
    
    const stream = new ReadableStream({
        async start(controller) {
            for await (const chunk of streamingResponse.stream) {
                const chunkText = chunk.text();
                controller.enqueue(chunkText);
            }
            controller.close();
        },
    });

    return new Response(stream);

  } catch (error) {
    console.error("Error in Gemini API route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(`Error from Gemini API: ${errorMessage}`, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export async function GET() {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  const deepgramProjectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!deepgramApiKey || !deepgramProjectId) {
    return NextResponse.json(
      { error: "Deepgram API key or Project ID not found in environment variables." },
      { status: 500 }
    );
  }

  const deepgram = createClient(deepgramApiKey);

  try {
    // The correct method is deepgram.manage.keys.create
    const { key, error } = await deepgram.manage.keys.create(
      deepgramProjectId, // Use the Project ID here
      "Temporary key for client",
      ["usage:write"],
      { timeToLiveInSeconds: 60 } // Key is valid for 1 minute
    );

    if (error) {
      console.error("Deepgram key creation error:", error);
      throw new Error(error.message);
    }
    
    return NextResponse.json({ key });

  } catch (error: any) {
    console.error("Error in Deepgram API route:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
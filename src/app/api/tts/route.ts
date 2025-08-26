import { NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key is not configured.");
    }
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const response = await fetch(elevenLabsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API failed with status ${response.status}: ${errorText}`);
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });

  } catch (error) {
    console.error("SERVER LOG: Full error in TTS route:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `TTS generation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
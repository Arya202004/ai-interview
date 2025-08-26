import { NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// This is the ID for the "Rachel" voice. You can find other voice IDs on the ElevenLabs website.
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

    console.log(`SERVER LOG: Generating audio for text: "${text}"`);
    
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

    // The response body is the audio stream itself.
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });

  } catch (error: any) {
    console.error("SERVER LOG: Full error in TTS route:", error);
    return NextResponse.json(
      { error: `TTS generation failed: ${error.message}` },
      { status: 500 }
    );
  }
}
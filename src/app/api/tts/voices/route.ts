import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) return NextResponse.json({ status: 'error', error: 'Missing GOOGLE_TTS_API_KEY' }, { status: 500 });
    
    // Get available voices
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    
    if (!r.ok) {
      const errorText = await r.text();
      return NextResponse.json({ status: 'error', error: errorText }, { status: r.status });
    }
    
    const json = await r.json();
    
    // Filter for Indian voices and show gender
    const indianVoices = json.voices?.filter((voice: any) => 
      voice.languageCodes?.includes('en-IN')
    ).map((voice: any) => ({
      name: voice.name,
      gender: voice.ssmlGender,
      languageCodes: voice.languageCodes
    })) || [];
    
    return NextResponse.json({ 
      status: 'success', 
      indianVoices,
      allVoices: json.voices?.slice(0, 20) // First 20 for reference
    });
    
  } catch (e: any) {
    return NextResponse.json({ status: 'error', error: e?.message || 'Failed to get voices' }, { status: 500 });
  }
}

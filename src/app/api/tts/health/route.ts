import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) return NextResponse.json({ status: 'error', error: 'Missing GOOGLE_TTS_API_KEY' }, { status: 500 });
    
    // Do a small synth with short text to validate
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
    const body = {
      input: { text: 'Hello, this is a test of the Indian male voice.' },
      voice: { 
        languageCode: process.env.GOOGLE_TTS_LANGUAGE_CODE || 'en-IN', 
        name: process.env.GOOGLE_TTS_VOICE || 'en-IN-Wavenet-D' 
      },
      audioConfig: { 
        audioEncoding: 'MP3', 
        speakingRate: parseFloat(process.env.GOOGLE_TTS_RATE || '0.9'),
        pitch: parseFloat(process.env.GOOGLE_TTS_PITCH || '-2.0')
      },
    };
    
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      const errorText = await r.text();
      return NextResponse.json({ status: 'error', error: errorText }, { status: r.status });
    }
    
    const json = await r.json();
    if (!json.audioContent) return NextResponse.json({ status: 'error', error: 'Empty content' }, { status: 502 });
    
    // Return the audio content so it can be played
    const audioBuffer = Buffer.from(json.audioContent, 'base64');
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString()
      }
    });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', error: e?.message || 'health failed' }, { status: 500 });
  }
}



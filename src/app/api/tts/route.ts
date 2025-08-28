import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function synthesizeGoogle(text: string): Promise<Response> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return new NextResponse('Missing GOOGLE_TTS_API_KEY', { status: 500 });
  const languageCode = process.env.GOOGLE_TTS_LANGUAGE_CODE || 'en-IN';
  const voiceName = process.env.GOOGLE_TTS_VOICE || 'en-IN-Wavenet-D'; // Indian male voice
  const speakingRate = parseFloat(process.env.GOOGLE_TTS_RATE || '0.9');
  const pitch = parseFloat(process.env.GOOGLE_TTS_PITCH || '-2.0'); // Deeper male voice
  const audioEncoding = process.env.GOOGLE_TTS_AUDIO_ENCODING || 'MP3';

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`;
  const body = {
    input: { text },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding, speakingRate, pitch },
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    const textErr = await r.text().catch(() => '');
    return new NextResponse('Google TTS error: ' + textErr, { status: r.status });
  }
  const json = await r.json();
  if (!json.audioContent) return new NextResponse('Google TTS empty audio', { status: 502 });
  const buffer = Buffer.from(json.audioContent, 'base64');
  return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
}

async function synthesizeOpenTTS(text: string): Promise<Response> {
  const base = process.env.OPENTTS_URL; // e.g., http://localhost:5500 or any OpenTTS-compatible server
  const voice = process.env.OPENTTS_VOICE || 'larynx/cmu_fem_flow_tts'; // map for OpenTTS voice id
  if (!base) return new NextResponse('Missing OPENTTS_URL', { status: 500 });
  // OpenTTS expects voice in path for some voices, fallback to query for others
  const url = `${base.replace(/\/$/, '')}/api/tts?${new URLSearchParams({ text, voice }).toString()}`;
  const r = await fetch(url);
  if (!r.ok) return new NextResponse('OpenTTS error', { status: r.status });
  const arrayBuf = await r.arrayBuffer();
  // Many OpenTTS servers return WAV
  return new NextResponse(arrayBuf, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'audio/wav' } });
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') return new NextResponse('Missing text', { status: 400 });
    return synthesizeGoogle(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new NextResponse('TTS error: ' + message, { status: 500 });
  }
}



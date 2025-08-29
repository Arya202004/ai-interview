import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if GCP credentials are configured (supports file path, inline JSON, or base64 JSON)
    const hasProject = !!process.env.GOOGLE_VIDEO_INTELLIGENCE_PROJECT_ID;
    const hasFile = !!process.env.GOOGLE_VIDEO_INTELLIGENCE_API_KEY;
    const hasInline = !!process.env.GOOGLE_VIDEO_INTELLIGENCE_CREDENTIALS;
    const hasInlineB64 = !!process.env.GOOGLE_VIDEO_INTELLIGENCE_CREDENTIALS_B64;
    const hasCredentials = hasProject && (hasFile || hasInline || hasInlineB64);

    return NextResponse.json({
      status: 'healthy',
      service: 'proctoring',
      timestamp: new Date().toISOString(),
      gcp: {
        configured: hasCredentials,
        projectId: process.env.GOOGLE_VIDEO_INTELLIGENCE_PROJECT_ID || 'not_set',
        location: process.env.GOOGLE_VIDEO_INTELLIGENCE_LOCATION || 'not_set',
        mode: hasInlineB64 ? 'inline_b64' : hasInline ? 'inline_json' : hasFile ? 'keyfile' : 'unset'
      },
      features: {
        camera_monitoring: true,
        audio_monitoring: true,
        object_detection: true,
        face_detection: true,
        explicit_content_detection: true
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'proctoring',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

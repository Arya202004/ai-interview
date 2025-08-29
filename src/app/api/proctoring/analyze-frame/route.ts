import { NextRequest, NextResponse } from 'next/server';
import { VideoIntelligenceServiceClient, protos } from '@google-cloud/video-intelligence';

// Initialize GCP Video Intelligence client
let videoClient: VideoIntelligenceServiceClient | null = null;

function getVideoClient() {
  if (!videoClient) {
    const projectId = process.env.GOOGLE_VIDEO_INTELLIGENCE_PROJECT_ID;
    const keyFilePath = process.env.GOOGLE_VIDEO_INTELLIGENCE_API_KEY; // optional: path to JSON file
    const inlineJson = process.env.GOOGLE_VIDEO_INTELLIGENCE_CREDENTIALS; // optional: JSON string
    const inlineJsonB64 = process.env.GOOGLE_VIDEO_INTELLIGENCE_CREDENTIALS_B64; // optional: base64 JSON

    if (!projectId) {
      throw new Error('GCP Video Intelligence credentials not configured');
    }

    const options: any = { projectId };

    // Prefer inline credentials for serverless (e.g., Vercel)
    try {
      let parsed: any | null = null;
      if (inlineJsonB64) {
        const str = Buffer.from(inlineJsonB64, 'base64').toString('utf-8');
        parsed = JSON.parse(str);
      } else if (inlineJson) {
        parsed = JSON.parse(inlineJson);
      }
      if (parsed && parsed.client_email && parsed.private_key) {
        // Handle escaped newlines in env vars
        const private_key = String(parsed.private_key).replace(/\\n/g, '\n');
        options.credentials = {
          client_email: parsed.client_email,
          private_key,
        };
      } else if (keyFilePath) {
        options.keyFilename = keyFilePath;
      }
    } catch (e) {
      // Fall back to key file if parsing fails and path exists
      if (keyFilePath) {
        options.keyFilename = keyFilePath;
      }
    }

    // If neither inline nor file credentials are present, error
    if (!options.credentials && !options.keyFilename) {
      throw new Error('GCP Video Intelligence credentials not configured');
    }

    videoClient = new VideoIntelligenceServiceClient(options);
  }
  return videoClient;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    const client = getVideoClient();
    
    // Configure the request for object detection and label detection
    const gcpRequest = {
      inputContent: base64Image,
      features: [
        protos.google.cloud.videointelligence.v1.Feature.LABEL_DETECTION,
        protos.google.cloud.videointelligence.v1.Feature.FACE_DETECTION,
        protos.google.cloud.videointelligence.v1.Feature.PERSON_DETECTION,
        protos.google.cloud.videointelligence.v1.Feature.EXPLICIT_CONTENT_DETECTION
      ],
      videoContext: {
        segments: [{
          startTimeOffset: { seconds: 0, nanos: 0 },
          endTimeOffset: { seconds: 1, nanos: 0 }
        }]
      }
    };

    // Analyze the image
    const [operation] = await client.annotateVideo(gcpRequest);
    
    // Wait for operation to complete
    const [operationResult] = await operation.promise();
    
    const violations: any[] = [];
    
    // Check for explicit content
    if (operationResult.annotationResults?.[0]?.explicitAnnotation) {
      const explicitContent = operationResult.annotationResults[0].explicitAnnotation;
      if (explicitContent.frames && explicitContent.frames.length > 0) {
        const hasExplicitContent = explicitContent.frames.some(frame => 
          frame.pornographyLikelihood === 'LIKELY' || 
          frame.pornographyLikelihood === 'VERY_LIKELY'
        );
        
        if (hasExplicitContent) {
          violations.push({
            severity: 'high',
            description: 'Inappropriate content detected',
            details: { type: 'explicit_content' }
          });
        }
      }
    }
    
    // Check for multiple people (potential cheating)
    if (operationResult.annotationResults?.[0]?.personDetectionAnnotations) {
      const personAnnotations = operationResult.annotationResults[0].personDetectionAnnotations;
      if (personAnnotations.length > 1) {
        violations.push({
          severity: 'high',
          description: 'Multiple people detected in frame',
          details: { count: personAnnotations.length, type: 'multiple_people' }
        });
      }
    }
    
    // Check for objects that might indicate cheating
    if (operationResult.annotationResults?.[0]?.shotLabelAnnotations) {
      const labels = operationResult.annotationResults[0].shotLabelAnnotations || [];
      
      // Check for suspicious objects
      const suspiciousObjects = [
        'phone', 'mobile phone', 'smartphone', 'laptop', 'tablet', 'computer',
        'book', 'notebook', 'paper', 'document', 'text', 'writing',
        'headphones', 'earphones', 'microphone', 'camera', 'webcam'
      ];
      
      for (const label of labels) {
        if (suspiciousObjects.some(obj => 
          label.entity?.description?.toLowerCase().includes(obj)
        )) {
          violations.push({
            severity: 'medium',
            description: `Suspicious object detected: ${label.entity?.description}`,
            details: { 
              object: label.entity?.description,
              confidence: label.segments?.[0]?.confidence || 0,
              type: 'suspicious_object'
            }
          });
        }
      }
    }
    
    // Check for face detection (ensure person is visible)
    if (operationResult.annotationResults?.[0]?.faceDetectionAnnotations) {
      const faceAnnotations = operationResult.annotationResults[0].faceDetectionAnnotations;
      if (faceAnnotations.length === 0) {
        violations.push({
          severity: 'medium',
          description: 'No face detected - person may have left frame',
          details: { type: 'no_face_detected' }
        });
      }
    }
    
    // Check for unusual activity patterns
    if (operationResult.annotationResults?.[0]?.objectAnnotations) {
      const objectAnnotations = operationResult.annotationResults[0].objectAnnotations;
      
      // Look for rapid movement or unusual positioning
      if (objectAnnotations.length > 0) {
        const hasRapidMovement = objectAnnotations.some(obj => 
          obj.frames && obj.frames.length > 1
        );
        
        if (hasRapidMovement) {
          violations.push({
            severity: 'low',
            description: 'Unusual movement pattern detected',
            details: { type: 'rapid_movement' }
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      violations,
      analysis: {
        timestamp: new Date().toISOString(),
        features: gcpRequest.features,
        totalViolations: violations.length
      }
    });

  } catch (error) {
    console.error('Error analyzing video frame:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze video frame',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

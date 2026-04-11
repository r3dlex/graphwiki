// Video ingester for GraphWiki v2
// Extracts audio from video URLs and transcribes via Whisper

import { transcribeFromUrl } from './whisper.js';

export interface VideoIngestResult {
  url: string;
  title?: string;
  transcript: string;
  language?: string;
  duration?: number;
  tokens_used: number;
}

/**
 * Ingest a video URL: download audio and transcribe
 */
export async function ingestVideo(
  url: string,
  title?: string,
): Promise<VideoIngestResult> {
  const transcription = await transcribeFromUrl(url);

  return {
    url,
    title,
    transcript: transcription.text,
    language: transcription.language,
    duration: transcription.duration,
    tokens_used: transcription.tokens_used,
  };
}

/**
 * Ingest a video file: transcribe directly
 */
export async function ingestVideoFile(
  filePath: string,
  mimeType = 'video/mp4',
): Promise<VideoIngestResult> {

  const { readFileSync } = await import('fs');
  const { Blob } = await import('node:buffer');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const fileData = readFileSync(filePath);
  const blob = new Blob([fileData], { type: mimeType });

  const form = new FormData();
  form.append('file', blob, 'video');
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: form as FormData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error: ${response.status} ${error}`);
  }

  const data = await response.json() as {
    text: string;
    language?: string;
    duration?: number;
  };

  return {
    url: filePath,
    transcript: data.text,
    language: data.language,
    duration: data.duration,
    tokens_used: Math.ceil(data.text.split(/\s+/).length * 1.3),
  };
}

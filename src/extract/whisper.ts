// Whisper transcription for GraphWiki v2
// Uses OpenAI Whisper API for audio/video transcription

import { unlinkSync, mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  tokens_used: number;
}

/**
 * Transcribe audio file using OpenAI Whisper API
 */
export async function transcribeAudioFile(
  audioFilePath: string,
  mimeType = 'audio/webm',
): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const { Blob } = await import('node:buffer');
  const fileData = readFileSync(audioFilePath);
  const blob = new Blob([fileData], { type: mimeType });

  const form = new FormData();
  form.append('file', blob, 'audio.webm');
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
    text: data.text,
    language: data.language,
    duration: data.duration,
    tokens_used: Math.ceil(data.text.split(/\s+/).length * 1.3),
  };
}

/**
 * Transcribe from a URL (audio or video file) by downloading first
 */
export async function transcribeFromUrl(
  url: string,
): Promise<TranscriptionResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'graphwiki-video-'));
  const audioPath = join(tmpDir, 'audio.webm');

  try {
    // Try yt-dlp first for video URLs, fallback to curl for direct audio
    try {
      execSync('which yt-dlp', { stdio: 'pipe' });
      execSync(`yt-dlp -x --audio-format webm -o "${audioPath}" "${url}"`, { stdio: 'pipe' });
    } catch {
      // Fallback: direct download
      execSync(`curl -L -o "${audioPath}" "${url}"`, { stdio: 'pipe' });
    }

    const result = await transcribeAudioFile(audioPath, 'audio/webm');
    return result;
  } finally {
    try { unlinkSync(audioPath); } catch { /* ignore */ }
    try { require('fs').rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}

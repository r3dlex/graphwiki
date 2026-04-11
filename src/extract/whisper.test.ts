import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  unlinkSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue(Buffer.alloc(100)),
  rmSync: vi.fn(),
  mkdtempSync: vi.fn().mockReturnValue('/tmp/graphwiki-video-xxxx'),
}));

// Mock os
vi.mock('os', () => ({
  tmpdir: vi.fn().mockReturnValue('/tmp'),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn().mockImplementation((...args: string[]) => args.join('/')),
}));

describe('whisper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeAudioFile', () => {
    it('should throw error when OPENAI_API_KEY is not set', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: '' },
        writable: true,
      });

      const { transcribeAudioFile } = await import('./whisper.js');

      await expect(transcribeAudioFile('/tmp/audio.webm')).rejects.toThrow(
        'OPENAI_API_KEY environment variable is not set'
      );
    });

    it('should handle API error response', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: 'test-key' },
        writable: true,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      });
      globalThis.fetch = mockFetch;

      const { transcribeAudioFile } = await import('./whisper.js');

      await expect(transcribeAudioFile('/tmp/audio.webm')).rejects.toThrow(
        'Whisper API error: 401 Unauthorized'
      );
    });

    it('should return transcription result on success', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: 'test-key' },
        writable: true,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'Hello world',
          language: 'en',
          duration: 5.5,
        }),
      });
      globalThis.fetch = mockFetch;

      const { transcribeAudioFile } = await import('./whisper.js');

      const result = await transcribeAudioFile('/tmp/audio.webm');

      expect(result.text).toBe('Hello world');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(5.5);
      expect(result.tokens_used).toBeGreaterThan(0);
    });

    it('should calculate tokens_used correctly', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: 'test-key' },
        writable: true,
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          text: 'one two three four five',
        }),
      });
      globalThis.fetch = mockFetch;

      const { transcribeAudioFile } = await import('./whisper.js');

      const result = await transcribeAudioFile('/tmp/audio.webm');
      // 5 words * 1.3 = 6.5, ceil = 7
      expect(result.tokens_used).toBe(7);
    });
  });

  describe('transcribeFromUrl', () => {
    it('should throw when OPENAI_API_KEY is not set', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: '' },
        writable: true,
      });

      const { transcribeFromUrl } = await import('./whisper.js');

      await expect(transcribeFromUrl('https://example.com/video.mp4')).rejects.toThrow(
        'OPENAI_API_KEY environment variable is not set'
      );
    });

    it('should call execSync for downloading', async () => {
      Object.defineProperty(process, 'env', {
        value: { OPENAI_API_KEY: 'test-key' },
        writable: true,
      });

      const { execSync } = await import('child_process');
      vi.mocked(execSync).mockImplementation(() => '' as any);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ text: 'transcribed' }),
      });
      globalThis.fetch = mockFetch;

      const { transcribeFromUrl } = await import('./whisper.js');

      await transcribeFromUrl('https://example.com/video.mp4');

      expect(execSync).toHaveBeenCalled();
    });
  });
});

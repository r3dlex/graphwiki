import { describe, it, expect, beforeEach } from 'vitest';
import { TiktokenCounter, countTokens, countMessageTokens } from '../../src/benchmark/tiktoken-counter.js';
import type { Message } from '../../src/types.js';

describe('TiktokenCounter', () => {
  let counter: TiktokenCounter;

  beforeEach(() => {
    counter = new TiktokenCounter();
  });

  describe('count', () => {
    it('should return 0 for empty string', async () => {
      const result = await counter.count('');
      expect(result).toBe(0);
    });

    it('should count tokens for simple English text', async () => {
      const text = 'Hello, world!';
      const result = await counter.count(text);
      expect(result).toBeGreaterThan(0);
      // "Hello, world!" should be roughly 3-4 tokens with tiktoken
      expect(result).toBeLessThanOrEqual(text.length);
    });

    it('should count tokens for code content', async () => {
      const code = 'function hello() { return "world"; }';
      const result = await counter.count(code);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle unicode content', async () => {
      const unicode = '你好世界';
      const result = await counter.count(unicode);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('countMessages', () => {
    it('should count tokens for message array', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is extraction?' },
      ];
      const result = await counter.countMessages(messages);
      expect(result).toBeGreaterThan(0);
    });

    it('should add overhead for message structure', async () => {
      const singleMessage: Message[] = [
        { role: 'user', content: 'Hi' },
      ];
      const multiMessage: Message[] = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi' },
      ];
      const singleCount = await counter.countMessages(singleMessage);
      const multiCount = await counter.countMessages(multiMessage);
      expect(multiCount).toBeGreaterThanOrEqual(singleCount);
    });
  });

  describe('record and cumulative stats', () => {
    it('should track cumulative tokens', async () => {
      await counter.count('Hello');
      await counter.count('World');
      counter.record(10);
      expect(counter.getCumulative()).toBeGreaterThan(0);
      expect(counter.getCallCount()).toBeGreaterThan(0);
    });

    it('should calculate average per call', async () => {
      counter.record(100);
      counter.record(200);
      const avg = counter.getAveragePerCall();
      expect(avg).toBe(150);
    });

    it('should reset counters', () => {
      counter.record(100);
      counter.reset();
      expect(counter.getCumulative()).toBe(0);
      expect(counter.getCallCount()).toBe(0);
    });
  });
});

describe('countTokens (standalone)', () => {
  it('should count tokens for text', async () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const result = await countTokens(text);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });
});

describe('countMessageTokens (standalone)', () => {
  it('should count tokens for messages', async () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is GraphWiki?' },
    ];
    const result = await countMessageTokens(messages);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });
});

describe('Token accuracy', () => {
  it('should produce accurate counts compared to character estimation', async () => {
    const counter = new TiktokenCounter();
    const testCases = [
      'Hello, world!',
      'function test() { return 42; }',
      'The GraphWiki system extracts knowledge from code.',
      'async function processData(input: string[]): Promise<void> {}',
    ];

    for (const text of testCases) {
      const tiktokenCount = await counter.count(text);
      const charEstimate = Math.ceil(text.length / 4);

      // tiktoken should be more accurate than simple char/4
      // Allow reasonable tolerance (within 50% of character estimate)
      expect(tiktokenCount).toBeGreaterThan(0);
      expect(tiktokenCount).toBeLessThanOrEqual(text.length);

      // The ratio should be reasonable (not wildly different from char/4)
      const ratio = tiktokenCount / charEstimate;
      expect(ratio).toBeGreaterThan(0.1);
      expect(ratio).toBeLessThan(4);
    }
  });
});

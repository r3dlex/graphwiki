// Tiktoken-based token counter for GraphWiki v2
// Uses OpenAI's cl100k_base tokenizer (GPT-4 / GPT-3.5 Turbo)

import type { Message } from '../types.js';

let tiktokenInstance: unknown = null;

async function getTiktoken() {
  if (tiktokenInstance === null) {
    try {
      const tiktoken = await import('tiktoken');
      tiktokenInstance = await tiktoken.encoding_for_model('gpt-4');
    } catch {
      // Fallback to null if tiktoken is not available
      tiktokenInstance = null;
    }
  }
  return tiktokenInstance as { encode: (text: string) => Uint32Array } | null;
}

/**
 * Count tokens for a text string using tiktoken (cl100k_base)
 */
export async function countTokens(text: string): Promise<number> {
  const enc = await getTiktoken();
  if (enc) {
    const tokens = enc.encode(text);
    return tokens.length;
  }
  // Fallback: character-based estimation
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens for messages using tiktoken
 */
export async function countMessageTokens(messages: Message[]): Promise<number> {
  await getTiktoken();
  let total = 0;

  for (const message of messages) {
    // Role prefix (~4 tokens on average)
    total += 4;
    // Content
    total += await countTokens(message.content);
    // Name field if present
    if (message.name) {
      total += await countTokens(message.name) + 1;
    }
  }

  // Message array overhead
  total += 3 + 3;

  return total;
}

/**
 * TiktokenCounter - Accurate token counting using OpenAI's cl100k_base
 */
export class TiktokenCounter {
  private cumulativeTokens = 0;
  private callCount = 0;
  private outputPath?: string;

  constructor(outputPath?: string) {
    this.outputPath = outputPath;
  }

  /**
   * Count tokens for a text string
   */
  async count(text: string): Promise<number> {
    return countTokens(text);
  }

  /**
   * Count tokens for a message array
   */
  async countMessages(messages: Message[]): Promise<number> {
    return countMessageTokens(messages);
  }

  /**
   * Record a token count and update cumulative stats
   */
  record(tokens: number): void {
    this.cumulativeTokens += tokens;
    this.callCount++;
  }

  /**
   * Get cumulative token count
   */
  getCumulative(): number {
    return this.cumulativeTokens;
  }

  /**
   * Get number of calls made
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get average tokens per call
   */
  getAveragePerCall(): number {
    if (this.callCount === 0) return 0;
    return this.cumulativeTokens / this.callCount;
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.cumulativeTokens = 0;
    this.callCount = 0;
  }

  /**
   * Write current stats to output file
   */
  async writeStats(): Promise<void> {
    if (!this.outputPath) return;

    const stats = {
      timestamp: new Date().toISOString(),
      cumulative_tokens: this.cumulativeTokens,
      call_count: this.callCount,
      average_per_call: this.getAveragePerCall(),
    };

    const { writeFile, mkdir } = await import('fs/promises');
    const dir = this.outputPath.substring(0, this.outputPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(this.outputPath, JSON.stringify(stats, null, 2));
  }
}

/**
 * Singleton instance for global token counting
 */
let globalCounter: TiktokenCounter | null = null;

export function getGlobalCounter(): TiktokenCounter {
  if (!globalCounter) {
    globalCounter = new TiktokenCounter('graphwiki-out/benchmark/token-counter.json');
  }
  return globalCounter;
}

export function setGlobalCounter(counter: TiktokenCounter): void {
  globalCounter = counter;
}

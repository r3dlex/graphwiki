// Global test setup
import { vi } from 'vitest';

// Mock process.exit to prevent test termination
Object.defineProperty(process, 'exit', {
  value: vi.fn(),
  writable: true,
});

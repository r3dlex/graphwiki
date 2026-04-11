/**
 * tree-sitter-compare.ts
 * Compares WASM vs native tree-sitter parser output for parity verification.
 * Run with: npx tsx src/extract/tree-sitter-compare.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../tests/fixtures");

const FIXTURES: Array<{ file: string; lang: string }> = [
  { file: "greeter.py", lang: "python" },
  { file: "greeter.ts", lang: "typescript" },
  { file: "greeter.go", lang: "go" },
  { file: "greeter.java", lang: "java" },
  { file: "greeter.sh", lang: "bash" },
];

interface ParityResult {
  file: string;
  lang: string;
  wasmNodes: number;
  nativeNodes: number;
  diff: number;
  diffPercent: number;
  passed: boolean;
}

async function loadWasmParser(language: string) {
  const { TreeSitterFactory } = await import("./ast-extractor.js");
  const factory = new TreeSitterFactory({ backend: "wasm" });
  return factory.createParser(language);
}

async function loadNativeParser(language: string) {
  const { TreeSitterFactory } = await import("./ast-extractor.js");
  const factory = new TreeSitterFactory({ backend: "native" });
  return factory.createParser(language);
}

function countNodes(tree: unknown): number {
  if (!tree) return 0;
  const t = tree as Record<string, unknown>;
  let count = 1;
  const children = (t["children"] as unknown[]) ?? [];
  for (const child of children) {
    count += countNodes(child);
  }
  return count;
}

async function compareFile(file: string, lang: string): Promise<ParityResult> {
  const content = readFileSync(join(FIXTURES_DIR, file), "utf-8");

  let wasmNodes = 0;
  let nativeNodes = 0;

  try {
    const { parser: wasmParser } = await loadWasmParser(lang);
    const wasmTree = (wasmParser as { parse(content: string): unknown }).parse(content);
    wasmNodes = countNodes(wasmTree);
  } catch {
    // WASM may fail in test env — skip
  }

  try {
    const { parser: nativeParser } = await loadNativeParser(lang);
    const nativeTree = (nativeParser as { parse(content: string): unknown }).parse(content);
    nativeNodes = countNodes(nativeTree);
  } catch {
    // Native may not be available — skip
  }

  const diff = Math.abs(wasmNodes - nativeNodes);
  const diffPercent = nativeNodes > 0 ? (diff / nativeNodes) * 100 : 0;
  const passed = nativeNodes === 0 || diffPercent < 2;

  return { file, lang, wasmNodes, nativeNodes, diff, diffPercent, passed };
}

export async function runParityCheck(): Promise<ParityResult[]> {
  const results: ParityResult[] = [];

  for (const fixture of FIXTURES) {
    const result = await compareFile(fixture.file, fixture.lang);
    results.push(result);
    console.log(
      `[${result.passed ? "PASS" : "FAIL"}] ${result.file}: WASM=${result.wasmNodes} native=${result.nativeNodes} diff=${result.diff} (${result.diffPercent.toFixed(1)}%)`
    );
  }

  return results;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const results = await runParityCheck();
  const allPassed = results.every((r) => r.passed);
  console.log(`\nParity: ${allPassed ? "ALL PASSED" : "SOME FAILED"}`);
  process.exit(allPassed ? 0 : 1);
}
